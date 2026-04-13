import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../components/Toast/ToastContext'
import { useLocation, useSearchParams } from 'react-router'
import AddEditModal from '../../components/modals/AddEditModal/AddEditModal'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import ViewModal from '../../components/modals/ViewModal/ViewModal'
import EditActionButton from '../../components/ActionButtons/EditActionButton'
import DeleteActionButton from '../../components/ActionButtons/DeleteActionButton'
import ViewActionButton from '../../components/ActionButtons/ViewActionButton'
import { fetchVehicleById, fetchVehicles, fetchVehiclesAll, deleteVehicle, updateVehicle, createVehicle } from '../../utils/api/index.js'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useLazyTable } from '../../hooks/useLazyTable'
import './Vehicles.css'

const Vehicles = () => {
  const { t } = useLanguage()
  const { showSuccess, showError } = useToast()
  const [allVehicles, setAllVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [isViewLoading, setIsViewLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [hasTotal, setHasTotal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState(null)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [modalMode, setModalMode] = useState('add')
  const [selectedVehicleType, setSelectedVehicleType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'vehicle_id', direction: 'asc' })
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')
  const handledOpenModalRef = useRef(false)

  usePageHeader(t('pages.vehiclesManagement'))

  const backendPageSize = 200

  const buildParamsString = (nextSearch, nextType, nextStatus) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (nextType && nextType !== 'all') {
      params.set('type', nextType)
    }
    if (nextStatus && nextStatus !== 'all') {
      params.set('status', nextStatus)
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
    const paramType = searchParams.get('type') ?? searchParams.get('vehicle_type')
    const paramStatus = searchParams.get('status')
    const nextType = paramType && paramType !== 'all' ? paramType : 'all'
    const nextStatus = paramStatus && paramStatus !== 'all' ? paramStatus : 'all'
    if (paramSearch !== searchTerm) setSearchTerm(paramSearch)
    if (paramSearch !== debouncedSearchTerm) setDebouncedSearchTerm(paramSearch)
    if (nextType !== selectedVehicleType) setSelectedVehicleType(nextType)
    if (nextStatus !== selectedStatus) setSelectedStatus(nextStatus)
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
    const nextString = buildParamsString(debouncedSearchTerm, selectedVehicleType, selectedStatus)
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [debouncedSearchTerm, selectedVehicleType, selectedStatus, searchParams, setSearchParams])

  const mergeUniqueVehicles = useCallback((current, incoming) => {
    const map = new Map()
    current.forEach((vehicle) => {
      map.set(vehicle.id, vehicle)
    })
    const uniqueAdded = []
    incoming.forEach((vehicle) => {
      if (!map.has(vehicle.id)) {
        map.set(vehicle.id, vehicle)
        uniqueAdded.push(vehicle)
      }
    })
    return { merged: Array.from(map.values()), addedCount: uniqueAdded.length }
  }, [])

  // Fetch vehicles from API on mount and when search changes
  useEffect(() => {
    let isMounted = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      try {
        const filterParams = {
          ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
          ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
        }
        const data = await fetchVehicles(1, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        if (!isMounted) return
        setAllVehicles(Array.isArray(data) ? data : data.items || [])
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
        setAllVehicles([])
        setBackendHasMore(false)
        setErrorMessage('Unable to load vehicles from the server.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadFirstPage()

    return () => {
      isMounted = false
    }
  }, [debouncedSearchTerm, backendPageSize, sortConfig, selectedVehicleType, selectedStatus])

  const filteredVehicles = allVehicles

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

  const sortedVehicles = filteredVehicles

  const resetKey = `${debouncedSearchTerm}|${selectedVehicleType}|${selectedStatus}|${sortConfig.key}|${sortConfig.direction}`
  const {
    containerRef,
    visibleItems: displayedVehicles,
  } = useLazyTable({
    items: sortedVehicles,
    pageSize: 50,
    resetKey,
    hasMoreRemote: backendHasMore,
    onFetchMore: async () => {
      if (isLoading || isLoadingMore || !backendHasMore) return 0
      setIsLoadingMore(true)
      try {
        const nextPage = backendPage + 1
        const filterParams = {
          ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
          ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
        }
        const data = await fetchVehicles(nextPage, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        const nextBatch = Array.isArray(data) ? data : (data.items || [])
        if (nextBatch.length === 0) {
          setBackendHasMore(false)
          return 0
        }
        let addedCount = 0
        let mergedCount = 0
        setAllVehicles((prev) => {
          const { merged, addedCount: newCount } = mergeUniqueVehicles(prev, nextBatch)
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
  const displayCount = Math.min(displayedVehicles.length, sortedVehicles.length)
  const displayedVehiclesSafe = displayedVehicles.slice(0, displayCount)

  const exportColumns = useMemo(() => ([
    { label: 'Vehicle ID', value: (vehicle) => vehicle.vehicle_id },
    { label: 'Brand', value: (vehicle) => vehicle.vehicle_brand || '--' },
    { label: 'Model', value: (vehicle) => vehicle.vehicle_model || '--' },
    { label: 'Vehicle Type', value: (vehicle) => vehicle.vehicle_type || '--' },
    { label: 'Plate Number', value: (vehicle) => vehicle.plate_number || '--' },
    { label: 'Status', value: (vehicle) => vehicle.status || '--' },
  ]), [])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchTerm(value)
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const filterParams = {
        ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
        ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
        ...(sortConfig?.key ? { sort_by: sortConfig.key } : {}),
        ...(sortConfig?.direction ? { sort_dir: sortConfig.direction } : {}),
      }
      const vehicles = await fetchVehiclesAll(debouncedSearchTerm, filterParams)
      exportRowsToCsv({
        rows: vehicles,
        columns: exportColumns,
        filename: createCsvFilename('vehicles')
      })
      showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export vehicles:', error)
      showError(error?.message || 'Failed to export vehicles.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleVehicleTypeChange = (event) => {
    setSelectedVehicleType(event.target.value)
  }

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value)
  }

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Active': 'status-active',
      'Inactive': 'status-inactive',
      'Maintenance': 'status-maintenance'
    }
    return statusClasses[status] || 'status-inactive'
  }

  const getVehicleTypeBadge = (type) => {
    const typeClasses = {
      'Sedan': 'type-sedan',
      'SUV': 'type-suv',
      'Truck': 'type-truck',
      'Van': 'type-van'
    }
    return typeClasses[type] || 'type-default'
  }

  const openModal = () => {
    setEditingVehicle(null)
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

  const handleViewVehicle = async (vehicle) => {
    if (!vehicle?.id) return
    setIsViewModalOpen(true)
    setIsViewLoading(true)
    try {
      const full = await fetchVehicleById(vehicle.id)
      setSelectedVehicle(full)
    } catch (error) {
      console.error('Failed to load vehicle details:', error)
      showError(error?.message || 'Unable to load vehicle details.')
      setSelectedVehicle(vehicle)
    } finally {
      setIsViewLoading(false)
    }
  }

  const closeViewModal = () => {
    setIsViewModalOpen(false)
    setSelectedVehicle(null)
  }

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleSaveVehicle = async (vehicleData) => {
    try {
      if (modalMode === 'add') {
        const newVehicle = await createVehicle(vehicleData)
        setAllVehicles(prev => [newVehicle, ...prev])
        showSuccess('Vehicle added')
      } else {
        const updatedVehicle = await updateVehicle(editingVehicle.id, vehicleData)
        setAllVehicles(prev => prev.map(v => v.id === editingVehicle.id ? updatedVehicle : v))
        showSuccess('Vehicle updated')
      }
      setIsModalOpen(false)
    } catch (error) {
      console.error('Failed to save vehicle:', error)
      showError(error.message || 'Failed to save vehicle')
    }
  }

  const handleDeleteVehicle = (vehicle) => {
    setVehicleToDelete(vehicle)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return
    
    try {
      await deleteVehicle(vehicleToDelete.id)
      setAllVehicles(prev => prev.filter(v => v.id !== vehicleToDelete.id))
      setVehicleToDelete(null)
      setIsDeleteModalOpen(false)
      showSuccess('Vehicle deleted')
    } catch (error) {
      console.error('Failed to delete vehicle:', error)
      showError('Failed to delete vehicle')
    }
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setVehicleToDelete(null)
  }

  const vehicleFields = [
    { name: 'vehicle_id', label: 'Vehicle ID', type: 'text', required: true, placeholder: 'VH-001', initialValue: editingVehicle?.vehicle_id },
    { name: 'vehicle_brand', label: 'Brand', type: 'text', required: false, placeholder: 'Toyota', initialValue: editingVehicle?.vehicle_brand },
    { name: 'vehicle_model', label: 'Model', type: 'text', required: false, placeholder: 'Vios', initialValue: editingVehicle?.vehicle_model },
    { name: 'description', label: 'Description', type: 'text', required: false, placeholder: 'Notes or details', initialValue: editingVehicle?.description, fullWidth: true },
    { name: 'plate_number', label: 'Plate Number', type: 'text', required: true, placeholder: 'ABC-1234', initialValue: editingVehicle?.plate_number },
    { 
      name: 'vehicle_type', 
      label: 'Vehicle Type', 
      type: 'select', 
      required: true,
      initialValue: editingVehicle?.vehicle_type,
      options: [
        { value: '', label: 'Select vehicle type' },
        { value: 'Sedan', label: 'Sedan' },
        { value: 'SUV', label: 'SUV' },
        { value: 'Truck', label: 'Truck' },
        { value: 'Van', label: 'Van' }
      ]
    },
    { 
      name: 'status', 
      label: 'Status', 
      type: 'select', 
      required: true,
      initialValue: editingVehicle?.status,
      options: [
        { value: '', label: 'Select status' },
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
        { value: 'Maintenance', label: 'Maintenance' }
      ]
    }
  ]

  const vehicleTypeOptions = useMemo(() => Array.from(
    new Set(allVehicles.map((vehicle) => vehicle.vehicle_type))
  ).sort(), [allVehicles])

  const statusOptions = useMemo(() => Array.from(
    new Set(allVehicles.map((vehicle) => vehicle.status))
  ).sort(), [allVehicles])

  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <button className="btn btn-primary" onClick={openModal}>
            <i className="bi bi-plus-lg"></i>
            Add Vehicle
          </button>
          <div className="table-filters">
            <div className="search-box">
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search vehicles..." 
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <i className="bi bi-search search-icon"></i>
            </div>
            <div className="filter-group">
              <label htmlFor="vehicle-type-filter">Vehicle Type</label>
              <select
                id="vehicle-type-filter"
                className="filter-select"
                value={selectedVehicleType}
                onChange={handleVehicleTypeChange}
              >
                <option value="all">All Types</option>
                {vehicleTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="vehicle-status-filter">Status</label>
              <select
                id="vehicle-status-filter"
                className="filter-select"
                value={selectedStatus}
                onChange={handleStatusChange}
              >
                <option value="all">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
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
          <table className="data-table vehicles-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('vehicle_id')}>
                    Vehicle ID <i className={getSortIcon('vehicle_id')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('vehicle_brand')}>
                    Brand <i className={getSortIcon('vehicle_brand')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('vehicle_model')}>
                    Model <i className={getSortIcon('vehicle_model')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('vehicle_type')}>
                    Vehicle Type <i className={getSortIcon('vehicle_type')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('plate_number')}>
                    Plate Number <i className={getSortIcon('plate_number')}></i>
                  </button>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="7" className="table-state">
                    Loading vehicles...
                  </td>
                </tr>
              )}
              {!isLoading && displayedVehiclesSafe.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-state">
                    No vehicles found.
                  </td>
                </tr>
              )}
              {!isLoading && displayedVehiclesSafe.map((vehicle, index) => (
                <tr key={`${vehicle.id}-${index}`}>
                  <td className="vehicle-id">
                    <span className="vehicle-id-badge">{vehicle.vehicle_id}</span>
                  </td>
                  <td className="vehicle-brand">{vehicle.vehicle_brand || '--'}</td>
                  <td className="vehicle-model">{vehicle.vehicle_model || '--'}</td>
                  <td className="vehicle-type">
                    <span className={`vehicle-type-badge ${getVehicleTypeBadge(vehicle.vehicle_type)}`}>
                      {vehicle.vehicle_type}
                    </span>
                  </td>
                  <td className="plate-number">
                    <span className="plate-number-text">{vehicle.plate_number}</span>
                  </td>
                  <td className="status">
                    <span className={`status-badge ${getStatusBadge(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="actions">
                      <EditActionButton onClick={() => handleEditVehicle(vehicle)} />
                      <DeleteActionButton onClick={() => handleDeleteVehicle(vehicle)} />
                      <ViewActionButton onClick={() => handleViewVehicle(vehicle)} />
                    </div>
                  </td>
                </tr>
              ))}
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

      {selectedVehicle && (
        <ViewModal
          isOpen={isViewModalOpen}
          title="Vehicle Details"
          onClose={closeViewModal}
          maxWidth="720px">
          <div className="view-modal-details-grid">
            {isViewLoading && (
              <div className="view-modal-detail-item full-width">
                <label>Loading:</label>
                <span>Fetching full vehicle details...</span>
              </div>
            )}
            <div className="view-modal-detail-item">
              <label>Record ID:</label>
              <span>#{selectedVehicle.id}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Vehicle ID:</label>
              <span>{selectedVehicle.vehicle_id || '--'}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Brand:</label>
              <span>{selectedVehicle.vehicle_brand || '--'}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Model:</label>
              <span>{selectedVehicle.vehicle_model || '--'}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Vehicle Type:</label>
              <span>{selectedVehicle.vehicle_type || '--'}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Plate Number:</label>
              <span>{selectedVehicle.plate_number || '--'}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Status:</label>
              <span>{selectedVehicle.status || '--'}</span>
            </div>
            <div className="view-modal-detail-item full-width">
              <label>Description:</label>
              <span>{selectedVehicle.description || '--'}</span>
            </div>
          </div>
        </ViewModal>
      )}

      <AddEditModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveVehicle}
        title={modalMode === 'add' ? 'Add New Vehicle' : 'Edit Vehicle'}
        fields={vehicleFields}
        initialData={editingVehicle || {}}
        mode={modalMode}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteVehicle}
        title="Delete Vehicle"
        message={`Are you sure you want to delete vehicle ${vehicleToDelete?.vehicle_id}?`}
      />
    </>
  )
}

export default Vehicles




