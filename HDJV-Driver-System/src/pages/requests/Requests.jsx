import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { assignRequest, decideRequest, fetchRequestById, fetchRequests, fetchRequestsAll, fetchUsersAll, fetchVehiclesAll } from '../../utils/api/index.js'
import { formatDateTime, formatDate, formatTime, toUtcEndOfLocalDate, toUtcStartOfLocalDate } from '../../utils/dateUtils'
import { useToast } from '../../components/Toast/ToastContext'
import { useSearchParams } from 'react-router'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import ViewModal from '../../components/modals/ViewModal/ViewModal'
import AssignDriverModal from '../../components/modals/AssignDriverModal/AssignDriverModal'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useDateTimeFormat } from '../../contexts/useDateTimeFormat'
import AcceptActionButton from '../../components/ActionButtons/AcceptActionButton'
import RejectActionButton from '../../components/ActionButtons/RejectActionButton'
import AssignActionButton from '../../components/ActionButtons/AssignActionButton'
import ViewActionButton from '../../components/ActionButtons/ViewActionButton'
import { useLazyTable } from '../../hooks/useLazyTable'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import './Requests.css'

const Requests = () => {
  const { t } = useLanguage()
  useDateTimeFormat()
  const { showSuccess, showError } = useToast()
  const [requests, setRequests] = useState([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [isAssignLoading, setIsAssignLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [couponFilter, setCouponFilter] = useState('all')
  const [requestedFrom, setRequestedFrom] = useState('')
  const [requestedTo, setRequestedTo] = useState('')
  const [debouncedRequestedFrom, setDebouncedRequestedFrom] = useState('')
  const [debouncedRequestedTo, setDebouncedRequestedTo] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' })
  const [totalCount, setTotalCount] = useState(0)
  const [hasTotal, setHasTotal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false)
  const [decisionType, setDecisionType] = useState(null)
  const [decisionTarget, setDecisionTarget] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [isViewLoading, setIsViewLoading] = useState(false)
  const timelineRef = useRef(null)
  const [timelineWidth, setTimelineWidth] = useState(0)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')
  const silentRefreshInFlightRef = useRef(false)

  usePageHeader(t('pages.requestsManagement'))

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])

  const isKradmin = currentUser?.role === 'kradmin'
  const isGaadmin = currentUser?.role === 'gaadmin'

  const backendPageSize = 200

  const buildParamsString = (nextSearch, nextStatus, nextCoupon, nextFrom, nextTo) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) {
      params.set('search', trimmedSearch)
    }
    if (nextStatus && nextStatus !== 'all') {
      params.set('status', nextStatus)
    }
    if (nextCoupon && nextCoupon !== 'all') {
      params.set('coupon', nextCoupon)
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
    const paramStatus = searchParams.get('status')
    const paramCoupon = searchParams.get('coupon')
    const paramFrom = searchParams.get('from') ?? searchParams.get('requested_from') ?? ''
    const paramTo = searchParams.get('to') ?? searchParams.get('requested_to') ?? ''
    const nextStatus = paramStatus && paramStatus !== 'all' ? paramStatus : 'all'
    const nextCoupon = paramCoupon && paramCoupon !== 'all' ? paramCoupon : 'all'
    if (paramSearch !== searchTerm) setSearchTerm(paramSearch)
    if (paramSearch !== debouncedSearchTerm) setDebouncedSearchTerm(paramSearch)
    if (nextStatus !== statusFilter) setStatusFilter(nextStatus)
    if (nextCoupon !== couponFilter) setCouponFilter(nextCoupon)
    if (searchParams.has('from') || searchParams.has('requested_from')) {
      if (paramFrom !== requestedFrom) setRequestedFrom(paramFrom)
      if (paramFrom !== debouncedRequestedFrom) setDebouncedRequestedFrom(paramFrom)
    }
    if (searchParams.has('to') || searchParams.has('requested_to')) {
      if (paramTo !== requestedTo) setRequestedTo(paramTo)
      if (paramTo !== debouncedRequestedTo) setDebouncedRequestedTo(paramTo)
    }
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
    const timeout = setTimeout(() => {
      setDebouncedRequestedFrom(requestedFrom)
      setDebouncedRequestedTo(requestedTo)
    }, 300)
    return () => clearTimeout(timeout)
  }, [requestedFrom, requestedTo])

  useEffect(() => {
    if (!hasInitializedFromUrl.current) return
    const nextString = buildParamsString(
      debouncedSearchTerm,
      statusFilter,
      couponFilter,
      debouncedRequestedFrom,
      debouncedRequestedTo
    )
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [
    debouncedSearchTerm,
    statusFilter,
    couponFilter,
    debouncedRequestedFrom,
    debouncedRequestedTo,
    searchParams,
    setSearchParams
  ])

  const mergeUniqueRequests = useCallback((current, incoming) => {
    const map = new Map()
    current.forEach((req) => {
      map.set(req.id, req)
    })
    const uniqueAdded = []
    incoming.forEach((req) => {
      if (!map.has(req.id)) {
        map.set(req.id, req)
        uniqueAdded.push(req)
      }
    })
    return { merged: Array.from(map.values()), addedCount: uniqueAdded.length }
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      try {
        const filterParams = {
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(couponFilter !== 'all' ? { coupon: couponFilter } : {}),
          ...(debouncedRequestedFrom ? { requested_from: toUtcStartOfLocalDate(debouncedRequestedFrom) } : {}),
          ...(debouncedRequestedTo ? { requested_to: toUtcEndOfLocalDate(debouncedRequestedTo) } : {}),
        }
        const reqs = await fetchRequests(1, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        if (!isMounted) return
        setRequests(Array.isArray(reqs) ? reqs : reqs.items || [])
        const hasTotalResponse = typeof reqs.total === 'number'
        setTotalCount(hasTotalResponse ? reqs.total : (Array.isArray(reqs) ? reqs.length : 0))
        setHasTotal(hasTotalResponse)
        // Drivers/vehicles are loaded on-demand when assign modal opens.
        setBackendPage(1)
        const firstPageCount = Array.isArray(reqs) ? reqs.length : (reqs.items ? reqs.items.length : 0)
        const total = hasTotalResponse ? reqs.total : firstPageCount
        const pageIsFull = firstPageCount === backendPageSize
        setBackendHasMore(hasTotalResponse ? firstPageCount < total : pageIsFull)
        setErrorMessage('')
      } catch (err) {
        if (!isMounted) return
        setRequests([])
        setBackendHasMore(false)
        setErrorMessage(err?.message || 'Unable to load requests.')
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
    sortConfig,
    statusFilter,
    couponFilter,
    debouncedRequestedFrom,
    debouncedRequestedTo
  ])

  useEffect(() => {
    const refreshFirstPageSilently = async () => {
      if (silentRefreshInFlightRef.current) return
      if (isLoading || isLoadingMore) return
      if (backendPage > 1) return
      if (typeof document !== 'undefined' && document.hidden) return

      silentRefreshInFlightRef.current = true
      try {
        const filterParams = {
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(couponFilter !== 'all' ? { coupon: couponFilter } : {}),
          ...(debouncedRequestedFrom ? { requested_from: toUtcStartOfLocalDate(debouncedRequestedFrom) } : {}),
          ...(debouncedRequestedTo ? { requested_to: toUtcEndOfLocalDate(debouncedRequestedTo) } : {}),
        }
        const reqs = await fetchRequests(1, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        const incoming = Array.isArray(reqs) ? reqs : reqs.items || []
        setRequests(incoming)

        const hasTotalResponse = typeof reqs.total === 'number'
        const firstPageCount = incoming.length
        const total = hasTotalResponse ? reqs.total : firstPageCount
        const pageIsFull = firstPageCount === backendPageSize

        setHasTotal(hasTotalResponse)
        setTotalCount(hasTotalResponse ? reqs.total : firstPageCount)
        setBackendHasMore(hasTotalResponse ? firstPageCount < total : pageIsFull)
        setErrorMessage('')
      } catch (err) {
        console.error('Background refresh failed:', err)
      } finally {
        silentRefreshInFlightRef.current = false
      }
    }

    const intervalId = setInterval(() => {
      refreshFirstPageSilently()
    }, 1000)

    return () => clearInterval(intervalId)
  }, [
    isLoading,
    isLoadingMore,
    backendPage,
    statusFilter,
    couponFilter,
    debouncedRequestedFrom,
    debouncedRequestedTo,
    backendPageSize,
    debouncedSearchTerm,
    sortConfig,
  ])

  const filteredRequests = useMemo(() => {
    const trimmedSearch = debouncedSearchTerm.trim()
    if (!trimmedSearch) return requests
    if (/^\d+$/.test(trimmedSearch)) {
      return requests.filter((req) => String(req.id ?? '').includes(trimmedSearch))
    }
    return requests
  }, [requests, debouncedSearchTerm])

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

  const sortedRequests = filteredRequests

  const resetKey = `${debouncedSearchTerm}|${statusFilter}|${couponFilter}|${debouncedRequestedFrom}|${debouncedRequestedTo}|${sortConfig.key}|${sortConfig.direction}`
  const {
    containerRef,
    visibleItems: displayedRequests,
  } = useLazyTable({
    items: sortedRequests,
    pageSize: 50,
    resetKey,
    hasMoreRemote: backendHasMore,
    onFetchMore: async () => {
      if (isLoading || isLoadingMore || !backendHasMore) return 0
      setIsLoadingMore(true)
      try {
        const nextPage = backendPage + 1
        const filterParams = {
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(couponFilter !== 'all' ? { coupon: couponFilter } : {}),
          ...(debouncedRequestedFrom ? { requested_from: toUtcStartOfLocalDate(debouncedRequestedFrom) } : {}),
          ...(debouncedRequestedTo ? { requested_to: toUtcEndOfLocalDate(debouncedRequestedTo) } : {}),
        }
        const data = await fetchRequests(nextPage, backendPageSize, debouncedSearchTerm, sortConfig, filterParams)
        const nextBatch = Array.isArray(data) ? data : (data.items || [])
        if (nextBatch.length === 0) {
          setBackendHasMore(false)
          return 0
        }
        let addedCount = 0
        let mergedCount = 0
        setRequests((prev) => {
          const { merged, addedCount: newCount } = mergeUniqueRequests(prev, nextBatch)
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
  const displayCount = Math.min(displayedRequests.length, sortedRequests.length)
  const displayedRequestsSafe = displayedRequests.slice(0, displayCount)

  const exportColumns = useMemo(() => ([
    { label: 'ID', value: (req) => req.id },
    { label: 'Requester', value: (req) => req.requester_name || '--' },
    { label: 'Departure', value: (req) => req.departure_place || '--' },
    { label: 'Destination', value: (req) => req.destination || '--' },
    { label: 'Purpose', value: (req) => req.purpose || '--' },
    { label: 'Passengers', value: (req) => req.persons ?? '--' },
    { label: 'Coupon', value: (req) => (req.used_coupon ? 'Used' : 'None') },
    { label: 'Status', value: (req) => String(req.status || '').replace('_', ' ') },
    { label: 'Requested For', value: (req) => (req.requested_at ? formatDateTime(req.requested_at) : '--') },
  ]), [])

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const filterParams = {
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(couponFilter !== 'all' ? { coupon: couponFilter } : {}),
        ...(debouncedRequestedFrom ? { requested_from: toUtcStartOfLocalDate(debouncedRequestedFrom) } : {}),
        ...(debouncedRequestedTo ? { requested_to: toUtcEndOfLocalDate(debouncedRequestedTo) } : {}),
        ...(sortConfig?.key ? { sort_by: sortConfig.key } : {}),
        ...(sortConfig?.direction ? { sort_dir: sortConfig.direction } : {}),
      }
      const allRequests = await fetchRequestsAll(debouncedSearchTerm, filterParams)
      exportRowsToCsv({
        rows: allRequests,
        columns: exportColumns,
        filename: createCsvFilename('requests')
      })
      showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export requests:', error)
      showError(error?.message || 'Failed to export requests.')
    } finally {
      setIsExporting(false)
    }
  }

  const openDecisionModal = (req, decision) => {
    setDecisionTarget(req)
    setDecisionType(decision)
    setIsDecisionModalOpen(true)
  }

  const closeDecisionModal = () => {
    setDecisionTarget(null)
    setDecisionType(null)
    setIsDecisionModalOpen(false)
  }

  const openViewModal = async (req) => {
    if (!req?.id) return
    setIsViewModalOpen(true)
    setIsViewLoading(true)
    try {
      const full = await fetchRequestById(req.id)
      setViewTarget(full)
    } catch (err) {
      console.error('Failed to load request details:', err)
      setViewTarget(req)
      showError(err?.message || 'Unable to load full request details.')
    } finally {
      setIsViewLoading(false)
    }
  }

  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const updateWidth = () => setTimelineWidth(el.clientWidth || 0)
    updateWidth()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isViewModalOpen, viewTarget?.id])

  const handleDecision = async () => {
    if (!decisionTarget || !decisionType) return
    try {
      const updated = await decideRequest(decisionTarget.id, decisionType)
      setRequests((prev) => prev.map((r) => (r.id === decisionTarget.id ? updated : r)))
      showSuccess(`Request ${decisionType}ed`)
      closeDecisionModal()
    } catch (err) {
      showError(err?.message || 'Failed to update request')
    }
  }

  const handleAssign = async (req, driverId, vehicleId) => {
    if (!driverId) {
      showError('Select a driver first')
      return
    }
    if (!vehicleId) {
      showError('Select a vehicle first')
      return
    }
    try {
      const updated = await assignRequest(req.id, driverId, vehicleId)
      setRequests((prev) => prev.map((r) => (r.id === req.id ? updated : r)))
      showSuccess('Driver assigned')
    } catch (err) {
      showError(err?.message || 'Failed to assign driver')
    }
  }

  const formatTimelineStatus = (status) => {
    const labels = {
      pending: 'Pending',
      accepted: 'Approved',
      rejected: 'Declined',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      completed: 'Completed',
    }
    return labels[status] || status
  }

  const buildTimelineSteps = (target) => {
    const histories = Array.isArray(target?.status_histories) ? target.status_histories : []
    const latest = histories.length > 0 ? histories[histories.length - 1]?.status : target?.status || 'pending'
    const isRejected = latest === 'rejected'
    const normalized = latest === 'in_progress' ? 'assigned' : latest
    const order = ['pending', isRejected ? 'rejected' : 'accepted', 'assigned', 'completed']
    const currentIndex = order.indexOf(normalized)
    const timestamps = {}
    const validTimestamps = {}
    histories.forEach((item) => {
      const key = String(item.status || '')
      if (timestamps[key]) return
      const raw = item.created_at || null
      if (raw) {
        const dt = new Date(raw)
        if (!Number.isNaN(dt.getTime())) {
          timestamps[key] = raw
          validTimestamps[key] = true
          return
        }
      }
      timestamps[key] = null
    })
    const steps = order.map((key, index) => ({
      key,
      label: formatTimelineStatus(key),
      done: Boolean(validTimestamps[key]) || (histories.length === 0 && currentIndex >= index && currentIndex !== -1),
      time: timestamps[key] || null,
    }))
    const lastDoneIndex = Math.max(
      0,
      ...steps.map((step, idx) => (step.time ? idx : -1))
    )
    return { steps, currentIndex, latest, lastDoneIndex }
  }

  useEffect(() => {
    if (!isAssignModalOpen) return
    if (drivers.length > 0 && vehicles.length > 0) return
    let isMounted = true
    const loadAssignData = async () => {
      setIsAssignLoading(true)
      try {
        const [users, vehiclesData] = await Promise.all([
          fetchUsersAll('', { role: 'driver' }),
          fetchVehiclesAll(),
        ])
        if (!isMounted) return
        setDrivers(Array.isArray(users) ? users : [])
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Failed to load assign data', error)
        showError('Unable to load drivers or vehicles.')
      } finally {
        if (isMounted) setIsAssignLoading(false)
      }
    }
    loadAssignData()
    return () => {
      isMounted = false
    }
  }, [isAssignModalOpen, drivers.length, vehicles.length, showError])

  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <div className="table-filters">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search requests..."
                className="search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <i className="bi bi-search search-icon"></i>
            </div>
            <div className="filter-group">
              <label htmlFor="request-status-filter">Status</label>
              <select
                id="request-status-filter"
                className="filter-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="request-coupon-filter">Coupon</label>
              <select
                id="request-coupon-filter"
                className="filter-select"
                value={couponFilter}
                onChange={(event) => setCouponFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="with">With Coupon</option>
                <option value="without">Without Coupon</option>
              </select>
            </div>
          </div>
          <div className="table-actions-right">
            <div className="filter-group">
              <label htmlFor="request-date-from">Requested From</label>
              <input
                id="request-date-from"
                type="date"
                className="filter-select"
                value={requestedFrom}
                onChange={(event) => setRequestedFrom(event.target.value)}
              />
              {requestedFrom && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => setRequestedFrom('')}
                  title="Clear requested from">
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
            <div className="filter-group">
              <label htmlFor="request-date-to">Requested To</label>
              <input
                id="request-date-to"
                type="date"
                className="filter-select"
                value={requestedTo}
                onChange={(event) => setRequestedTo(event.target.value)}
              />
              {requestedTo && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => setRequestedTo('')}
                  title="Clear requested to">
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

        <div className="table-wrapper table-wrapper-scroll" ref={containerRef}>
          <table className="data-table requests-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('id')}>
                    ID <i className={getSortIcon('id')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('requester_name')}>
                    Requester <i className={getSortIcon('requester_name')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('departure_place')}>
                    Departure <i className={getSortIcon('departure_place')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('destination')}>
                    Destination <i className={getSortIcon('destination')}></i>
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('purpose')}>
                    Purpose <i className={getSortIcon('purpose')}></i>
                  </button>
                </th>
                <th>Passenger</th>
                <th>Coupon</th>
                <th>Status</th>
                <th>
                  <button type="button" className="sort-header" onClick={() => handleSort('requested_at')}>
                    Requested For <i className={getSortIcon('requested_at')}></i>
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="10" className="table-state">
                    Loading requests...
                  </td>
                </tr>
              )}
              {!isLoading && displayedRequestsSafe.length === 0 && (
                <tr>
                  <td colSpan="10" className="table-state">
                    No requests found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                displayedRequestsSafe.map((req, index) => (
                  <tr key={`${req.id}-${index}`}>
                    <td className="request-id">#{req.id}</td>
                    <td>{req.requester_name}</td>
                    <td>{req.departure_place}</td>
                    <td>{req.destination}</td>
                    <td className="request-purpose">{req.purpose || '--'}</td>
                    <td>{req.persons}</td>
                    <td>
                      <span className={`coupon-badge ${
                        req.used_coupon ? 'coupon-used' : 'coupon-none'
                      }`}>
                        {req.used_coupon ? 'Used' : 'None'}
                      </span>
                    </td>
                    <td>
                      <span className={`request-status status-${req.status}`}>
                        {String(req.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td>{req.requested_at ? formatDateTime(req.requested_at) : '--'}</td>
                    <td className="actions-cell">
                      <div className="actions request-actions">
                        {isKradmin && req.status === 'pending' && (
                          <>
                            <AcceptActionButton onClick={() => openDecisionModal(req, 'accept')} />
                            <RejectActionButton onClick={() => openDecisionModal(req, 'reject')} />
                          </>
                        )}
                        {isGaadmin && req.status === 'accepted' && (
                          <>
                            <AssignActionButton
                              onClick={() => {
                                setAssignTarget(req)
                                setIsAssignModalOpen(true)
                              }}
                            />
                          </>
                        )}
                        <ViewActionButton onClick={() => openViewModal(req)} />
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

      <DeleteConfirmModal
        isOpen={isDecisionModalOpen}
        onClose={closeDecisionModal}
        onConfirm={handleDecision}
        title={`${decisionType === 'accept' ? 'Accept' : 'Reject'} Request`}
        message={`Are you sure you want to ${decisionType} request #${decisionTarget?.id}?`}
        confirmLabel={decisionType === 'accept' ? 'Accept' : 'Reject'}
        confirmIcon={decisionType === 'accept' ? 'bi bi-check-lg' : 'bi bi-x-lg'}
        confirmClassName={decisionType === 'accept' ? 'btn-success' : 'btn-danger'}
        icon={decisionType === 'accept' ? 'bi bi-check-circle' : 'bi bi-exclamation-triangle'}
        iconClassName={`confirm-icon ${decisionType === 'accept' ? 'confirm-icon--accept' : 'confirm-icon--reject'}`}
        showWarning={decisionType !== 'accept'}
      />

      <AssignDriverModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false)
          setAssignTarget(null)
        }}
        onAssign={(driverId, vehicleId) => {
          if (!assignTarget) return
          handleAssign(assignTarget, driverId, vehicleId)
        }}
        isLoading={isAssignLoading}
        drivers={drivers}
        vehicles={vehicles}
        requestLabel={assignTarget ? `#${assignTarget.id}` : ''}
      />

      {viewTarget && (
        <ViewModal
          isOpen={isViewModalOpen}
          title="Request Details"
          onClose={() => {
            setIsViewModalOpen(false)
            setViewTarget(null)
          }}
          maxWidth="760px">
          <div className="view-modal-details-grid">
            {isViewLoading && (
              <div className="view-modal-detail-item full-width">
                <label>Loading:</label>
                <span>Fetching full request details...</span>
              </div>
            )}
            <div className="view-modal-detail-item">
              <label>Request ID:</label>
              <span>#{viewTarget.id}</span>
            </div>
            <div className="view-modal-detail-item">
              <label>Status:</label>
              <span>{String(viewTarget.status || '').replace('_', ' ')}</span>
            </div>
            <div className="view-modal-detail-item full-width">
              <div className="status-timeline-card">
                <div className="status-timeline-title">Status Timeline</div>
                {(() => {
                  const { steps, currentIndex, latest, lastDoneIndex } = buildTimelineSteps(viewTarget)
                  if (!steps || steps.length === 0) {
                    return <div className="status-timeline-empty">No timeline available.</div>
                  }
                  const progressPct = steps.length > 1 && lastDoneIndex > 0
                    ? (lastDoneIndex / (steps.length - 1)) * 100
                    : 0
                  const rowPadding = 6
                  const stepCount = Math.max(steps.length, 1)
                  const stepItemWidth = timelineWidth > 0
                    ? Math.max((timelineWidth - rowPadding * 2) / stepCount, 0)
                    : 0
                  const lineInset = rowPadding + stepItemWidth / 2
                  const lineWidth = Math.max(timelineWidth - lineInset * 2, 0)
                  const progressWidth = lineWidth * (progressPct / 100)
                  const progressClass = latest === 'rejected'
                    ? 'status-timeline-progress status-timeline-progress--declined'
                    : 'status-timeline-progress status-timeline-progress--approved'
                  return (
                    <div className="status-timeline-stepper" ref={timelineRef}>
                      <div
                        className="status-timeline-line"
                        style={{ left: lineInset, width: lineWidth }}
                      />
                      {progressPct > 0 && (
                        <div
                          className={progressClass}
                          style={{ left: lineInset, width: progressWidth }}
                        />
                      )}
                      <div className="status-timeline-steps">
                        {steps.map((step) => {
                          const isDeclined = step.key === 'rejected' && latest === 'rejected'
                          const isTimed = Boolean(step.time)
                          const dotClass = isDeclined
                            ? 'status-timeline-dot status-timeline-dot--declined'
                            : isTimed
                              ? 'status-timeline-dot status-timeline-dot--done'
                              : 'status-timeline-dot status-timeline-dot--pending'
                          const labelClass = isDeclined
                            ? 'status-timeline-status status-timeline-status--declined'
                            : isTimed
                              ? 'status-timeline-status status-timeline-status--done'
                              : 'status-timeline-status status-timeline-status--pending'
                          return (
                            <div className="status-timeline-step" key={step.key}>
                              <span className={dotClass} />
                              <span className={labelClass}>{step.label}</span>
                              <span className="status-timeline-date">
                                {step.time ? formatDate(step.time) : '--'}
                              </span>
                              <span className="status-timeline-time">
                                {step.time ? formatTime(step.time) : '--'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="view-modal-detail-item full-width">
              <div className="view-modal-section">
                <div className="view-modal-section-title">Assigned Details</div>
                <div className="view-modal-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Assigned Driver:</label>
                    <span>
                      {viewTarget.assigned_driver
                        ? (viewTarget.assigned_driver.full_name ||
                          viewTarget.assigned_driver.name ||
                          viewTarget.assigned_driver.username ||
                          viewTarget.assigned_driver.email ||
                          '--')
                        : '--'}
                    </span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Assigned Vehicle:</label>
                    <span>
                      {viewTarget.assigned_vehicle
                        ? (
                          viewTarget.assigned_vehicle.vehicle_id ||
                          viewTarget.assigned_vehicle.plate_number ||
                          viewTarget.assigned_vehicle.vehicle_type ||
                          '--'
                        )
                        : '--'}
                    </span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Model:</label>
                    <span>{viewTarget.assigned_vehicle?.vehicle_model || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Plate:</label>
                    <span>{viewTarget.assigned_vehicle?.plate_number || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Vehicle Type:</label>
                    <span>{viewTarget.assigned_vehicle?.vehicle_type || '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="view-modal-detail-item full-width">
              <div className="view-modal-section">
                <div className="view-modal-section-title">Request Details</div>
                <div className="view-modal-section-grid">
                  <div className="view-modal-detail-item">
                    <label>Requester:</label>
                    <span>{viewTarget.requester_name}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Departure:</label>
                    <span>{viewTarget.departure_place}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Destination:</label>
                    <span>{viewTarget.destination}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Requested For:</label>
                    <span>{viewTarget.requested_at ? formatDateTime(viewTarget.requested_at) : '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Purpose:</label>
                    <span>{viewTarget.purpose || '--'}</span>
                  </div>
                  <div className="view-modal-detail-item">
                    <label>Coupon:</label>
                    <span>{viewTarget.used_coupon ? 'Used' : 'No coupon'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="view-modal-detail-item full-width">
              <div className="view-modal-section">
                <div className="view-modal-section-title">Passengers</div>
                <div className="passengers-display">
                  {viewTarget.passenger_names && viewTarget.passenger_names.length > 0 ? (
                    <>
                      <div className="passenger-count">
                        {viewTarget.passenger_names.length} passenger{viewTarget.passenger_names.length !== 1 ? 's' : ''}
                      </div>
                      <div className="passenger-list">
                        {viewTarget.passenger_names.map((name, index) => (
                          <div key={index} className="passenger-item">
                            <span className="passenger-number">{index + 1}.</span>
                            <span className="passenger-name">{name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="passenger-item">
                      <span className="passenger-number">1.</span>
                      <span className="passenger-name">{viewTarget.requester_name || 'No passengers listed'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ViewModal>
      )}
    </>
  )
}

export default Requests

