import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { formatLocalDate } from '../../utils/dateUtils'
import { useNavigate, useSearchParams } from 'react-router'
import { fetchUsersAll, fetchTimeRecords, upsertTimeRecord, deleteTimeRecord } from '../../utils/api/index.js'
import { useToast } from '../../components/Toast/ToastContext'
import DeleteConfirmModal from '../../components/modals/DeleteConfirmationModal/DeleteConfirmModal'
import { createCsvFilename, exportRowsToCsv } from '../../utils/exportUtils'
import './TimeRecords.css'

const createRow = (date = '') => ({
  id: null,
  tempId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  date,
  regularIn: '',
  regularOut: '',
  otIn: '',
  otOut: ''
})

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

const formatHours = (hours) => {
  if (hours === null) return '--'
  return hours.toFixed(2)
}

const getDayLabel = (date) => {
  if (!date) return '--';
  
  const parsed = new Date(`${date}T00:00:00`);
  
  if (Number.isNaN(parsed.getTime())) return '--';
  
  return parsed.toLocaleDateString('en-PH', { 
    timeZone: 'Asia/Manila', 
    weekday: 'long' 
  });
}

const normalizeDate = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && value.includes('T')) {
    return value.slice(0, 10)
  }
  return value
}

const normalizeTime = (value) => {
  if (!value) return ''
  if (value.length >= 5) return value.slice(0, 5)
  return value
}

const compareValues = (a, b) => {
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

const TimeRecords = () => {
  const { t } = useLanguage()
  usePageHeader(t('pages.driverTimeRecords'))
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showSuccess, showWarning, showError } = useToast()
  const hasInitializedFromUrl = useRef(false)
  const lastSetParamsRef = useRef('')

  const [rows, setRows] = useState([createRow()])
  const [drivers, setDrivers] = useState([])
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [debouncedDateFrom, setDebouncedDateFrom] = useState('')
  const [debouncedDateTo, setDebouncedDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingIds, setSavingIds] = useState(new Set())
  const [errorMessage, setErrorMessage] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' })
  const [isExporting, setIsExporting] = useState(false)
  const [savedSnapshots, setSavedSnapshots] = useState({})
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const buildParamsString = (nextDriverId, nextFrom, nextTo) => {
    const params = new URLSearchParams()
    if (nextDriverId) {
      params.set('driver', nextDriverId)
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
    const paramDriver = searchParams.get('driver') ?? searchParams.get('driver_id') ?? ''
    const paramFrom = searchParams.get('from') ?? searchParams.get('date_from') ?? ''
    const paramTo = searchParams.get('to') ?? searchParams.get('date_to') ?? ''
    if (paramDriver !== selectedDriverId) setSelectedDriverId(paramDriver)
    if (paramFrom !== dateFrom) setDateFrom(paramFrom)
    if (paramTo !== dateTo) setDateTo(paramTo)
    if (paramFrom !== debouncedDateFrom) setDebouncedDateFrom(paramFrom)
    if (paramTo !== debouncedDateTo) setDebouncedDateTo(paramTo)
    hasInitializedFromUrl.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const users = await fetchUsersAll('', { role: 'driver' })
        const list = Array.isArray(users) ? users : []
        setDrivers(list)
        if (list.length > 0) {
          setSelectedDriverId((prev) => prev || String(list[0].id))
        }
      } catch (error) {
        console.error('Failed to load drivers', error)
        setErrorMessage('Unable to load drivers.')
      }
    }
    loadDrivers()
  }, [])

  useEffect(() => {
    if (!hasInitializedFromUrl.current) return
    const nextString = buildParamsString(selectedDriverId, debouncedDateFrom, debouncedDateTo)
    if (nextString !== searchParams.toString()) {
      lastSetParamsRef.current = nextString
      setSearchParams(nextString, { replace: true })
    }
  }, [selectedDriverId, debouncedDateFrom, debouncedDateTo, searchParams, setSearchParams])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedDateFrom(dateFrom)
      setDebouncedDateTo(dateTo)
    }, 300)
    return () => clearTimeout(timeout)
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!selectedDriverId) return
    const loadRecords = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const records = await fetchTimeRecords({
          driverId: selectedDriverId,
          dateFrom: debouncedDateFrom || undefined,
          dateTo: debouncedDateTo || undefined
        })
        if (!Array.isArray(records) || records.length === 0) {
          setRows([createRow()])
          setSavedSnapshots({})
          return
        }
        const mapped = records.map((record) => ({
          id: record.id,
          tempId: record.id,
          date: normalizeDate(record.record_date),
          regularIn: normalizeTime(record.regular_in),
          regularOut: normalizeTime(record.regular_out),
          otIn: normalizeTime(record.ot_in),
          otOut: normalizeTime(record.ot_out)
        }))
        setRows(mapped)
        setSavedSnapshots(
          mapped.reduce((acc, row) => {
            acc[row.tempId] = {
              date: row.date,
              regularIn: row.regularIn,
              regularOut: row.regularOut,
              otIn: row.otIn,
              otOut: row.otOut
            }
            return acc
          }, {})
        )
      } catch (error) {
        console.error('Failed to load time records', error)
        setErrorMessage('Unable to load time records.')
      } finally {
        setLoading(false)
      }
    }
    loadRecords()
  }, [selectedDriverId, debouncedDateFrom, debouncedDateTo])

  const totals = useMemo(() => {
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
  }, [rows])

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

  const sortedRows = useMemo(() => {
    const data = [...rows]
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    data.sort((a, b) => {
      const getValue = (row) => {
        switch (sortConfig.key) {
          case 'date':
            return row.date || ''
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
          case 'day':
            return getDayLabel(row.date)
          default:
            return ''
        }
      }
      return compareValues(getValue(a), getValue(b)) * dir
    })
    return data
  }, [rows, sortConfig])

  const currentDriverLabel = useMemo(() => {
    const driver = drivers.find((item) => String(item.id) === String(selectedDriverId))
    return driver?.full_name
      || `${driver?.first_name ?? ''} ${driver?.last_name ?? ''}`.trim()
      || (driver?.id ? `Driver #${driver.id}` : 'Unknown driver')
  }, [drivers, selectedDriverId])

  const dateRangeSuffix = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom}-to-${dateTo}`
    if (dateFrom) return `from-${dateFrom}`
    if (dateTo) return `to-${dateTo}`
    return ''
  }, [dateFrom, dateTo])

  const exportColumns = useMemo(() => ([
    { label: 'Driver', value: () => currentDriverLabel },
    { label: 'Date', value: (row) => row.date || '--' },
    { label: 'Day', value: (row) => getDayLabel(row.date) },
    { label: 'Time In', value: (row) => row.regularIn || '--' },
    { label: 'Time Out', value: (row) => row.regularOut || '--' },
    { label: 'Regular Hours', value: (row) => formatHours(calculateHours(row.regularIn, row.regularOut)) },
    { label: 'OT In', value: (row) => row.otIn || '--' },
    { label: 'OT Out', value: (row) => row.otOut || '--' },
    { label: 'OT Hours', value: (row) => formatHours(calculateHours(row.otIn, row.otOut)) },
  ]), [currentDriverLabel])

  const handleUpdate = (rowId, field, value) => {
    setRows((prev) => prev.map((row) => (row.tempId === rowId ? { ...row, [field]: value } : row)))
  }

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1]
    let nextDate = ''
    if (lastRow?.date) {
      const next = new Date(`${lastRow.date}T00:00:00`)
      if (!Number.isNaN(next.getTime())) {
        next.setDate(next.getDate() + 1)
        nextDate = formatLocalDate(next)
      }
    }
    setRows((prev) => [...prev, createRow(nextDate)])
    showSuccess('Added a new day row.')
  }

  const handleRemoveRow = async (row) => {
    if (row.id) {
      try {
        await deleteTimeRecord(row.id)
      } catch (error) {
        console.error('Failed to delete time record', error)
        setErrorMessage('Unable to delete time record.')
        showError('Unable to delete time record.')
        return
      }
    }
    setRows((prev) => (prev.length > 1 ? prev.filter((item) => item.tempId !== row.tempId) : prev))
    setSavedSnapshots((prev) => {
      const next = { ...prev }
      delete next[row.tempId]
      return next
    })
    showSuccess('Time record deleted.')
  }

  const openDeleteModal = (row) => {
    setDeleteTarget(row)
    setIsDeleteOpen(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteOpen(false)
    setDeleteTarget(null)
  }

  const handleSaveRow = async (row, showToast = true) => {
    if (!selectedDriverId) return
    if (!row.date) {
      setErrorMessage('Please set a date before saving.')
      return
    }
    setSavingIds((prev) => new Set(prev).add(row.tempId))
    setErrorMessage('')
    try {
      const saved = await upsertTimeRecord({
        driver_id: Number(selectedDriverId),
        record_date: row.date,
        regular_in: row.regularIn || null,
        regular_out: row.regularOut || null,
        ot_in: row.otIn || null,
        ot_out: row.otOut || null
      })
      setRows((prev) =>
        prev.map((item) =>
          item.tempId === row.tempId
            ? {
                ...item,
                id: saved.id,
                tempId: saved.id,
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
        [saved.id]: {
          date: row.date,
          regularIn: normalizeTime(saved.regular_in),
          regularOut: normalizeTime(saved.regular_out),
          otIn: normalizeTime(saved.ot_in),
          otOut: normalizeTime(saved.ot_out)
        }
      }))
      
      // Show success toast notification only if showToast is true
      if (showToast) {
        showSuccess('Time record saved successfully!')
      }
    } catch (error) {
      console.error('Failed to save time record', error)
      setErrorMessage('Unable to save time record.')
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.tempId)
        return next
      })
    }
  }

  const handleClear = () => {
    setRows([createRow()])
    setSavedSnapshots({})
  }

  const handleSaveAll = async () => {
    let savedCount = 0
    let errorCount = 0
    
    for (const row of rows) {
      if (row.date) {
        try {
          await handleSaveRow(row, false) // Don't show toast for individual saves
          savedCount++
        } catch {
          errorCount++
        }
      }
    }
    
    // Show single summary toast after all saves complete
    if (savedCount > 0 && errorCount === 0) {
      showSuccess(`Successfully saved ${savedCount} time record${savedCount > 1 ? 's' : ''}!`)
    } else if (savedCount > 0 && errorCount > 0) {
      showWarning(`Saved ${savedCount} time record${savedCount > 1 ? 's' : ''}, ${errorCount} failed.`)
    } else if (errorCount > 0) {
      showError(`Failed to save ${errorCount} time record${errorCount > 1 ? 's' : ''}.`)
    }
  }

  const isRowDirty = (row) => {
    const snapshot = savedSnapshots[row.tempId]
    if (!snapshot) {
      return Boolean(row.date || row.regularIn || row.regularOut || row.otIn || row.otOut)
    }
    return (
      snapshot.date !== row.date ||
      snapshot.regularIn !== row.regularIn ||
      snapshot.regularOut !== row.regularOut ||
      snapshot.otIn !== row.otIn ||
      snapshot.otOut !== row.otOut
    )
  }

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const baseName = `time-records-${currentDriverLabel}${dateRangeSuffix ? `-${dateRangeSuffix}` : ''}`
      const filename = createCsvFilename(baseName, { includeDate: false })
      exportRowsToCsv({
        rows: sortedRows,
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
        </div>
        <div className="time-records-buttons">
          <button className="btn btn-secondary" type="button" onClick={handleSaveAll} disabled={loading}>
            Save All
          </button>
          <button className="btn btn-secondary" type="button" onClick={handleClear} disabled={loading}>
            Clear
          </button>
          <button className="btn btn-primary" type="button" onClick={handleAddRow} disabled={loading}>
            Add Day
          </button>
        </div>
      </div>

      <div className="table-actions time-records-filters">
        <div className="table-filters">
          <div className="filter-group">
            <label htmlFor="driver-select">Driver</label>
            <select
              id="driver-select"
              className="filter-select"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              disabled={drivers.length === 0}
            >
              {drivers.length === 0 && <option value="">No drivers</option>}
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name || `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim() || `Driver #${driver.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-actions-right">
          <div className="filter-group">
            <label>View</label>
            <div className="time-records-toggle">
              <button
                type="button"
                className="toggle-btn active"
                onClick={() => navigate('/time-records')}
              >
                Per Driver
              </button>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => navigate('/time-records/per-day')}
              >
                Per Day
              </button>
            </div>
          </div>
          <div className="filter-group">
            <label htmlFor="date-from">Date From</label>
            <input
              id="date-from"
              type="date"
              className="filter-select"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            {dateFrom && (
              <button
                type="button"
                className="clear-date-btn"
                onClick={() => setDateFrom('')}
                title="Clear date">
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          <div className="filter-group">
            <label htmlFor="date-to">Date To</label>
            <input
              id="date-to"
              type="date"
              className="filter-select"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            {dateTo && (
              <button
                type="button"
                className="clear-date-btn"
                onClick={() => setDateTo('')}
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

      <div className="table-wrapper">
        <table className="data-table time-records-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-header" onClick={() => handleSort('date')}>
                  Date <i className={getSortIcon('date')}></i>
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
                <button type="button" className="sort-header" onClick={() => handleSort('day')}>
                  Day <i className={getSortIcon('day')}></i>
                </button>
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="table-state">Loading time records...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="9" className="table-state">No records found.</td>
              </tr>
            )}
            {sortedRows.map((row) => {
              const regularHours = calculateHours(row.regularIn, row.regularOut)
              const otHours = calculateHours(row.otIn, row.otOut)
              const isSaving = savingIds.has(row.tempId)
              const isDirty = isRowDirty(row)
              return (
                <tr key={row.tempId}>
                  <td>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => handleUpdate(row.tempId, 'date', e.target.value)}
                      className="time-input"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.regularIn}
                      onChange={(e) => handleUpdate(row.tempId, 'regularIn', e.target.value)}
                      className="time-input"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.regularOut}
                      onChange={(e) => handleUpdate(row.tempId, 'regularOut', e.target.value)}
                      className="time-input"
                    />
                  </td>
                  <td className="hours-cell">{formatHours(regularHours)}</td>
                  <td>
                    <input
                      type="time"
                      value={row.otIn}
                      onChange={(e) => handleUpdate(row.tempId, 'otIn', e.target.value)}
                      className="time-input"
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.otOut}
                      onChange={(e) => handleUpdate(row.tempId, 'otOut', e.target.value)}
                      className="time-input"
                    />
                  </td>
                  <td className="hours-cell">{formatHours(otHours)}</td>
                  <td className="day-cell">{getDayLabel(row.date)}</td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="action-btn edit-btn"
                      onClick={() => handleSaveRow(row)}
                      title={isSaving ? 'Saving...' : (isDirty ? 'Save row' : 'Saved')}
                      disabled={isSaving}
                    >
                      <i className={`bi ${isSaving ? 'bi-arrow-repeat' : (isDirty ? 'bi-save' : 'bi-check-lg')}`}></i>
                    </button>
                    <button
                      type="button"
                      className="action-btn delete-btn"
                      onClick={() => openDeleteModal(row)}
                      title="Remove row"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={closeDeleteModal}
        onConfirm={() => {
          if (deleteTarget) {
            handleRemoveRow(deleteTarget)
          }
        }}
        title="Delete Time Record"
        message="Delete this driver's time record?"
        confirmLabel="Delete"
        confirmIcon="bi bi-trash"
        confirmClassName="btn-danger"
      />
    </div>
  )
}

export default TimeRecords



