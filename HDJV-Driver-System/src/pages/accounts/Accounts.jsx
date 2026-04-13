import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import { useSearchParams } from 'react-router'
import { fetchAccounts, fetchAccountsAll, deleteUser, updateUser } from '../../utils/api/index.js'
import AddEditModal from '../../components/modals/AddEditModal/AddEditModal'
import EditActionButton from '../../components/ActionButtons/EditActionButton'
import DeleteActionButton from '../../components/ActionButtons/DeleteActionButton'
import ToggleStatusActionButton from '../../components/ActionButtons/ToggleStatusActionButton'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useDateTimeFormat } from '../../contexts/useDateTimeFormat'
import { useLazyTable } from '../../hooks/useLazyTable'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import { formatDate } from '../../utils/dateUtils'
import { useToast } from '../../components/Toast/ToastContext'
import './Accounts.css'

const Accounts = () => {
  const { t } = useLanguage()
  useDateTimeFormat()
  const [allAccounts, setAllAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedApproval, setSelectedApproval] = useState('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')
  const [totalCount, setTotalCount] = useState(0)
  const [hasTotal, setHasTotal] = useState(false)
  const itemsPerPage = 50

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)

  const [showPasswords, setShowPasswords] = useState({})
  const [accountStatuses, setAccountStatuses] = useState({})
  const [accountApprovals, setAccountApprovals] = useState({})
  const { showSuccess, showError } = useToast()

  usePageHeader(t('pages.accountsManagement'))

  const backendPageSize = 200

  const buildParamsString = (nextSearch, nextStatus, nextApproval) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (nextStatus && nextStatus !== 'all') {
      params.set('status', nextStatus)
    }
    if (nextApproval && nextApproval !== 'all') {
      params.set('approval', nextApproval)
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
    const paramStatus = searchParams.get('status')
    const paramApproval = searchParams.get('approval')
    const nextStatus = paramStatus && paramStatus !== 'all' ? paramStatus : 'all'
    const nextApproval = paramApproval && paramApproval !== 'all' ? paramApproval : 'all'
    if (paramSearch !== searchTerm) setSearchTerm(paramSearch)
    if (paramSearch !== debouncedSearchTerm) setDebouncedSearchTerm(paramSearch)
    if (nextStatus !== selectedStatus) setSelectedStatus(nextStatus)
    if (nextApproval !== selectedApproval) setSelectedApproval(nextApproval)
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
    const nextString = buildParamsString(debouncedSearchTerm, selectedStatus, selectedApproval)
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [debouncedSearchTerm, selectedStatus, selectedApproval, searchParams, setSearchParams])

  const mergeUniqueAccounts = useCallback((current, incoming) => {
    const map = new Map()
    current.forEach((account) => {
      map.set(account.id, account)
    })
    const uniqueAdded = []
    incoming.forEach((account) => {
      if (!map.has(account.id)) {
        map.set(account.id, account)
        uniqueAdded.push(account)
      }
    })
    return { merged: Array.from(map.values()), addedCount: uniqueAdded.length }
  }, [])

  // Fetch accounts from API on mount and when search changes
  useEffect(() => {
    let isMounted = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      try {
        const filterParams = {
          role_exclude: 'admin',
          ...(selectedStatus !== 'all' ? { is_active: selectedStatus === 'active' } : {}),
          ...(selectedApproval !== 'all' ? { is_approved: selectedApproval === 'approved' } : {}),
        }
        const data = await fetchAccounts(1, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        if (!isMounted) return
        const rawAccounts = Array.isArray(data) ? data : (data.items || [])
        const driverAccounts = rawAccounts.filter(account => account.role !== 'admin')
        setAllAccounts(driverAccounts)
        const statuses = driverAccounts.reduce((acc, account) => {
          acc[account.id] = account.is_active
          return acc
        }, {})
        const approvals = driverAccounts.reduce((acc, account) => {
          acc[account.id] = account.is_approved
          return acc
        }, {})
        setAccountStatuses(statuses)
        setAccountApprovals(approvals)
        setBackendPage(1)
        const hasTotalResponse = typeof data.total === 'number'
        const total = hasTotalResponse ? data.total : rawAccounts.length
        const pageIsFull = rawAccounts.length === backendPageSize
        setBackendHasMore(hasTotalResponse ? rawAccounts.length < total : pageIsFull)
        setTotalCount(hasTotalResponse ? data.total : rawAccounts.length)
        setHasTotal(hasTotalResponse)
        setErrorMessage('')
      } catch {
        if (!isMounted) return
        setAllAccounts([])
        setBackendHasMore(false)
        setErrorMessage('Unable to load accounts from the server.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadFirstPage()

    return () => {
      isMounted = false
    }
  }, [debouncedSearchTerm, backendPageSize, sortConfig, selectedStatus, selectedApproval])

  const filteredAccounts = useMemo(() => {
    return allAccounts.filter((account) => {
      if (selectedStatus !== 'all') {
        const isActive = selectedStatus === 'active'
        if (Boolean(account.is_active) !== isActive) return false
      }
      if (selectedApproval !== 'all') {
        const isApproved = selectedApproval === 'approved'
        if (Boolean(account.is_approved) !== isApproved) return false
      }
      return true
    })
  }, [allAccounts, selectedStatus, selectedApproval])

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return 'bi bi-arrow-down-up'
    return sortConfig.direction === 'asc' ? 'bi bi-caret-up-fill' : 'bi bi-caret-down-fill'
  }

  const sortedAccounts = filteredAccounts
  const effectiveHasTotal = hasTotal && selectedStatus === 'all' && selectedApproval === 'all'
  const effectiveTotalCount = effectiveHasTotal ? totalCount : sortedAccounts.length

  const exportColumns = useMemo(() => ([
    { label: 'ID', value: (account) => account.id },
    { label: 'Username', value: (account) => account.username || '--' },
    { label: 'Email', value: (account) => account.email || '--' },
    { label: 'Status', value: (account) => (account.is_active ? 'Active' : 'Inactive') },
    { label: 'Approval', value: (account) => (account.is_approved ? 'Approved' : 'Pending') },
    {
      label: 'Created At',
      value: (account) => (account.created_at ? formatDate(account.created_at) : '--')
    },
  ]), [])

  const {
    containerRef,
    visibleItems: displayedAccounts,
    visibleCount,
  } = useLazyTable({
    items: sortedAccounts,
    pageSize: itemsPerPage,
    resetKey: `${debouncedSearchTerm}|${selectedStatus}|${selectedApproval}|${sortConfig.key}|${sortConfig.direction}`,
    hasMoreRemote: backendHasMore,
    onFetchMore: async () => {
      if (isLoading || isLoadingMore || !backendHasMore) return 0
      setIsLoadingMore(true)
      try {
        const nextPage = backendPage + 1
        const filterParams = {
          role_exclude: 'admin',
          ...(selectedStatus !== 'all' ? { is_active: selectedStatus === 'active' } : {}),
          ...(selectedApproval !== 'all' ? { is_approved: selectedApproval === 'approved' } : {}),
        }
        const data = await fetchAccounts(nextPage, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        const rawBatch = Array.isArray(data) ? data : (data.items || [])
        const nextBatch = rawBatch.filter(account => account.role !== 'admin')
        if (nextBatch.length === 0) {
          setBackendHasMore(false)
          return 0
        }
        let addedCount = 0
        let mergedCount = 0
        setAllAccounts((prev) => {
          const { merged, addedCount: newCount } = mergeUniqueAccounts(prev, nextBatch)
          addedCount = newCount
          mergedCount = merged.length
          return merged
        })
        setAccountApprovals((prev) => {
          const next = { ...prev }
          nextBatch.forEach((account) => {
            next[account.id] = account.is_approved
          })
          return next
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

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
  }

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value)
  }

  const handleApprovalChange = (event) => {
    setSelectedApproval(event.target.value)
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const exportFilters = {
        role_exclude: 'admin',
        ...(selectedStatus !== 'all' ? { is_active: selectedStatus === 'active' } : {}),
        ...(selectedApproval !== 'all' ? { is_approved: selectedApproval === 'approved' } : {}),
        ...(sortConfig?.key ? { sort_by: sortConfig.key } : {}),
        ...(sortConfig?.direction ? { sort_dir: sortConfig.direction } : {}),
      }
      const accounts = await fetchAccountsAll(debouncedSearchTerm, exportFilters)
      exportRowsToCsv({
        rows: accounts,
        columns: exportColumns,
        filename: createCsvFilename('accounts')
      })
      showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export accounts:', error)
      showError(error?.message || 'Failed to export accounts.')
    } finally {
      setIsExporting(false)
    }
  }

  const togglePasswordVisibility = (accountId) => {
    setShowPasswords(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }))
  }

  const toggleAccountStatus = async (accountId) => {
    if (!accountApprovals[accountId]) {
      showError('Account must be approved before changing status.')
      return
    }
    const currentStatus = accountStatuses[accountId]
    const newStatus = !currentStatus
    
    try {
      const updated = await updateUser(accountId, { is_active: newStatus })
      setAccountStatuses(prev => ({
        ...prev,
        [accountId]: updated.is_active
      }))
      setAllAccounts(prev => prev.map(acc => acc.id === accountId ? updated : acc))
    } catch (error) {
      console.error('Failed to update account status:', error)
      alert('Failed to update account status')
    }
  }

  const approveAccount = async (accountId) => {
    try {
      const updated = await updateUser(accountId, { is_approved: true, is_active: true })
      setAccountApprovals(prev => ({
        ...prev,
        [accountId]: updated.is_approved
      }))
      setAccountStatuses(prev => ({
        ...prev,
        [accountId]: updated.is_active
      }))
      setAllAccounts(prev => prev.map(acc => acc.id === accountId ? updated : acc))
    } catch (error) {
      console.error('Failed to approve account:', error)
      alert('Failed to approve account')
    }
  }

  const handleEditAccount = (account) => {
    setEditingAccount(account)
    setIsEditModalOpen(true)
  }

  const handleSaveAccount = async (formData) => {
    try {
      const updatedUser = await updateUser(editingAccount.id, formData)
      setAllAccounts(prev => prev.map(acc => acc.id === editingAccount.id ? updatedUser : acc))
      setIsEditModalOpen(false)
      setEditingAccount(null)
    } catch (error) {
      console.error('Failed to update account:', error)
      alert('Failed to update account')
    }
  }

  const handleDeleteAccount = (account) => {
    setAccountToDelete(account)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return
    
    try {
      await deleteUser(accountToDelete.id)
      setAllAccounts(prev => prev.filter(acc => acc.id !== accountToDelete.id))
      setAccountToDelete(null)
      setIsDeleteModalOpen(false)
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Failed to delete account')
    }
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setAccountToDelete(null)
  }

  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search accounts..." 
              className="search-input" 
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <i className="bi bi-search search-icon"></i> 
          </div>
          <div className="filter-group">
            <label htmlFor="account-status-filter">Status</label>
            <select
              id="account-status-filter"
              className="filter-select"
              value={selectedStatus}
              onChange={handleStatusChange}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="account-approval-filter">Approval</label>
            <select
              id="account-approval-filter"
              className="filter-select"
              value={selectedApproval}
              onChange={handleApprovalChange}
            >
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="table-actions-right">
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
                  <button type="button" className="sort-header" onClick={() => handleSort('username')}>
                    Username <i className={getSortIcon('username')}></i>
                  </button>
                </th>
                <th>Password</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="6" className="table-state">
                    Loading accounts...
                  </td>
                </tr>
              )}
              {!isLoading && displayedAccounts.length === 0 && (
                <tr>
                  <td colSpan="6" className="table-state">
                    No accounts found.
                  </td>
                </tr>
              )}
              {!isLoading && displayedAccounts.map((account, index) => (
                <tr key={`${account.id}-${index}`}>
                  <td className="account-id">#{account.id}</td>
                  <td className="account-username">{account.username}</td>
                  <td className="account-password">
                    {account.password_changed ? (
                      <div className="password-field">
                        <input
                          type="password"
                          value="••••••••"
                          readOnly
                          className="account-password-input"
                          disabled
                          aria-label={`Password changed for ${account.username || 'account'}`}
                        />
                        <span className="password-changed-badge" title="Password has been changed by user">
                          <i className="bi bi-lock-fill"></i> Changed
                        </span>
                      </div>
                    ) : (
                      <div className="password-field">
                        <input
                          type={showPasswords[account.id] ? 'text' : 'password'}
                          value={account.visible_password || '••••••••'}
                          readOnly
                          className="account-password-input"
                          aria-label={`Password for ${account.username || 'account'}`}
                        />
                        <button
                          className="password-toggle-btn"
                          onClick={() => togglePasswordVisibility(account.id)}
                          title={showPasswords[account.id] ? 'Hide password' : 'Show password'}
                        >
                          <i className={`bi ${showPasswords[account.id] ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="account-status">
                    <span className={`status-badge ${accountStatuses[account.id] ? 'active' : 'inactive'}`}>
                      {accountStatuses[account.id] ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="account-approval">
                    <span className={`status-badge ${accountApprovals[account.id] ? 'active' : 'inactive'}`}>
                      {accountApprovals[account.id] ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="actions">
                      {!accountApprovals[account.id] && (
                        <button
                          type="button"
                          className="action-btn approve-btn"
                          onClick={() => approveAccount(account.id)}
                          title="Approve account"
                        >
                          <i className="bi bi-check2-circle"></i>
                        </button>
                      )}
                      {accountApprovals[account.id] && (
                        <ToggleStatusActionButton
                          isActive={accountStatuses[account.id]}
                          onClick={() => toggleAccountStatus(account.id)}
                        />
                      )}
                      <EditActionButton onClick={() => handleEditAccount(account)} />
                      <DeleteActionButton onClick={() => handleDeleteAccount(account)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="table-info">
            Showing {visibleCount === 0 ? 0 : 1} to {visibleCount} of {effectiveHasTotal ? effectiveTotalCount : (backendHasMore ? `${effectiveTotalCount}+` : effectiveTotalCount)} entries
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteAccount}
        title="Delete Account"
        message={`Are you sure you want to delete the account for ${accountToDelete?.username}?`}
      />

      <AddEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveAccount}
        title="Edit Account"
        mode="edit"
        initialData={editingAccount || {}}
        fields={[
          { name: 'username', label: 'Username', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'password', label: 'New Password (leave blank to keep current)', type: 'password' }
        ]}
      />
    </>
  )
}

export default Accounts


