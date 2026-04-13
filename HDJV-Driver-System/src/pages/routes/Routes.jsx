import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './Routes.css'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import ViewModal from '../../components/modals/ViewModal/ViewModal'
import EditActionButton from '../../components/ActionButtons/EditActionButton'
import DeleteActionButton from '../../components/ActionButtons/DeleteActionButton'
import ViewActionButton from '../../components/ActionButtons/ViewActionButton'
import { fetchTrips, fetchTripsAll, API_BASE_URL, deleteTrip, updateTrip, fetchRoutesSummary } from '../../utils/api/index.js'
import AddEditModal from '../../components/modals/AddEditModal/AddEditModal'
import { formatDate, formatDateTime, formatTime, formatLocalDate } from '../../utils/dateUtils'
import { useToast } from '../../components/Toast/ToastContext'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useDateTimeFormat } from '../../contexts/useDateTimeFormat'
import { useSearchParams } from 'react-router'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'

const parseOdometer = (value) => {
  if (!value) {
    return null
  }
  const match = String(value).match(/[\d.]+/)
  if (!match) {
    return null
  }
  const parsed = Number(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

const toDateInputValue = (dateValue) => {
  if (!dateValue) {
    return ''
  }
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('en-CA')
}

const normalizePassengers = (passengers) => {
  if (!Array.isArray(passengers)) {
    return []
  }
  return passengers
    .map((passenger) => {
      if (passenger && typeof passenger === 'object') {
        return passenger.name || passenger.full_name || passenger.contact || null
      }
      if (passenger === null || passenger === undefined) {
        return null
      }
      return String(passenger)
    })
    .filter(Boolean)
}

const normalizeTrip = (trip) => {
  const passengers = normalizePassengers(trip.passengers)
  const startedAt = trip.started_at || null
  const completedAt = trip.completed_at || null
  const dateSource = startedAt || completedAt || trip.created_at || null
  const odometerStartValue = parseOdometer(trip.odometer_start)
  const odometerEndValue = parseOdometer(trip.odometer_end)
  const distance =
    odometerStartValue !== null && odometerEndValue !== null
      ? `${Math.max(odometerEndValue - odometerStartValue, 0)} km`
      : '--'

  return {
    id: trip.trip_id || trip.id,
    tripId: trip.trip_id || trip.id,
    startLocation: trip.start_location || '--',
    endLocation: trip.end_location || '--',
    distance,
    passengers,
    driver: trip.driver_name || '--',
    vehicleType: trip.vehicle_type || '--',
    plateNumber: trip.plate_number || '--',
    date: toDateInputValue(dateSource),
    status: trip.status || 'not_started',
    odometerStart: trip.odometer_start || '--',
    odometerEnd: trip.odometer_end || '--',
    proofPhotos: Array.isArray(trip.proof_photos) ? trip.proof_photos : [],
    dateSourceRaw: dateSource,
    startedAtRaw: startedAt,
    completedAtRaw: completedAt,
  }
}

const resolvePhotoUrl = (photo) => {
  if (photo.file_url) {
    return photo.file_url
  }
  if (photo.file_path) {
    return `${API_BASE_URL}/storage/${photo.file_path}`
  }
  return ''
}

const Routes = () => {
  const { t } = useLanguage()
  useDateTimeFormat()
  const [routes, setRoutes] = useState([])
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [editingRoute, setEditingRoute] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [routeToDelete, setRouteToDelete] = useState(null)
  const [selectedVehicleType, setSelectedVehicleType] = useState('all')
  const [selectedPassengerStatus, setSelectedPassengerStatus] = useState('all')
  const today = formatLocalDate(new Date())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [debouncedDateFrom, setDebouncedDateFrom] = useState('')
  const [debouncedDateTo, setDebouncedDateTo] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'started_at', direction: 'desc' })
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)
  const [photoModalUrl, setPhotoModalUrl] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const [hasMore, setHasMore] = useState(true)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [analytics, setAnalytics] = useState({
    totalHours: 0,
    totalPassengers: 0,
    activeDrivers: 0,
    completedTrips: 0,
  })
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const tableWrapperRef = useRef(null)
  const lastFilterKeyRef = useRef('')
  const backendPageSize = 200
  const uiPageSize = 50
  const { showSuccess, showError } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')
  const hasAppliedDefaultDates = useRef(false)

  usePageHeader(t('pages.routesManagement'))

  const extractTripArray = (data) => {
    if (Array.isArray(data)) {
      return data
    }
    if (data && Array.isArray(data.data)) {
      return data.data
    }
    return []
  }

  const mergeUniqueRoutes = (current, incoming) => {
    const map = new Map()
    current.forEach((route) => {
      map.set(route.id, route)
    })
    const uniqueAdded = []
    incoming.forEach((route) => {
      if (!map.has(route.id)) {
        map.set(route.id, route)
        uniqueAdded.push(route)
      }
    })
    return { merged: Array.from(map.values()), addedCount: uniqueAdded.length }
  }

  const buildParamsString = (nextSearch, nextVehicleType, nextPassengerStatus, nextFrom, nextTo) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (nextVehicleType && nextVehicleType !== 'all') {
      params.set('vehicle', nextVehicleType)
    }
    if (nextPassengerStatus && nextPassengerStatus !== 'all') {
      params.set('passenger', nextPassengerStatus)
    }
    if (nextFrom) {
      params.set('from', nextFrom)
    }
    if (nextTo) {
      params.set('to', nextTo)
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
    const paramVehicle = searchParams.get('vehicle') ?? searchParams.get('vehicle_type')
    const paramPassenger = searchParams.get('passenger') ?? searchParams.get('passenger_status')
    const paramFrom = searchParams.get('from') ?? searchParams.get('date_from') ?? ''
    const paramTo = searchParams.get('to') ?? searchParams.get('date_to') ?? ''
    const nextVehicle = paramVehicle && paramVehicle !== 'all' ? paramVehicle : 'all'
    const nextPassenger = paramPassenger && paramPassenger !== 'all' ? paramPassenger : 'all'
    if (paramSearch !== searchTerm) setSearchTerm(paramSearch)
    if (paramSearch !== debouncedSearchTerm) setDebouncedSearchTerm(paramSearch)
    if (nextVehicle !== selectedVehicleType) setSelectedVehicleType(nextVehicle)
    if (nextPassenger !== selectedPassengerStatus) setSelectedPassengerStatus(nextPassenger)
    if (searchParams.has('from') || searchParams.has('date_from')) {
      if (paramFrom !== dateFrom) setDateFrom(paramFrom)
      if (paramFrom !== debouncedDateFrom) setDebouncedDateFrom(paramFrom)
    }
    if (searchParams.has('to') || searchParams.has('date_to')) {
      if (paramTo !== dateTo) setDateTo(paramTo)
      if (paramTo !== debouncedDateTo) setDebouncedDateTo(paramTo)
    }

    hasInitializedFromUrl.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (hasAppliedDefaultDates.current) return
    const currentString = searchParams.toString()
    if (currentString !== '') {
      hasAppliedDefaultDates.current = true
      return
    }
    const nextFrom = today
    const nextTo = today
    setDateFrom(nextFrom)
    setDateTo(nextTo)
    setDebouncedDateFrom(nextFrom)
    setDebouncedDateTo(nextTo)
    const nextString = buildParamsString(
      debouncedSearchTerm,
      selectedVehicleType,
      selectedPassengerStatus,
      nextFrom,
      nextTo
    )
    if (nextString && nextString !== currentString) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
    hasAppliedDefaultDates.current = true
  }, [
    searchParams,
    today,
    debouncedSearchTerm,
    selectedVehicleType,
    selectedPassengerStatus,
    setSearchParams
  ])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedDateFrom(dateFrom)
      setDebouncedDateTo(dateTo)
    }, 300)
    return () => clearTimeout(timeout)
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!hasInitializedFromUrl.current) return
    const nextString = buildParamsString(
      debouncedSearchTerm,
      selectedVehicleType,
      selectedPassengerStatus,
      debouncedDateFrom,
      debouncedDateTo
    )
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [
    debouncedSearchTerm,
    selectedVehicleType,
    selectedPassengerStatus,
    debouncedDateFrom,
    debouncedDateTo,
    searchParams,
    setSearchParams
  ])

  useEffect(() => {
    let isMounted = true
    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      try {
        const summary = await fetchRoutesSummary()
        if (!isMounted) return
        setAnalytics({
          totalHours: Number(summary?.total_hours ?? 0),
          totalPassengers: Number(summary?.total_passengers ?? 0),
          activeDrivers: Number(summary?.active_drivers ?? 0),
          completedTrips: Number(summary?.completed_trips ?? 0),
        })
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load routes analytics:', error)
        setAnalytics({
          totalHours: 0,
          totalPassengers: 0,
          activeDrivers: 0,
          completedTrips: 0,
        })
      } finally {
        if (isMounted) setAnalyticsLoading(false)
      }
    }

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      try {
        const filterParams = {
          ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
          ...(selectedPassengerStatus !== 'all' ? { passenger_status: selectedPassengerStatus } : {}),
          ...(debouncedDateFrom ? { date_from: debouncedDateFrom } : {}),
          ...(debouncedDateTo ? { date_to: debouncedDateTo } : {}),
        }
        const data = await fetchTrips(1, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        if (!isMounted) return
        const tripItems = Array.isArray(data) ? data : (data.items || [])
        const normalized = extractTripArray(tripItems).map(normalizeTrip)
        setRoutes(normalized)
        setVisibleCount(Math.min(uiPageSize, normalized.length))
        setBackendPage(1)
        const hasTotal = typeof data.total === 'number'
        const total = hasTotal ? data.total : normalized.length
        const pageIsFull = normalized.length === backendPageSize
        setTotalCount(total)
        setBackendHasMore(hasTotal ? normalized.length < total : pageIsFull)
        setHasMore(normalized.length > uiPageSize || normalized.length === backendPageSize)
        setErrorMessage('')
      } catch {
        if (!isMounted) return
        setRoutes([])
        setVisibleCount(0)
        setHasMore(false)
        setBackendHasMore(false)
        setErrorMessage('Unable to load routes from the server.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadFirstPage()

    return () => {
      isMounted = false
    }
  }, [
    debouncedSearchTerm,
    backendPageSize,
    uiPageSize,
    sortConfig,
    selectedVehicleType,
    selectedPassengerStatus,
    debouncedDateFrom,
    debouncedDateTo
  ])

  const getPassengerDisplay = (passengers = []) => {
    if (passengers.length === 0) {
      return '0'
    }
    return passengers.length.toString()
  }

  const truncateText = (text, maxLength) => {
    if (!text) {
      return '--'
    }
    if (text.length <= maxLength) {
      return text
    }
    return text.substring(0, maxLength) + '...'
  }

  const getVehicleTypeBadge = (vehicleType) => {
    const typeClasses = {
      Sedan: 'type-sedan',
      SUV: 'type-suv',
      Truck: 'type-truck',
      Van: 'type-van',
    }
    return typeClasses[vehicleType] || 'type-default'
  }

  const handleViewRoute = (route) => {
    setSelectedRoute(route)
    setIsViewModalOpen(true)
  }

  const closeViewModal = () => {
    setIsViewModalOpen(false)
    setSelectedRoute(null)
  }

  const openPhotoModal = (url) => {
    if (!url) return
    setPhotoModalUrl(url)
    setIsPhotoModalOpen(true)
  }

  const closePhotoModal = () => {
    setIsPhotoModalOpen(false)
    setPhotoModalUrl('')
  }

  const handleEditRoute = (route) => {
    // Find the original raw trip data from the routes list if needed, 
    // or just use the normalized route and map it back.
    // Normalized route has most fields we need.
    setEditingRoute(route)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingRoute(null)
  }

  const handleSaveRoute = async (formData) => {
    try {
      const tripData = {
        start_location: formData.startLocation,
        end_location: formData.endLocation,
        odometer_start: formData.odometerStart,
        odometer_end: formData.odometerEnd,
        status: formData.status,
        driver_name: formData.driver,
        vehicle_type: formData.vehicleType,
        plate_number: formData.plateNumber
      }

      const updatedTrip = await updateTrip(editingRoute.id, tripData)
      const normalized = normalizeTrip(updatedTrip)
      
      setRoutes(prev => prev.map(r => r.id === editingRoute.id ? normalized : r))
      setIsEditModalOpen(false)
      setEditingRoute(null)
      showSuccess('Route updated')
    } catch (error) {
      console.error('Failed to update route:', error)
      showError('Failed to update route')
    }
  }

  const handleDeleteRoute = (route) => {
    setRouteToDelete(route)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteRoute = async () => {
    if (!routeToDelete) return
    
    try {
      await deleteTrip(routeToDelete.id)
      setRoutes(prev => prev.filter(r => r.id !== routeToDelete.id))
      setIsDeleteModalOpen(false)
      setRouteToDelete(null)
      showSuccess('Route deleted')
    } catch (error) {
      console.error('Failed to delete route:', error)
      showError('Failed to delete route')
    }
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setRouteToDelete(null)
  }

  const vehicleTypeOptions = useMemo(() => {
    const types = new Set()
    routes.forEach((route) => {
      if (route.vehicleType && route.vehicleType !== '--') {
        types.add(route.vehicleType)
      }
    })
    return Array.from(types).sort()
  }, [routes])

  const filterKey = useMemo(
    () => `${selectedVehicleType}|${selectedPassengerStatus}|${debouncedDateFrom}|${debouncedDateTo}|${debouncedSearchTerm}|${sortConfig.key}|${sortConfig.direction}`,
    [selectedVehicleType, selectedPassengerStatus, debouncedDateFrom, debouncedDateTo, debouncedSearchTerm, sortConfig]
  )

  const filteredRoutes = useMemo(() => routes, [routes])

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

  const sortedRoutes = filteredRoutes

  const loadMoreRoutes = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      if (visibleCount < sortedRoutes.length) {
        const nextCount = Math.min(visibleCount + uiPageSize, sortedRoutes.length)
        setVisibleCount(nextCount)
        setHasMore(nextCount < sortedRoutes.length || backendHasMore)
        return
      }

      if (!backendHasMore) {
        setHasMore(false)
        return
      }

      const nextBackendPage = backendPage + 1
      const filterParams = {
        ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
        ...(selectedPassengerStatus !== 'all' ? { passenger_status: selectedPassengerStatus } : {}),
        ...(debouncedDateFrom ? { date_from: debouncedDateFrom } : {}),
        ...(debouncedDateTo ? { date_to: debouncedDateTo } : {}),
      }
      const data = await fetchTrips(nextBackendPage, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
      const tripItems = Array.isArray(data) ? data : (data.items || [])
      const normalized = extractTripArray(tripItems).map(normalizeTrip)
      if (normalized.length === 0) {
        setBackendHasMore(false)
        setHasMore(false)
        return
      }
      let addedCount = 0
      let mergedCount = 0
      setRoutes((prev) => {
        const { merged, addedCount: newCount } = mergeUniqueRoutes(prev, normalized)
        addedCount = newCount
        mergedCount = merged.length
        return merged
      })
      setBackendPage(nextBackendPage)
      const pageIsFull = normalized.length === backendPageSize
      setBackendHasMore(typeof data.total === 'number' ? mergedCount < data.total : pageIsFull)
      if (addedCount > 0) {
        setVisibleCount((prevCount) => prevCount + Math.min(uiPageSize, addedCount))
      }
      setHasMore(addedCount > 0 || pageIsFull)
      if (typeof data.total === 'number') {
        setTotalCount(data.total)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoading,
    isLoadingMore,
    hasMore,
    visibleCount,
    sortedRoutes.length,
    backendHasMore,
    backendPage,
    backendPageSize,
    uiPageSize,
    debouncedSearchTerm,
    sortConfig,
    debouncedDateFrom,
    debouncedDateTo,
    selectedVehicleType,
    selectedPassengerStatus
  ])

  const handleScroll = useCallback(() => {
    if (!tableWrapperRef.current || isLoading || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = tableWrapperRef.current
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    if (scrollPercentage > 0.9) {
      loadMoreRoutes()
    }
  }, [isLoading, hasMore, loadMoreRoutes])

  useEffect(() => {
    const tableWrapper = tableWrapperRef.current
    if (!tableWrapper) return

    tableWrapper.addEventListener('scroll', handleScroll)
    return () => {
      tableWrapper.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    if (lastFilterKeyRef.current === filterKey) return
    lastFilterKeyRef.current = filterKey
    const nextCount = Math.min(uiPageSize, sortedRoutes.length)
    setVisibleCount(nextCount)
    setHasMore(nextCount < sortedRoutes.length || backendHasMore)
  }, [filterKey, uiPageSize, sortedRoutes.length, backendHasMore])

  useEffect(() => {
    setHasMore(visibleCount < sortedRoutes.length || backendHasMore)
  }, [visibleCount, sortedRoutes.length, backendHasMore])

  const displayedRoutesList = sortedRoutes.slice(0, visibleCount)
  const displayedRouteCount = displayedRoutesList.length
  const routeDisplayStart = displayedRouteCount === 0 ? 0 : 1

  const exportColumns = useMemo(() => ([
    { label: 'Trip ID', value: (route) => route.tripId },
    { label: 'Start Location', value: (route) => route.startLocation || '--' },
    { label: 'End Location', value: (route) => route.endLocation || '--' },
    { label: 'Start Date', value: (route) => (route.startedAtRaw ? formatDate(route.startedAtRaw) : '--') },
    { label: 'Start Time', value: (route) => (route.startedAtRaw ? formatTime(route.startedAtRaw) : '--') },
    { label: 'End Date', value: (route) => (route.completedAtRaw ? formatDate(route.completedAtRaw) : '--') },
    { label: 'End Time', value: (route) => (route.completedAtRaw ? formatTime(route.completedAtRaw) : '--') },
    { label: 'Passengers', value: (route) => route.passengers?.length ?? 0 },
    { label: 'Driver', value: (route) => route.driver || '--' },
    { label: 'Vehicle Type', value: (route) => route.vehicleType || '--' },
    { label: 'Plate Number', value: (route) => route.plateNumber || '--' },
    { label: 'Status', value: (route) => route.status || '--' },
    { label: 'Distance', value: (route) => route.distance || '--' },
    { label: 'Odometer Start', value: (route) => route.odometerStart || '--' },
    { label: 'Odometer End', value: (route) => route.odometerEnd || '--' },
  ]), [])

  const dateRangeSuffix = useMemo(() => {
    if (debouncedDateFrom && debouncedDateTo) return `${debouncedDateFrom}-to-${debouncedDateTo}`
    if (debouncedDateFrom) return `from-${debouncedDateFrom}`
    if (debouncedDateTo) return `to-${debouncedDateTo}`
    return ''
  }, [debouncedDateFrom, debouncedDateTo])

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const filterParams = {
        ...(selectedVehicleType !== 'all' ? { vehicle_type: selectedVehicleType } : {}),
        ...(selectedPassengerStatus !== 'all' ? { passenger_status: selectedPassengerStatus } : {}),
        ...(debouncedDateFrom ? { date_from: debouncedDateFrom } : {}),
        ...(debouncedDateTo ? { date_to: debouncedDateTo } : {}),
        ...(sortConfig?.key ? { sort_by: sortConfig.key } : {}),
        ...(sortConfig?.direction ? { sort_dir: sortConfig.direction } : {}),
      }
      const trips = await fetchTripsAll(debouncedSearchTerm, filterParams)
      const normalized = (Array.isArray(trips) ? trips : []).map(normalizeTrip)
      const baseName = `routes${dateRangeSuffix ? `-${dateRangeSuffix}` : ''}`
      exportRowsToCsv({
        rows: normalized,
        columns: exportColumns,
        filename: createCsvFilename(baseName, { includeDate: false })
      })
      showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export routes:', error)
      showError(error?.message || 'Failed to export routes.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="card-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="card-content">
            <h3>{analyticsLoading ? '-' : analytics.totalHours.toFixed(1)}</h3>
            <p>Total Hours Driven</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">
            <i className="bi bi-people"></i>
          </div>
          <div className="card-content">
            <h3>{analyticsLoading ? '-' : analytics.totalPassengers}</h3>
            <p>Total Passengers</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">
            <i className="bi bi-person-badge"></i>
          </div>
          <div className="card-content">
            <h3>{analyticsLoading ? '-' : analytics.activeDrivers}</h3>
            <p>Active Drivers</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">
            <i className="bi bi-check-circle"></i>
          </div>
          <div className="card-content">
            <h3>{analyticsLoading ? '-' : analytics.completedTrips}</h3>
            <p>Completed Trips</p>
          </div>
        </div>
      </div>

      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <div className="table-filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search routes..."
                className="search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <i className="bi bi-search search-icon"></i>
            </div>
            <div className="filter-group">
              <label htmlFor="route-vehicle-type">Vehicle Type</label>
              <select
                id="route-vehicle-type"
                className="filter-select"
                value={selectedVehicleType}
                onChange={(event) => setSelectedVehicleType(event.target.value)}>
                <option value="all">All Types</option>
                {vehicleTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="route-passenger-filter">Passengers</label>
              <select
                id="route-passenger-filter"
                className="filter-select"
                value={selectedPassengerStatus}
                onChange={(event) => setSelectedPassengerStatus(event.target.value)}>
                <option value="all">All Passengers</option>
                <option value="with">With Passengers</option>
                <option value="none">No Passengers</option>
              </select>
            </div>
          </div>
          <div className="table-actions-right">
            <div className="filter-group">
              <label htmlFor="route-date-from">Date From</label>
              <input
                type="date"
                id="route-date-from"
                className="filter-select"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              {dateFrom && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => setDateFrom('')}
                  title="Clear date from">
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
            <div className="filter-group">
              <label htmlFor="route-date-to">Date To</label>
              <input
                type="date"
                id="route-date-to"
                className="filter-select"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
              {dateTo && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => setDateTo('')}
                  title="Clear date to">
                  <i className="bi bi-x"></i>
                </button>
              )}
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

        <div className="table-wrapper table-wrapper-scroll" ref={tableWrapperRef}>
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('id')}>
                    ID <i className={getSortIcon('id')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('start_location')}>
                    Start Location <i className={getSortIcon('start_location')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('end_location')}>
                    End Location <i className={getSortIcon('end_location')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('started_at')}>
                    Start Date <i className={getSortIcon('started_at')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('completed_at')}>
                    End Date <i className={getSortIcon('completed_at')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('started_at')}>
                    Start Time <i className={getSortIcon('started_at')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('completed_at')}>
                    End Time <i className={getSortIcon('completed_at')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('passengers')}>
                    Passengers <i className={getSortIcon('passengers')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('driver_name')}>
                    Driver <i className={getSortIcon('driver_name')}></i>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="12" className="table-state">
                    Loading routes...
                  </td>
                </tr>
              )}
              {!isLoading && displayedRoutesList.length === 0 && (
                <tr>
                  <td colSpan="12" className="table-state">
                    No routes found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                displayedRoutesList.map((route, index) => (
                  <tr key={`${route.id}-${index}`}>
                    <td className="route-id">#{route.tripId}</td>
                    <td className="route-start-location">
                      {truncateText(route.startLocation, 12)}
                    </td>
                    <td className="route-end-location">
                      {truncateText(route.endLocation, 12)}
                    </td>
                    <td className="route-start-date">
                      {route.startedAtRaw ? formatDate(route.startedAtRaw) : '--'}
                    </td>
                    <td className="route-end-date">
                      {route.completedAtRaw ? formatDate(route.completedAtRaw) : '--'}
                    </td>
                    <td className="route-start-time">{route.startedAtRaw ? formatTime(route.startedAtRaw) : '--'}</td>
                    <td className="route-end-time">{route.completedAtRaw ? formatTime(route.completedAtRaw) : '--'}</td>
                    <td className="route-passengers">
                      <span className="passenger-names">
                        {getPassengerDisplay(route.passengers)}
                      </span>
                    </td>
                    <td className="route-driver">
                      {truncateText(route.driver, 15)}
                    </td>
                    <td className="route-vehicle-type">
                      <span
                        className={`vehicle-type-badge ${getVehicleTypeBadge(
                          route.vehicleType
                        )}`}>
                        {route.vehicleType}
                      </span>
                    </td>
                    <td className="route-plate-number">
                      <span className="plate-number-badge">
                        {route.plateNumber}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="actions">
                        <EditActionButton onClick={() => handleEditRoute(route)} />
                        <DeleteActionButton onClick={() => handleDeleteRoute(route)} />
                        <ViewActionButton onClick={() => handleViewRoute(route)} />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="table-info">
            Showing {routeDisplayStart} to {displayedRouteCount} of{' '}
            {totalCount} entries
          </div>
        </div>
      </div>

      {selectedRoute && (
        <ViewModal
          isOpen={isViewModalOpen}
          title="Route Details"
          onClose={closeViewModal}
          maxWidth="860px">
          <div className="view-modal-details-grid">
            <div className="view-modal-detail-item full-width">
              <div className="routes-view-section">
                <div className="routes-view-section-title">Trip Summary</div>
                <div className="routes-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Trip ID:</label>
                    <span>#{selectedRoute.tripId}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Status:</label>
                    <span>{selectedRoute.status}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Date:</label>
                    <span>{selectedRoute.dateSourceRaw ? formatDate(selectedRoute.dateSourceRaw) : '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Start Date:</label>
                    <span>{selectedRoute.startedAtRaw ? formatDate(selectedRoute.startedAtRaw) : '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>End Date:</label>
                    <span>{selectedRoute.completedAtRaw ? formatDate(selectedRoute.completedAtRaw) : '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="routes-view-section">
                <div className="routes-view-section-title">Route Details</div>
                <div className="routes-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Start Location:</label>
                    <span>{selectedRoute.startLocation}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>End Location:</label>
                    <span>{selectedRoute.endLocation}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Distance:</label>
                    <span>{selectedRoute.distance}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Start Time:</label>
                    <span>{selectedRoute.startedAtRaw ? formatTime(selectedRoute.startedAtRaw) : '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>End Time:</label>
                    <span>{selectedRoute.completedAtRaw ? formatTime(selectedRoute.completedAtRaw) : '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="routes-view-section">
                <div className="routes-view-section-title">Assignment</div>
                <div className="routes-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Driver:</label>
                    <span>{selectedRoute.driver}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Assigned Vehicle:</label>
                    <span>
                      {selectedRoute.plateNumber || selectedRoute.vehicleType
                        ? `${selectedRoute.vehicleType || '--'}${selectedRoute.plateNumber ? ` • ${selectedRoute.plateNumber}` : ''}`
                        : '--'}
                    </span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Model:</label>
                    <span>--</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Plate:</label>
                    <span>{selectedRoute.plateNumber || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Type:</label>
                    <span>{selectedRoute.vehicleType || '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="routes-view-section">
                <div className="routes-view-section-title">Odometer</div>
                <div className="routes-view-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Odometer Start:</label>
                    <span>{selectedRoute.odometerStart}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Odometer End:</label>
                    <span>{selectedRoute.odometerEnd}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="view-modal-detail-item full-width">
              <label>Passengers ({selectedRoute.passengers.length}):</label>
              <div className="passengers-display">
                {selectedRoute.passengers.length === 0 ? (
                  <div className="passenger-item">
                    <span className="passenger-number">1.</span>
                    <span className="passenger-name">No passengers listed</span>
                  </div>
                ) : (
                  <>
                    <div className="passenger-count">
                      {selectedRoute.passengers.length} passenger{selectedRoute.passengers.length !== 1 ? 's' : ''}
                    </div>
                    <div className="passenger-list">
                      {selectedRoute.passengers.map((passenger, index) => (
                        <div key={index} className="passenger-item">
                          <span className="passenger-number">{index + 1}.</span>
                          <span className="passenger-name">{passenger}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="view-modal-detail-item full-width">
              <label>
                Proof Photos ({selectedRoute.proofPhotos.length}):
              </label>
              <div className="proof-photos-grid">
                {selectedRoute.proofPhotos.length === 0 ? (
                  <span className="no-passengers">No proof photos</span>
                ) : (
                  selectedRoute.proofPhotos.map((photo) => {
                    const photoUrl = resolvePhotoUrl(photo)
                    const photoLabel = photo.captured_at
                      ? formatDateTime(photo.captured_at)
                      : 'Timestamp unavailable'
                    return (
                      <div
                        key={photo.id || photo.file_path || photo.captured_at}
                        className="proof-photo-card">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt="Proof"
                            className="proof-photo-image"
                            loading="lazy"
                            onClick={() => openPhotoModal(photoUrl)}
                            style={{ cursor: 'zoom-in' }}
                          />
                        ) : (
                          <div className="proof-photo-placeholder">
                            No preview
                          </div>
                        )}
                        <div className="proof-photo-meta">
                          <span>{photoLabel}</span>
                          <span>{photo.location || 'Location unavailable'}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </ViewModal>
      )}

      {isPhotoModalOpen && (
        <div className="view-modal-overlay" onClick={closePhotoModal}>
          <div
            className="view-modal-container"
            style={{ maxWidth: '95vw', background: 'transparent', boxShadow: 'none', border: 'none' }}>
            <div style={{ position: 'relative' }}>
              <button
                aria-label="Close"
                className="view-modal-close-btn"
                onClick={closePhotoModal}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  width: 44,
                  height: 44,
                  borderRadius: '9999px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={photoModalUrl}
                alt="Proof Full"
                style={{ maxWidth: '95vw', maxHeight: '85vh', objectFit: 'contain', background: '#000' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteRoute}
        title="Delete Route"
        message={`Are you sure you want to delete the route #${routeToDelete?.tripId}?`}
      />

      <AddEditModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onSave={handleSaveRoute}
        title="Edit Route"
        mode="edit"
        initialData={editingRoute || {}}
        fields={[
          { name: 'startLocation', label: 'Start Location', type: 'text', required: true },
          { name: 'endLocation', label: 'End Location', type: 'text', required: true },
          { name: 'odometerStart', label: 'Odometer Start', type: 'text' },
          { name: 'odometerEnd', label: 'Odometer End', type: 'text' },
          { 
            name: 'status', 
            label: 'Status', 
            type: 'select', 
            options: [
              { value: 'not_started', label: 'Not Started' },
              { value: 'started', label: 'Started' },
              { value: 'completed', label: 'Completed' }
            ] 
          },
          { name: 'driver', label: 'Driver Name', type: 'text' },
          { name: 'vehicleType', label: 'Vehicle Type', type: 'text' },
          { name: 'plateNumber', label: 'Plate Number', type: 'text' }
        ]}
      />
    </>
  )
}

export default Routes


