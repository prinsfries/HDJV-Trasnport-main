import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AddEditModal from '../../components/modals/AddEditModal/AddEditModal'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import ViewModal from '../../components/modals/ViewModal/ViewModal'
import UserCreatedModal from '../../components/modals/UserCreatedModal/UserCreatedModal'
import EditActionButton from '../../components/ActionButtons/EditActionButton'
import DeleteActionButton from '../../components/ActionButtons/DeleteActionButton'
import ViewActionButton from '../../components/ActionButtons/ViewActionButton'
import { formatDate } from '../../utils/dateUtils'
import { fetchUsers, fetchUsersAll, createUser, updateUser, deleteUser } from '../../utils/api/index.js'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import { useToast } from '../../components/Toast/ToastContext'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useDateTimeFormat } from '../../contexts/useDateTimeFormat'
import { useLazyTable } from '../../hooks/useLazyTable'
import { useLocation, useSearchParams } from 'react-router'
import './Users.css'

const Users = () => {
  const { t } = useLanguage()
  useDateTimeFormat()
  const toast = useToast()
  const [allUsers, setAllUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasTotal, setHasTotal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [selectedJoinYear, setSelectedJoinYear] = useState('all')
  const [userView, setUserView] = useState('drivers') // 'drivers' or 'passengers'
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' })
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')
  const handledOpenModalRef = useRef(false)

  usePageHeader(t('pages.usersManagement'))
  
  // User created modal state
  const [isUserCreatedModalOpen, setIsUserCreatedModalOpen] = useState(false)
  const [createdUser, setCreatedUser] = useState(null)
  const [defaultPassword, setDefaultPassword] = useState('')

  const backendPageSize = 200

  const normalizeRole = useCallback((rawRole) => {
    if (!rawRole) return ''
    const normalized = String(rawRole).toLowerCase().replace(/[\s_-]+/g, '')
    if (normalized === 'driver') return 'driver'
    if (normalized === 'passenger') return 'passenger'
    if (normalized === 'krpassenger') return 'krpassenger'
    return String(rawRole)
  }, [])

  const getRoleLabel = useCallback((role) => {
    const normalized = normalizeRole(role)
    if (normalized === 'driver') return 'Driver'
    if (normalized === 'krpassenger') return 'KR Passenger'
    return 'Passenger'
  }, [normalizeRole])

  const getCouponDisplay = useCallback((user, role) => {
    const normalized = normalizeRole(role)
    if (normalized !== 'krpassenger') return '--'
    const used = typeof user?.coupon_used_count === 'number' ? user.coupon_used_count : 0
    return `${used}/4`
  }, [normalizeRole])

  const buildParamsString = (nextSearch, nextView, nextYear) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (nextView && nextView !== 'drivers') {
      params.set('view', nextView)
    }
    if (nextYear && nextYear !== 'all') {
      params.set('year', nextYear)
    }
    return params.toString()
  }

  useEffect(() => {
    const currentString = searchParams.toString()
    if (currentString === lastSetParamsRef.current) {
      hasInitializedFromUrl.current = true
      return
    }
    const paramSearch = searchParams.get('search') ?? ''
    const paramView = searchParams.get('view')
    const paramRole = searchParams.get('role')
    const paramRoleIn = searchParams.get('role_in')
    const paramYear = searchParams.get('year') ?? searchParams.get('join_year')
    const normalizedView = paramView
      ? (paramView === 'passengers' ? 'passengers' : 'drivers')
      : (paramRole === 'driver'
        ? 'drivers'
        : (paramRole === 'passenger' || paramRole === 'krpassenger' || paramRoleIn ? 'passengers' : 'drivers'))
    const nextYear = paramYear && paramYear !== 'all' ? paramYear : 'all'
    if (paramSearch !== searchTerm) setSearchTerm(paramSearch)
    if (paramSearch !== debouncedSearchTerm) setDebouncedSearchTerm(paramSearch)
    if (normalizedView !== userView) setUserView(normalizedView)
    if (nextYear !== selectedJoinYear) setSelectedJoinYear(nextYear)
    hasInitializedFromUrl.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    if (!hasInitializedFromUrl.current) return
    const nextString = buildParamsString(debouncedSearchTerm, userView, selectedJoinYear)
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [debouncedSearchTerm, userView, selectedJoinYear, searchParams, setSearchParams])

  const mergeUniqueUsers = useCallback((current, incoming) => {
    const map = new Map()
    current.forEach((user) => {
      map.set(user.id, user)
    })
    const uniqueAdded = []
    incoming.forEach((user) => {
      if (!map.has(user.id)) {
        map.set(user.id, user)
        uniqueAdded.push(user)
      }
    })
    return { merged: Array.from(map.values()), addedCount: uniqueAdded.length }
  }, [])

  // Fetch users from API on mount and when search changes
  useEffect(() => {
    let isMounted = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      try {
        const roleFilters = userView === 'drivers'
          ? { role: 'driver' }
          : { role_in: 'passenger,krpassenger' }
        const yearFilter = selectedJoinYear !== 'all' ? { join_year: selectedJoinYear } : {}
        const data = await fetchUsers(1, backendPageSize, debouncedSearchTerm, sortConfig, { ...roleFilters, ...yearFilter })
        if (!isMounted) return
        setAllUsers(Array.isArray(data) ? data : data.items || [])
        const hasTotalResponse = typeof data.total === 'number'
        setTotalCount(hasTotalResponse ? data.total : (Array.isArray(data) ? data.length : 0))
        setHasTotal(hasTotalResponse)
        setBackendPage(1)
        const firstPageCount = Array.isArray(data) ? data.length : (data.items ? data.items.length : 0)
        const total = hasTotalResponse ? data.total : firstPageCount
        const pageIsFull = firstPageCount === backendPageSize
        setBackendHasMore(hasTotalResponse ? firstPageCount < total : pageIsFull)
        setErrorMessage('')
      } catch {
        if (!isMounted) return
        setAllUsers([])
        setBackendHasMore(false)
        setErrorMessage('Unable to load users from the server.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadFirstPage()

    return () => {
      isMounted = false
    }
  }, [debouncedSearchTerm, backendPageSize, sortConfig, userView, selectedJoinYear])

  const filteredUsers = allUsers

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
    // sort handled by backend
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return 'bi bi-arrow-down-up'
    return sortConfig.direction === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'
  }

  const sortedUsers = filteredUsers
  const userTableColSpan = userView === 'passengers' ? 8 : 7

  const resetKey = `${debouncedSearchTerm}|${selectedJoinYear}|${userView}|${sortConfig.key}|${sortConfig.direction}`
  const {
    containerRef,
    visibleItems: displayedUsers,
  } = useLazyTable({
    items: sortedUsers,
    pageSize: 50,
    resetKey,
    hasMoreRemote: backendHasMore,
    onFetchMore: async () => {
      if (isLoading || isLoadingMore || !backendHasMore) return 0
      setIsLoadingMore(true)
      try {
        const nextPage = backendPage + 1
        const roleFilters = userView === 'drivers'
          ? { role: 'driver' }
          : { role_in: 'passenger,krpassenger' }
        const yearFilter = selectedJoinYear !== 'all' ? { join_year: selectedJoinYear } : {}
        const data = await fetchUsers(nextPage, backendPageSize, debouncedSearchTerm, sortConfig, { ...roleFilters, ...yearFilter })
        const nextBatch = Array.isArray(data) ? data : (data.items || [])
        if (nextBatch.length === 0) {
          setBackendHasMore(false)
          return 0
        }
        let addedCount = 0
        let mergedCount = 0
        setAllUsers((prev) => {
          const { merged, addedCount: newCount } = mergeUniqueUsers(prev, nextBatch)
          addedCount = newCount
          mergedCount = merged.length
          return merged
        })
        setBackendPage(nextPage)
        if (typeof data.total === 'number') {
          setTotalCount(data.total)
          setBackendHasMore(mergedCount < data.total)
          setHasTotal(true)
        } else {
          setTotalCount(mergedCount)
          setBackendHasMore(nextBatch.length === backendPageSize && addedCount > 0)
          setHasTotal(false)
        }
        return addedCount
      } finally {
        setIsLoadingMore(false)
      }
    },
  })
  const displayCount = Math.min(displayedUsers.length, sortedUsers.length)
  const displayedUsersSafe = displayedUsers.slice(0, displayCount)

  const exportColumns = useMemo(() => {
    const baseColumns = [
      { label: 'ID', value: (user) => user.id },
      {
        label: 'Full Name',
        value: (user) => user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()
      },
      { label: 'Email', value: (user) => user.email || '--' },
      { label: 'Contact', value: (user) => user.contact || '--' },
      {
        label: 'Role',
        value: (user) => getRoleLabel(normalizeRole(user?.role || user?.user_role))
      },
    ]

    if (userView === 'passengers') {
      baseColumns.push({
        label: 'Coupons Used',
        value: (user) => getCouponDisplay(user, normalizeRole(user?.role || user?.user_role))
      })
    }

    baseColumns.push({
      label: 'Join Date',
      value: (user) => (user.created_at || user.joinDate ? formatDate(user.created_at || user.joinDate) : '--')
    })

    return baseColumns
  }, [userView, getCouponDisplay, getRoleLabel, normalizeRole])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const roleFilters = userView === 'drivers'
        ? { role: 'driver' }
        : { role_in: 'passenger,krpassenger' }
      const yearFilter = selectedJoinYear !== 'all' ? { join_year: selectedJoinYear } : {}
      const exportFilters = {
        ...roleFilters,
        ...yearFilter,
        ...(sortConfig?.key ? { sort_by: sortConfig.key } : {}),
        ...(sortConfig?.direction ? { sort_dir: sortConfig.direction } : {}),
      }
      const users = await fetchUsersAll(debouncedSearchTerm, exportFilters)
      const filename = createCsvFilename(userView === 'drivers' ? 'drivers' : 'passengers')
      exportRowsToCsv({ rows: users, columns: exportColumns, filename })
      toast.showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export users:', error)
      toast.showError(error?.message || 'Failed to export users.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleJoinYearChange = (event) => {
    setSelectedJoinYear(event.target.value)
  }

  const handleUserViewChange = (view) => {
    setUserView(view)
  }

  const openModal = () => {
    setEditingUser(null)
    setModalMode('add')
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (handledOpenModalRef.current) return
    if (location?.state?.openModal) {
      handledOpenModalRef.current = true
      openModal()
    }
  }, [location, openModal])

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleViewUser = (user) => {
    setSelectedUser(user)
    setIsViewModalOpen(true)
  }

  const closeViewModal = () => {
    setIsViewModalOpen(false)
    setSelectedUser(null)
  }

  

  const handleEditUser = (user) => {
    setEditingUser(user)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleSaveUser = async (userData) => {
    try {
      // Set role based on current view if not explicitly provided
      const finalUserData = {
        ...userData,
        role: userData.role || (userView === 'drivers' ? 'driver' : 'passenger')
      }

      if (modalMode === 'add') {
        const newUser = await createUser(finalUserData)
        const normalizedRole = normalizeRole(newUser?.role || finalUserData.role)
        const nextUser = {
          ...newUser,
          role: normalizedRole || newUser?.role || finalUserData.role,
          coupon_used_count:
            typeof newUser?.coupon_used_count === 'number'
              ? newUser.coupon_used_count
              : (normalizedRole === 'krpassenger' ? 0 : newUser?.coupon_used_count),
        }
        setAllUsers(prev => [nextUser, ...prev])
        
        // Show user created modal with credentials
        setCreatedUser(nextUser)
        setDefaultPassword(nextUser.default_password || 'Generated password')
        setIsUserCreatedModalOpen(true)
        
        toast.showSuccess('User created successfully!')
      } else {
        const updatedUser = await updateUser(editingUser.id, finalUserData)
        setAllUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u))
        toast.showSuccess('User updated successfully!')
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save user:', error)
      toast.showError(error.message || 'Failed to save user')
    }
  }

  const userFields = [
    { name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: "Enter first name", initialValue: editingUser?.first_name },
    { name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: "Enter last name", initialValue: editingUser?.last_name },
    { name: 'middle_name', label: 'Middle Name (Optional)', type: 'text', required: false, placeholder: "Enter middle name", initialValue: editingUser?.middle_name },
    { name: 'suffix', label: 'Suffix (Optional)', type: 'text', required: false, placeholder: "e.g., Jr., Sr., II, III", initialValue: editingUser?.suffix },
    { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'driver@example.com', initialValue: editingUser?.email, fullWidth: true },
    { name: 'username', label: 'Username (Optional)', type: 'text', required: false, placeholder: 'Leave blank to use email', initialValue: editingUser?.username },
    { name: 'contact', label: 'Contact Number', type: 'tel', required: true, placeholder: '09XXXXXXXXX', initialValue: editingUser?.contact },
    ...(userView === 'passengers' ? [
      {
        name: 'role',
        label: 'Passenger Type',
        type: 'select',
        required: true,
        initialValue: editingUser?.role || 'passenger',
        options: [
          { value: 'passenger', label: 'Regular Passenger' },
          { value: 'krpassenger', label: 'Korean Passenger' }
        ]
      }
    ] : [])
  ]

  const handleDeleteUser = (user) => {
    setUserToDelete(user)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteUser = async () => {
    if (!userToDelete) return
    try {
      await deleteUser(userToDelete.id)
      setAllUsers(prev => prev.filter(u => u.id !== userToDelete.id))
      setIsDeleteModalOpen(false)
      setUserToDelete(null)
      toast.showSuccess('User deleted successfully!')
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast.showError('Failed to delete user')
    }
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setUserToDelete(null)
  }

  const closeUserCreatedModal = () => {
    setIsUserCreatedModalOpen(false)
    setCreatedUser(null)
    setDefaultPassword('')
  }

  const joinYearOptions = Array.from(
    new Set(allUsers.map((user) => new Date(user.created_at || new Date()).getFullYear()))
  ).sort((a, b) => b - a)


  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <button className="btn btn-primary" onClick={openModal}>
            <i className="bi bi-plus-circle"></i> Add New {userView === 'drivers' ? 'Driver' : 'Passenger'}
          </button>
          <div className="table-filters">
            <div className="search-box">
              <input 
                type="text" 
                placeholder={`Search ${userView}...`} 
                className="search-input" 
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <i className="bi bi-search search-icon"></i>
            </div>
            <div className="filter-group">
              <label htmlFor="user-join-year">Join Year</label>
              <select
                id="user-join-year"
                className="filter-select"
                value={selectedJoinYear}
                onChange={handleJoinYearChange}
              >
                <option value="all">All Years</option>
                {joinYearOptions.map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-actions-right">
             <div className="filter-group">
              <label>User Type</label>
              <div className="user-type-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${userView === 'drivers' ? 'active' : ''}`}
                  onClick={() => handleUserViewChange('drivers')}
                >
                  Drivers
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${userView === 'passengers' ? 'active' : ''}`}
                  onClick={() => handleUserViewChange('passengers')}
                >
                  Passengers
                </button>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={isExporting}
              title="Download all rows as Excel-compatible CSV"
            >
              <i className="bi bi-file-earmark-excel"></i>
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className="table-wrapper table-wrapper-scroll" ref={containerRef}>
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('id')}>
                    ID <i className={getSortIcon('id')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('name')}>
                    Name <i className={getSortIcon('name')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('email')}>
                    Email <i className={getSortIcon('email')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('contact')}>
                    Contact <i className={getSortIcon('contact')}></i>
                  </button>
                </th>
                <th>Role</th>
                {userView === 'passengers' && <th>Coupons Used</th>}
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('created_at')}>
                    Join Date <i className={getSortIcon('created_at')}></i>
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={userTableColSpan} className="table-state">
                    Loading users...
                  </td>
                </tr>
              )}
              {!isLoading && displayedUsersSafe.length === 0 && (
                <tr>
                  <td colSpan={userTableColSpan} className="table-state">
                    No {userView} found.
                  </td>
                </tr>
              )}
              {!isLoading && displayedUsersSafe.map((user, index) => {
                const normalizedRole = normalizeRole(user?.role || user?.user_role)
                return (
                <tr key={`${user.id}-${index}`}>
                  <td className="user-id">#{user.id}</td>
                  <td className="user-name">
                    <div className="user-avatar-small">
                      <i className="bi bi-person-fill"></i>
                    </div>
                    {user.full_name}
                  </td>
                  <td className="user-email">{user.email}</td>
                  <td className="user-contact">
                    {user.contact}
                  </td>
                  <td className="user-role">
                    <span className={`role-badge ${normalizedRole || user.role}`}>
                      {getRoleLabel(normalizedRole || user.role)}
                    </span>
                  </td>
                  {userView === 'passengers' && (
                    <td className="user-coupon-usage">
                      {getCouponDisplay(user, normalizedRole || user.role)}
                    </td>
                  )}
                  <td className="join-date">{formatDate(user.created_at || user.joinDate)}</td>
                  <td className="actions-cell">
                    <div className="actions">
                      <EditActionButton onClick={() => handleEditUser(user)} />
                      <DeleteActionButton onClick={() => handleDeleteUser(user)} />
                      <ViewActionButton onClick={() => handleViewUser(user)} />
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="table-info">
            Showing {displayCount === 0 ? 0 : 1} to {displayCount} of{' '}
            {hasTotal ? totalCount : (backendHasMore ? `${totalCount}+` : totalCount)} entries
            </div>
          </div>
        </div>

      {selectedUser && (
        <ViewModal
          isOpen={isViewModalOpen}
          title="User Details"
          onClose={closeViewModal}
          maxWidth="760px">
          <div className="view-modal-details-grid">
            <div className="view-modal-detail-item full-width">
              <div className="users-view-section">
                <div className="users-view-section-title">Account</div>
                <div className="users-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>User ID:</label>
                    <span>#{selectedUser.id}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Join Date:</label>
                    <span>
                      {selectedUser.created_at || selectedUser.joinDate
                        ? formatDate(selectedUser.created_at || selectedUser.joinDate)
                        : '--'}
                    </span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Username:</label>
                    <span>{selectedUser.username || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Role:</label>
                    <span className={`role-badge ${normalizeRole(selectedUser.role || selectedUser.user_role) || selectedUser.role}`}>
                      {getRoleLabel(selectedUser.role || selectedUser.user_role)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="users-view-section">
                <div className="users-view-section-title">Contact</div>
                <div className="users-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Email:</label>
                    <span>{selectedUser.email || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Contact:</label>
                    <span>{selectedUser.contact || '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="users-view-section">
                <div className="users-view-section-title">Name</div>
                <div className="users-view-section-grid">
                  <div className="view-modal-detail-item full-width">
                    <label>Full Name:</label>
                    <span>{selectedUser.full_name || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>First Name:</label>
                    <span>{selectedUser.first_name || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Middle Name:</label>
                    <span>{selectedUser.middle_name || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Last Name:</label>
                    <span>{selectedUser.last_name || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Suffix:</label>
                    <span>{selectedUser.suffix || '--'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ViewModal>
      )}

      <AddEditModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveUser}
        title={modalMode === 'add' ? `Add New ${userView === 'drivers' ? 'Driver' : 'Passenger'}` : `Edit ${userView === 'drivers' ? 'Driver' : 'Passenger'}`}
        fields={userFields}
        initialData={editingUser || {}}
        mode={modalMode}
        twoColumn={true}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.full_name}?`}
      />

      <UserCreatedModal
        isOpen={isUserCreatedModalOpen}
        onClose={closeUserCreatedModal}
        user={createdUser}
        defaultPassword={defaultPassword}
      />
    </>
  )
}

export default Users




