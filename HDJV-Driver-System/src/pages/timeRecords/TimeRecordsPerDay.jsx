import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { formatLocalDate } from '../../utils/dateUtils'
import { useNavigate, useSearchParams } from 'react-router'
import { deleteTimeRecord, fetchTimeRecordsPerDay, upsertTimeRecord } from '../../utils/api/index.js'
import { useLazyTable } from '../../hooks/useLazyTable'
import { useToast } from '../../components/Toast/ToastContext'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import './TimeRecordsPerDay.css'

const formatHours = (value) => {
  if (value === null || value === undefined) return '--'
  const num = Number(value)
  if (Number.isNaN(num)) return '--'
  return num.toFixed(2)
}

const normalizeTime = (value) => {
  if (!value) return ''
  if (value.length >= 5) return value.slice(0, 5)
  return value
}

const parseTimeToMinutes = (value) => {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

const calculateHours = (start, end) => {
  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)
  if (startMinutes === null || endMinutes === null) return null
  let diff = endMinutes - startMinutes
  if (diff < 0) diff += 24 * 60
  return diff / 60
}

const createRow = (item, index) => {
  const driver = item?.driver || {}
  const record = item?.record || {}
  const driverId = driver.id ?? item?.driver_id ?? null
  const rowId = driverId ?? `${item?.id ?? 'row'}-${record.id ?? index}`
  return {
    rowId,
    driver,
    driverId,
    recordId: record.id ?? null,
    regularIn: normalizeTime(record.regular_in),
    regularOut: normalizeTime(record.regular_out),
    otIn: normalizeTime(record.ot_in),
    otOut: normalizeTime(record.ot_out)
  }
}

const compareValues = (a, b) => {
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

const TimeRecordsPerDay = () => {
  const { t } = useLanguage()
  usePageHeader(t('pages.timeRecordsPerDay'))
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showSuccess, showError } = useToast()

  const today = formatLocalDate(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [debouncedSelectedDate, setDebouncedSelectedDate] = useState(today)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [backendPage, setBackendPage] = useState(1)
  const [backendHasMore, setBackendHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [hasTotal, setHasTotal] = useState(false)
  const [serverTotals, setServerTotals] = useState({ regular: 0, overtime: 0 })
  const [savingIds, setSavingIds] = useState(new Set())
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [errorMessage, setErrorMessage] = useState('')
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'driver', direction: 'asc' })
  const [savedSnapshots, setSavedSnapshots] = useState({})
  const lastSetParamsRef = useRef('')
  const backendPageSize = 200

  const buildParamsString = useCallback((nextDate, nextSearch) => {
    const nextParams = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (nextDate) {
      nextParams.set('date', nextDate)
    }
    if (trimmedSearch) {
      nextParams.set('search', trimmedSearch)
    }
    return nextParams.toString()
  }, [])

  const updateSearchParams = useCallback((nextDate, nextSearch) => {
    const nextString = buildParamsString(nextDate, nextSearch)
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [buildParamsString, searchParams, setSearchParams])

  useEffect(() => {
    const dateParam = searchParams.get('date')
    const searchParam = searchParams.get('search') ?? ''
    setSelectedDate(dateParam ?? today)
    setDebouncedSelectedDate(dateParam ?? today)
    setSearchTerm(searchParam)
    setDebouncedSearchTerm(searchParam)
    // Initialize from URL once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 250)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    updateSearchParams(debouncedSelectedDate, debouncedSearchTerm)
  }, [debouncedSearchTerm, debouncedSelectedDate, updateSearchParams])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSelectedDate(selectedDate)
    }, 300)
    return () => clearTimeout(timeout)
  }, [selectedDate])

  useEffect(() => {
    const currentString = searchParams.toString()
    if (currentString === lastSetParamsRef.current) {
      return
    }
    const dateParam = searchParams.get('date')
    const searchParam = searchParams.get('search') ?? ''
    setSelectedDate(dateParam ?? today)
    setSearchTerm(searchParam)
    setDebouncedSearchTerm(searchParam)
  }, [searchParams, today])
  const mergeUniqueRows = useCallback((current, incoming) => {
    const map = new Map()
    current.forEach((row) => {
      map.set(row.rowId, row)
    })
    let addedCount = 0
    incoming.forEach((row) => {
      if (!map.has(row.rowId)) {
        map.set(row.rowId, row)
        addedCount += 1
      }
    })
    return { merged: Array.from(map.values()), addedCount }
  }, [])

  useEffect(() => {
    if (!debouncedSelectedDate) {
      setRows([])
      setErrorMessage('')
      setLoading(false)
      setBackendHasMore(false)
      setTotalCount(0)
      setHasTotal(false)
      return
    }
    
    const abortController = new AbortController()
    const isMounted = { current: true }
    
    const loadFirstPage = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const data = await fetchTimeRecordsPerDay(debouncedSelectedDate, {
          page: 1,
          pageSize: backendPageSize,
          search: debouncedSearchTerm
        })
        
        // Check if component is still mounted and request wasn't aborted
        if (!isMounted.current || abortController.signal.aborted) return
        
        const items = Array.isArray(data) ? data : data.items || []
        const mapped = items.map(createRow)
        setRows(mapped)
        setSavedSnapshots(
          mapped.reduce((acc, row) => {
            acc[row.rowId] = {
              regularIn: row.regularIn,
              regularOut: row.regularOut,
              otIn: row.otIn,
              otOut: row.otOut
            }
            return acc
          }, {})
        )
        const hasTotalResponse = typeof data.total === 'number'
        setTotalCount(hasTotalResponse ? data.total : items.length)
        setHasTotal(hasTotalResponse)
        setBackendPage(1)
        const pageIsFull = items.length === backendPageSize
        setBackendHasMore(hasTotalResponse ? items.length < data.total : pageIsFull)
        if (data.totals && typeof data.totals.regular === 'number') {
          setServerTotals({
            regular: data.totals.regular,
            overtime: data.totals.overtime ?? 0
          })
        } else {
          setServerTotals({ regular: 0, overtime: 0 })
        }
      } catch (error) {
        // Don't update state if component is unmounted or request was aborted
        if (!isMounted.current || abortController.signal.aborted) return
        
        console.error('Failed to load today time records', error)
        setRows([])
        setBackendHasMore(false)
        setTotalCount(0)
        setHasTotal(false)
        setErrorMessage('Unable to load today time records.')
      } finally {
        // Only update loading state if component is still mounted
        if (isMounted.current && !abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }
    
    loadFirstPage()
    
    return () => {
      isMounted.current = false
      abortController.abort()
    }
  }, [debouncedSelectedDate, debouncedSearchTerm, backendPageSize])

  const totals = useMemo(() => {
    if (hasTotal) {
      return {
        regular: Number(serverTotals.regular || 0),
        overtime: Number(serverTotals.overtime || 0)
      }
    }
    return rows.reduce(
      (acc, row) => {
        const regularHours = calculateHours(row.regularIn, row.regularOut)
        const otHours = calculateHours(row.otIn, row.otOut)
        return {
          regular: acc.regular + (regularHours ?? 0),
          overtime: acc.overtime + (otHours ?? 0)
        }
      },
      { regular: 0, overtime: 0 }
    )
  }, [rows, hasTotal, serverTotals])

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

  const filteredRows = rows

  const sortedRows = useMemo(() => {
    const data = [...filteredRows]
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    data.sort((a, b) => {
      const getValue = (row) => {
        switch (sortConfig.key) {
          case 'driver':
            return row.driver?.full_name || ''
          case 'contact':
            return row.driver?.contact || ''
          case 'regularIn':
            return parseTimeToMinutes(row.regularIn)
          case 'regularOut':
            return parseTimeToMinutes(row.regularOut)
          case 'regularHours':
            return calculateHours(row.regularIn, row.regularOut)
          case 'otIn':
            return parseTimeToMinutes(row.otIn)
          case 'otOut':
            return parseTimeToMinutes(row.otOut)
          case 'otHours':
            return calculateHours(row.otIn, row.otOut)
          case 'active':
            return row.regularIn || row.regularOut || row.otIn || row.otOut ? 1 : 0
          default:
            return ''
        }
      }
      return compareValues(getValue(a), getValue(b)) * dir
    })
    return data
  }, [filteredRows, sortConfig])

  const resetKey = `${debouncedSearchTerm}|${sortConfig.key}|${sortConfig.direction}|${debouncedSelectedDate}`
  const {
    containerRef,
    visibleItems: displayedRows,
    visibleCount,
    hasMore,
    isLoadingMore: isLazyLoadingMore,
  } = useLazyTable({
    items: sortedRows,
    pageSize: 50,
    resetKey,
    hasMoreRemote: backendHasMore,
    onFetchMore: async () => {
      if (loading || isLoadingMore || !backendHasMore) return 0
      setIsLoadingMore(true)
      try {
        const nextPage = backendPage + 1
        const data = await fetchTimeRecordsPerDay(debouncedSelectedDate, {
          page: nextPage,
          pageSize: backendPageSize,
          search: debouncedSearchTerm
        })
        const items = Array.isArray(data) ? data : data.items || []
        if (items.length === 0) {
          setBackendHasMore(false)
          return 0
        }
        let addedCount = 0
        let mergedCount = 0
        const nextRows = items.map(createRow)
        setRows((prev) => {
          const { merged, addedCount: newCount } = mergeUniqueRows(prev, nextRows)
          addedCount = newCount
          mergedCount = merged.length
          return merged
        })
        if (nextRows.length > 0) {
          setSavedSnapshots((prev) => {
            const next = { ...prev }
            nextRows.forEach((row) => {
              if (!next[row.rowId]) {
                next[row.rowId] = {
                  regularIn: row.regularIn,
                  regularOut: row.regularOut,
                  otIn: row.otIn,
                  otOut: row.otOut
                }
              }
            })
            return next
          })
        }
        setBackendPage(nextPage)
        if (typeof data.total === 'number') {
          setTotalCount(data.total)
          setBackendHasMore(mergedCount < data.total)
          setHasTotal(true)
        } else {
          setTotalCount(mergedCount)
          setBackendHasMore(items.length === backendPageSize && addedCount > 0)
          setHasTotal(false)
        }
        return addedCount
      } finally {
        setIsLoadingMore(false)
      }
    },
  })
  const showLoadingMore = isLazyLoadingMore || isLoadingMore
  const displayCount = Math.min(visibleCount, sortedRows.length)

  const exportColumns = useMemo(() => ([
    { label: 'Date', value: () => selectedDate || '--' },
    { label: 'Driver', value: (row) => row.driver?.full_name || (row.driver?.id ? `Driver #${row.driver.id}` : 'Unknown driver') },
    { label: 'Contact', value: (row) => row.driver?.contact || '--' },
    { label: 'Time In', value: (row) => row.regularIn || '--' },
    { label: 'Time Out', value: (row) => row.regularOut || '--' },
    { label: 'Regular Hours', value: (row) => formatHours(calculateHours(row.regularIn, row.regularOut)) },
    { label: 'OT In', value: (row) => row.otIn || '--' },
    { label: 'OT Out', value: (row) => row.otOut || '--' },
    { label: 'OT Hours', value: (row) => formatHours(calculateHours(row.otIn, row.otOut)) },
    { label: 'Active Today', value: (row) => (row.regularIn || row.regularOut || row.otIn || row.otOut ? 'Active' : 'Inactive') },
  ]), [selectedDate])

  const handleUpdate = (rowId, field, value) => {
    setRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)))
  }

  const clearRowValues = useCallback((rowId) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              recordId: null,
              regularIn: '',
              regularOut: '',
              otIn: '',
              otOut: ''
            }
          : row
      )
    )
    setSavedSnapshots((prev) => ({
      ...prev,
      [rowId]: {
        regularIn: '',
        regularOut: '',
        otIn: '',
        otOut: ''
      }
    }))
  }, [])

  const handleDeleteRow = async (row) => {
    if (!selectedDate) {
      setErrorMessage('Please select a date before clearing.')
      return
    }
    if (!row.recordId) {
      clearRowValues(row.rowId)
      showSuccess('Time record cleared.')
      return
    }

    setDeletingIds((prev) => new Set(prev).add(row.rowId))
    setErrorMessage('')
    try {
      await deleteTimeRecord(row.recordId)
      clearRowValues(row.rowId)
      showSuccess('Time record cleared.')
    } catch (error) {
      console.error('Failed to delete time record', error)
      setErrorMessage('Unable to delete time record.')
      showError('Unable to delete time record.')
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.rowId)
        return next
      })
    }
  }

  const openDeleteModal = (row) => {
    setDeleteTarget(row)
    setIsDeleteOpen(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const handleSaveRow = async (row) => {
    if (!selectedDate) {
      setErrorMessage('Please select a date before saving.')
      return
    }
    if (!row.driverId) {
      setErrorMessage('Unable to save: missing driver.')
      return
    }
    
    const abortController = new AbortController()
    const isMounted = { current: true }
    
    setSavingIds((prev) => new Set(prev).add(row.rowId))
    setErrorMessage('')
    try {
      const saved = await upsertTimeRecord({
        driver_id: Number(row.driverId),
        record_date: selectedDate,
        regular_in: row.regularIn || null,
        regular_out: row.regularOut || null,
        ot_in: row.otIn || null,
        ot_out: row.otOut || null
      })
      
      // Check if component is still mounted and request wasn't aborted
      if (!isMounted.current || abortController.signal.aborted) return
      
      setRows((prev) =>
        prev.map((item) =>
          item.rowId === row.rowId
            ? {
                ...item,
                recordId: saved.id ?? item.recordId,
                regularIn: normalizeTime(saved.regular_in),
                regularOut: normalizeTime(saved.regular_out),
                otIn: normalizeTime(saved.ot_in),
                otOut: normalizeTime(saved.ot_out)
              }
            : item
        )
      )
      setSavedSnapshots((prev) => ({
        ...prev,
        [row.rowId]: {
          regularIn: normalizeTime(saved.regular_in),
          regularOut: normalizeTime(saved.regular_out),
          otIn: normalizeTime(saved.ot_in),
          otOut: normalizeTime(saved.ot_out)
        }
      }))
      
      // Show success toast notification
      showSuccess('Time record saved successfully!')
    } catch (error) {
      // Don't update state if component is unmounted or request was aborted
      if (!isMounted.current || abortController.signal.aborted) return
      
      console.error('Failed to save time record', error)
      setErrorMessage('Unable to save time record.')
    } finally {
      // Only update saving state if component is still mounted
      if (isMounted.current && !abortController.signal.aborted) {
        setSavingIds((prev) => {
          const next = new Set(prev)
          next.delete(row.rowId)
          return next
        })
      }
    }
  }

  const [isExporting, setIsExporting] = useState(false)

  const fetchAllRowsForExport = async () => {
    const allRows = []
    if (!debouncedSelectedDate) return allRows
    const maxPages = 50
    let page = 1
    let totalPages = maxPages
    while (page <= totalPages && page <= maxPages) {
      const data = await fetchTimeRecordsPerDay(debouncedSelectedDate, {
        page,
        pageSize: backendPageSize,
        search: debouncedSearchTerm
      })
      const items = Array.isArray(data) ? data : data.items || []
      allRows.push(...items.map(createRow))
      if (typeof data.total === 'number') {
        totalPages = Math.ceil(data.total / backendPageSize)
      } else if (items.length < backendPageSize) {
        break
      }
      page += 1
    }
    return allRows
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const exportRows = await fetchAllRowsForExport()
      const filename = createCsvFilename(`time-records-${selectedDate || 'per-day'}`, { includeDate: false })
      exportRowsToCsv({
        rows: exportRows,
        columns: exportColumns,
        filename
      })
      showSuccess('Export complete.')
    } catch (error) {
      console.error('Failed to export time records:', error)
      showError(error?.message || 'Failed to export time records.')
    } finally {
      setIsExporting(false)
    }
  }

  const isRowDirty = (row) => {
    const snapshot = savedSnapshots[row.rowId]
    if (!snapshot) {
      return Boolean(row.regularIn || row.regularOut || row.otIn || row.otOut)
    }
    return (
      snapshot.regularIn !== row.regularIn ||
      snapshot.regularOut !== row.regularOut ||
      snapshot.otIn !== row.otIn ||
      snapshot.otOut !== row.otOut
    )
  }

  return (
    <div className="table-container">
      <div className="table-actions time-records-actions">
        <div className="time-records-summary">
          <div>
            <span className="summary-label">Total Regular Hours</span>
            <span className="summary-value">{totals.regular.toFixed(2)}</span>
          </div>
          <div>
            <span className="summary-label">Total OT Hours</span>
            <span className="summary-value">{totals.overtime.toFixed(2)}</span>
          </div>
        <div className="filter-group">
            <label htmlFor="search-driver">Search</label>
            <div className="search-box">
              <input
                id="search-driver"
                type="text"
                placeholder="Search drivers..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => updateSearchParams(selectedDate, searchTerm)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSearchParams(selectedDate, searchTerm)
                  }
                }}
              />
              <i className="bi bi-search search-icon"></i>
            </div>
          </div>
        </div>
        <div className="time-records-buttons">
          <div className="filter-group">
            <label>View</label>
            <div className="time-records-toggle">
              <button
                type="button"
                className="toggle-btn"
                onClick={() => navigate('/time-records')}
              >
                Per Driver
              </button>
              <button
                type="button"
                className="toggle-btn active"
                onClick={() => navigate('/time-records/per-day')}
              >
                Per Day
              </button>
            </div>
          </div>
          <div className="filter-group">
            <label htmlFor="today-date">Date</label>
            <input
              id="today-date"
              type="date"
              className="filter-select"
              value={selectedDate}
              onChange={(e) => {
                const nextDate = e.target.value
                setSelectedDate(nextDate)
                updateSearchParams(nextDate, searchTerm)
              }}
            />
            {selectedDate && (
              <button
                type="button"
                className="clear-date-btn"
                onClick={() => {
                  setSelectedDate('')
                  updateSearchParams('', searchTerm)
                }}
                title="Clear date">
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleExport}
            disabled={isExporting || loading}
            title="Download all rows as Excel-compatible CSV"
          >
            <i className="bi bi-file-earmark-excel"></i>
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-wrapper table-wrapper-scroll time-records-table-wrapper" ref={containerRef}>
        <table className="data-table time-records-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('driver')}>
                  Driver <i className={getSortIcon('driver')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('contact')}>
                  Contact <i className={getSortIcon('contact')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('regularIn')}>
                  Time In <i className={getSortIcon('regularIn')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('regularOut')}>
                  Time Out <i className={getSortIcon('regularOut')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('regularHours')}>
                  Total Regular Hours <i className={getSortIcon('regularHours')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('otIn')}>
                  OT In <i className={getSortIcon('otIn')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('otOut')}>
                  OT Out <i className={getSortIcon('otOut')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('otHours')}>
                  Total OT Hours <i className={getSortIcon('otHours')}></i>
                </button>
              </th>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('active')}>
                  Active Today <i className={getSortIcon('active')}></i>
                </button>
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="10" className="table-state">Loading time records...</td>
              </tr>
            )}
            {!loading && displayedRows.length === 0 && (
              <tr>
                <td colSpan="10" className="table-state">No records found.</td>
              </tr>
            )}
            {showLoadingMore && (
              <tr>
                <td colSpan="10" className="table-state">Loading more...</td>
              </tr>
            )}
            {displayedRows.map((row) => {
              const isActive = !!(row.regularIn || row.regularOut || row.otIn || row.otOut)
              const driver = row.driver || {}
              const regularHours = calculateHours(row.regularIn, row.regularOut)
              const otHours = calculateHours(row.otIn, row.otOut)
              const isSaving = savingIds.has(row.rowId)
              const isDeleting = deletingIds.has(row.rowId)
              const isDirty = isRowDirty(row)
              return (
                <tr key={row.rowId}>
                  <td>{driver.full_name || (driver.id ? `Driver #${driver.id}` : 'Unknown driver')}</td>
                  <td>{driver.contact || '--'}</td>
                  <td>
                    <input
                      type="time"
                      value={row.regularIn}
                      onChange={(e) => handleUpdate(row.rowId, 'regularIn', e.target.value)}
                      className="time-input"
                      disabled={!selectedDate}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.regularOut}
                      onChange={(e) => handleUpdate(row.rowId, 'regularOut', e.target.value)}
                      className="time-input"
                      disabled={!selectedDate}
                    />
                  </td>
                  <td className="hours-cell">{formatHours(regularHours)}</td>
                  <td>
                    <input
                      type="time"
                      value={row.otIn}
                      onChange={(e) => handleUpdate(row.rowId, 'otIn', e.target.value)}
                      className="time-input"
                      disabled={!selectedDate}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.otOut}
                      onChange={(e) => handleUpdate(row.rowId, 'otOut', e.target.value)}
                      className="time-input"
                      disabled={!selectedDate}
                    />
                  </td>
                  <td className="hours-cell">{formatHours(otHours)}</td>
                  <td>
                    <span className={`active-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="action-btn edit-btn"
                      onClick={() => handleSaveRow(row)}
                      title={isSaving ? 'Saving...' : (isDirty ? 'Save row' : 'Saved')}
                      disabled={isSaving || isDeleting || !selectedDate}
                    >
                      <i className={`bi ${isSaving ? 'bi-arrow-repeat' : (isDirty ? 'bi-save' : 'bi-check-lg')}`}></i>
                    </button>
                    <button
                      type="button"
                      className="action-btn delete-btn"
                      onClick={() => openDeleteModal(row)}
                      title={isDeleting ? 'Clearing...' : 'Clear row'}
                      disabled={isSaving || isDeleting || !selectedDate}
                    >
                      <i className={`bi ${isDeleting ? 'bi-arrow-repeat' : 'bi-trash'}`}></i>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer time-records-footer">
        <div className="table-info">
          Showing {displayCount === 0 ? 0 : 1} to {displayCount} of{' '}
          {hasTotal ? totalCount : (hasMore ? `${sortedRows.length}+` : sortedRows.length)} entries
        </div>
      </div>
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        onConfirm={() => {
          if (deleteTarget) {
            handleDeleteRow(deleteTarget)
          }
        }}
        title="Clear Time Record"
        message="Clear this driver's time record for the selected date?"
        confirmLabel="Clear"
        confirmIcon="bi bi-trash"
        confirmClassName="btn-danger"
        warningText="This will remove saved times and set the status to inactive."
      />
    </div>
  )
}

export default TimeRecordsPerDay




