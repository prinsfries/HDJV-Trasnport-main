import React, { useEffect, useMemo, useState } from 'react'
import { fetchTripsAll } from '../../utils/api/index.js'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import './Reports.css'

const parseOdometer = (value) => {
  if (!value) return null
  const match = String(value).match(/[\d.]+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isNaN(parsed) ? null : parsed
}

const toDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

const Reports = () => {
  const { t } = useLanguage()
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [period, setPeriod] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [reportMode, setReportMode] = useState('summary')
  const [selectedDriver, setSelectedDriver] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })

  usePageHeader(t('pages.reportsAnalytics'))

  useEffect(() => {
    let isMounted = true
    fetchTripsAll()
      .then((data) => {
        if (!isMounted) return
        const tripItems = Array.isArray(data) ? data : (data.items || [])
        setTrips(tripItems)
        setErrorMessage('')
      })
      .catch(() => {
        if (!isMounted) return
        setTrips([])
        setErrorMessage('Unable to load reports data from the server.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const range = useMemo(() => {
    const now = new Date()
    if (period === 'all') return null

    if (period === 'today') {
      return { start: startOfDay(now), end: endOfDay(now) }
    }

    if (period === 'last7') {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      return { start: startOfDay(start), end: endOfDay(now) }
    }

    if (period === 'last30') {
      const start = new Date(now)
      start.setDate(start.getDate() - 29)
      return { start: startOfDay(start), end: endOfDay(now) }
    }

    if (period === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: startOfDay(start), end: endOfDay(now) }
    }

    if (period === 'custom') {
      const start = customStart ? startOfDay(new Date(customStart)) : null
      const end = customEnd ? endOfDay(new Date(customEnd)) : null
      if (start && end) {
        return { start, end }
      }
    }

    return null
  }, [period, customStart, customEnd])

  const filteredTrips = useMemo(() => {
    if (!range) return trips
    const { start, end } = range
    return trips.filter((trip) => {
      const dateSource = trip.started_at || trip.completed_at || trip.created_at
      const d = toDate(dateSource)
      if (!d) return false
      return d >= start && d <= end
    })
  }, [trips, range])

  const stats = useMemo(() => {
    let totalPassengers = 0
    let totalHours = 0
    let totalDistance = 0
    const driverSet = new Set()
    let completedTrips = 0

    filteredTrips.forEach((trip) => {
      const passengers = Array.isArray(trip.passengers) ? trip.passengers : []
      totalPassengers += passengers.length

      const started = trip.started_at ? new Date(trip.started_at) : null
      const completed = trip.completed_at ? new Date(trip.completed_at) : null
      if (started && completed) {
        const diff = completed.getTime() - started.getTime()
        if (diff > 0) {
          totalHours += diff / (1000 * 60 * 60)
        }
      }

      if (trip.status === 'completed') {
        completedTrips += 1
      }

      if (trip.driver_name) {
        driverSet.add(trip.driver_name)
      }

      const odoStart = parseOdometer(trip.odometer_start)
      const odoEnd = parseOdometer(trip.odometer_end)
      if (odoStart !== null && odoEnd !== null) {
        const diff = Math.max(odoEnd - odoStart, 0)
        totalDistance += diff
      }
    })

    return {
      totalTrips: filteredTrips.length,
      totalPassengers,
      totalHours,
      activeDrivers: driverSet.size,
      completedTrips,
      totalDistance,
    }
  }, [filteredTrips])

  const topDrivers = useMemo(() => {
    const counts = new Map()
    filteredTrips.forEach((trip) => {
      const name = trip.driver_name || 'Unknown'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredTrips])

  const vehicleTypes = useMemo(() => {
    const counts = new Map()
    filteredTrips.forEach((trip) => {
      const type = trip.vehicle_type || 'Unknown'
      counts.set(type, (counts.get(type) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredTrips])

  const normalizeDriver = (name) => String(name || 'Unknown').trim().toLowerCase()

  const driverStats = useMemo(() => {
    const statsMap = new Map()
    filteredTrips.forEach((trip) => {
      const rawName = trip.driver_name || 'Unknown'
      const key = normalizeDriver(rawName)
      const entry = statsMap.get(key) || {
        key,
        driver: String(rawName || 'Unknown').trim() || 'Unknown',
        trips: 0,
        passengers: 0,
        hours: 0,
        completed: 0,
        distance: 0,
      }
      entry.trips += 1
      const passengers = Array.isArray(trip.passengers) ? trip.passengers.length : 0
      entry.passengers += passengers
      const started = trip.started_at ? new Date(trip.started_at) : null
      const completed = trip.completed_at ? new Date(trip.completed_at) : null
      if (started && completed) {
        const diff = completed.getTime() - started.getTime()
        if (diff > 0) {
          entry.hours += diff / (1000 * 60 * 60)
        }
      }
      if (trip.status === 'completed') {
        entry.completed += 1
      }
      const odoStart = parseOdometer(trip.odometer_start)
      const odoEnd = parseOdometer(trip.odometer_end)
      if (odoStart !== null && odoEnd !== null) {
        const diff = Math.max(odoEnd - odoStart, 0)
        entry.distance += diff
      }
      statsMap.set(key, entry)
    })
    return Array.from(statsMap.values()).sort((a, b) => b.trips - a.trips)
  }, [filteredTrips])

  const driverOptions = useMemo(() => {
    return driverStats.map((d) => ({ key: d.key, label: d.driver }))
  }, [driverStats])

  const selectedDriverStats = useMemo(() => {
    if (selectedDriver === 'all') return null
    return driverStats.find((d) => d.key === selectedDriver) || null
  }, [driverStats, selectedDriver])

  const selectedDriverTrips = useMemo(() => {
    if (selectedDriver === 'all') return []
    return filteredTrips
      .filter((trip) => normalizeDriver(trip.driver_name) === selectedDriver)
      .map((trip) => {
        const started = trip.started_at ? new Date(trip.started_at) : null
        const completed = trip.completed_at ? new Date(trip.completed_at) : null
        const hours =
          started && completed
            ? Math.max((completed.getTime() - started.getTime()) / (1000 * 60 * 60), 0)
            : 0
        const odoStart = parseOdometer(trip.odometer_start)
        const odoEnd = parseOdometer(trip.odometer_end)
        const distance =
          odoStart !== null && odoEnd !== null ? Math.max(odoEnd - odoStart, 0) : null
        const dateSource = trip.started_at || trip.completed_at || trip.created_at
        return {
          id: trip.trip_id || trip.id,
          date: dateSource ? new Date(dateSource) : null,
          route: `${trip.start_location || '--'} → ${trip.end_location || '--'}`,
          status: trip.status || 'not_started',
          passengers: Array.isArray(trip.passengers) ? trip.passengers.length : 0,
          hours,
          distance,
        }
      })
      .sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return b.date.getTime() - a.date.getTime()
      })
  }, [filteredTrips, selectedDriver])

  const compareValues = (a, b) => {
    if (a === null || a === undefined || a === '') return 1
    if (b === null || b === undefined || b === '') return -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  }

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

  const sortedDriverTrips = useMemo(() => {
    const data = [...selectedDriverTrips]
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    data.sort((a, b) => {
      const getValue = (trip) => {
        switch (sortConfig.key) {
          case 'date':
            return trip.date ? trip.date.getTime() : null
          case 'route':
            return trip.route || ''
          case 'status':
            return trip.status || ''
          case 'passengers':
            return trip.passengers ?? 0
          case 'hours':
            return trip.hours ?? 0
          default:
            return ''
        }
      }
      return compareValues(getValue(a), getValue(b)) * dir
    })
    return data
  }, [selectedDriverTrips, sortConfig])

  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}

      <div className="table-container">
        <div className="table-actions">
          <div className="table-filters">
            <div className="filter-group">
              <label>Report View</label>
              <div className="report-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${reportMode === 'summary' ? 'active' : ''}`}
                  onClick={() => setReportMode('summary')}
                >
                  Summary
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${reportMode === 'driver' ? 'active' : ''}`}
                  onClick={() => setReportMode('driver')}
                >
                  Per Driver
                </button>
              </div>
            </div>
            <div className="filter-group">
              <label htmlFor="report-period">Time Period</label>
              <select
                id="report-period"
                className="filter-select"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {period === 'custom' && (
              <>
                <div className="filter-group">
                  <label htmlFor="report-start">Start Date</label>
                  <input
                    type="date"
                    id="report-start"
                    className="filter-select"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="report-end">End Date</label>
                  <input
                    type="date"
                    id="report-end"
                    className="filter-select"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </div>
              </>
            )}
            {reportMode === 'driver' && (
              <div className="filter-group">
                <label htmlFor="report-driver">Driver</label>
                <select
                  id="report-driver"
                  className="filter-select"
                  value={selectedDriver}
                  onChange={(event) => setSelectedDriver(event.target.value)}
                >
                  <option value="all">All Drivers</option>
                  {driverOptions.map((driver) => (
                    <option key={driver.key} value={driver.key}>
                      {driver.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {reportMode === 'summary' && (
          <div className="reports-grid">
            <div className="report-card">
              <h3>Total Trips</h3>
              <p>{isLoading ? '-' : stats.totalTrips}</p>
            </div>
            <div className="report-card">
              <h3>Total Passengers</h3>
              <p>{isLoading ? '-' : stats.totalPassengers}</p>
            </div>
            <div className="report-card">
              <h3>Total Hours Driven</h3>
              <p>{isLoading ? '-' : stats.totalHours.toFixed(1)}</p>
            </div>
            <div className="report-card">
              <h3>Active Drivers</h3>
              <p>{isLoading ? '-' : stats.activeDrivers}</p>
            </div>
            <div className="report-card">
              <h3>Completed Trips</h3>
              <p>{isLoading ? '-' : stats.completedTrips}</p>
            </div>
          </div>
        )}

        {reportMode === 'driver' && selectedDriverStats && (
          <div className="reports-grid">
            <div className="report-card">
              <h3>Driver</h3>
              <p>{selectedDriverStats.driver}</p>
            </div>
            <div className="report-card">
              <h3>Trips</h3>
              <p>{selectedDriverStats.trips}</p>
            </div>
            <div className="report-card">
              <h3>Completed</h3>
              <p>{selectedDriverStats.completed}</p>
            </div>
            <div className="report-card">
              <h3>Passengers</h3>
              <p>{selectedDriverStats.passengers}</p>
            </div>
            <div className="report-card">
              <h3>Total Hours</h3>
              <p>{selectedDriverStats.hours.toFixed(1)}</p>
            </div>
          </div>
        )}
      </div>

      {reportMode === 'summary' && (
        <div className="report-splits">
          <div className="report-list-card">
            <h3>Top Drivers</h3>
            {isLoading ? (
              <div className="report-empty">Loading...</div>
            ) : topDrivers.length === 0 ? (
              <div className="report-empty">No data for this period.</div>
            ) : (
              <ul className="report-list">
                {topDrivers.map(([name, count]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="report-list-card">
            <h3>Top Vehicle Types</h3>
            {isLoading ? (
              <div className="report-empty">Loading...</div>
            ) : vehicleTypes.length === 0 ? (
              <div className="report-empty">No data for this period.</div>
            ) : (
              <ul className="report-list">
                {vehicleTypes.map(([type, count]) => (
                  <li key={type}>
                    <span>{type}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {reportMode === 'driver' && (
        <div className="report-splits">
          {selectedDriver === 'all' && (
            <div className="report-list-card">
              <h3>Driver Trip Details</h3>
              <div className="report-empty">Select a driver to view details.</div>
            </div>
          )}
        </div>
      )}

      {reportMode === 'driver' && (
        <div className="report-table-card">
          <div className="report-table-header">
            <h3>Driver Trip Details</h3>
            <span className="report-table-subtitle">
              {selectedDriverStats ? `${selectedDriverStats.driver} trips` : 'Select a driver'}
            </span>
          </div>
          {isLoading ? (
            <div className="report-empty">Loading...</div>
          ) : selectedDriver === 'all' ? (
            <div className="report-empty">Choose a driver to see trip history.</div>
          ) : selectedDriverTrips.length === 0 ? (
            <div className="report-empty">No trips for this driver and time range.</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('date')}>
                        Date <i className={getSortIcon('date')}></i>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('route')}>
                        Route <i className={getSortIcon('route')}></i>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('status')}>
                        Status <i className={getSortIcon('status')}></i>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('passengers')}>
                        Passengers <i className={getSortIcon('passengers')}></i>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sort-header" onClick={() => handleSort('hours')}>
                        Hours <i className={getSortIcon('hours')}></i>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDriverTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td>{trip.date ? trip.date.toLocaleDateString('en-CA') : '--'}</td>
                      <td>{trip.route}</td>
                      <td>{trip.status}</td>
                      <td>{trip.passengers}</td>
                      <td>{trip.hours ? trip.hours.toFixed(1) : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default Reports



