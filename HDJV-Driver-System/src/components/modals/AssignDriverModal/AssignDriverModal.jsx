import React, { useMemo, useState } from 'react'
import './AssignDriverModal.css'

const AssignDriverModal = ({
  isOpen,
  onClose,
  onAssign,
  drivers = [],
  vehicles = [],
  activeDriverIds = new Set(),
  isLoading = false,
  requestLabel = ''
}) => {
  const [driverSearch, setDriverSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')

  const filteredDrivers = useMemo(() => {
    const term = driverSearch.trim().toLowerCase()
    if (!term) return drivers
    return drivers.filter((driver) => {
      const label = driver.full_name || driver.username || driver.email || ''
      return String(label).toLowerCase().includes(term)
    })
  }, [drivers, driverSearch])

  const filteredVehicles = useMemo(() => {
    const term = vehicleSearch.trim().toLowerCase()
    if (!term) return vehicles
    return vehicles.filter((vehicle) => {
      const label = `${vehicle.vehicle_id || ''} ${vehicle.plate_number || ''} ${vehicle.vehicle_type || ''}`
      return label.toLowerCase().includes(term)
    })
  }, [vehicles, vehicleSearch])

  const handleClose = () => {
    setDriverSearch('')
    setVehicleSearch('')
    setSelectedDriverId('')
    setSelectedVehicleId('')
    onClose()
  }

  const handleAssign = () => {
    if (!selectedDriverId || !selectedVehicleId || isLoading) return
    onAssign(selectedDriverId, selectedVehicleId)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="view-modal-overlay">
      <div className="view-modal-container assign-modal-container">
        <div className="view-modal-header">
          <h3>Assign Driver{requestLabel ? ` ${requestLabel}` : ''}</h3>
          <button className="view-modal-close-btn" onClick={handleClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="view-modal-body">
          <div className="assign-modal-grid">
            <div className="assign-modal-section">
            <div className="assign-modal-search">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Search drivers..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="assign-modal-list">
              {isLoading && (
                <div className="assign-modal-empty">Loading drivers...</div>
              )}
              {!isLoading && filteredDrivers.length === 0 && (
                <div className="assign-modal-empty">No drivers found.</div>
              )}
              {!isLoading && filteredDrivers.map((driver) => {
                const label = driver.full_name || driver.username || driver.email || 'Unnamed driver'
                const isActiveToday = activeDriverIds.has(String(driver.id))
                return (
                  <label key={driver.id} className="assign-modal-item">
                    <input
                      type="radio"
                      name="assign-driver"
                      value={driver.id}
                      checked={String(selectedDriverId) === String(driver.id)}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                    />
                    <div className="assign-modal-driver">
                      <span className="assign-modal-label">{label}</span>
                      <span className={`assign-modal-status ${isActiveToday ? 'assign-status-active' : 'assign-status-inactive'}`}>
                        {isActiveToday ? 'Active Today' : 'Inactive'}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
            </div>

            <div className="assign-modal-section">
            <div className="assign-modal-search">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Search vehicles..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="assign-modal-list">
              {isLoading && (
                <div className="assign-modal-empty">Loading vehicles...</div>
              )}
              {!isLoading && filteredVehicles.length === 0 && (
                <div className="assign-modal-empty">No vehicles found.</div>
              )}
              {!isLoading && filteredVehicles.map((vehicle) => {
                const label = `${vehicle.vehicle_id || 'Vehicle'} - ${vehicle.plate_number || '--'}`
                const typeLabel = vehicle.vehicle_type || 'Unknown'
                const status = vehicle.status || 'Inactive'
                const statusClass =
                  status === 'Active'
                    ? 'assign-status-active'
                    : status === 'Maintenance'
                      ? 'assign-status-maintenance'
                      : 'assign-status-inactive'
                return (
                  <label key={vehicle.id} className="assign-modal-item">
                    <input
                      type="radio"
                      name="assign-vehicle"
                      value={vehicle.id}
                      checked={String(selectedVehicleId) === String(vehicle.id)}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                    />
                    <div className="assign-modal-vehicle">
                      <span className="assign-modal-label">{label}</span>
                      <span className="assign-modal-meta">{typeLabel}</span>
                    </div>
                    <span className={`assign-modal-status ${statusClass}`}>{status}</span>
                  </label>
                )
              })}
            </div>
            </div>
          </div>
        </div>

        <div className="view-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAssign}
            disabled={!selectedDriverId || !selectedVehicleId || isLoading}
          >
            {isLoading ? 'Loading...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AssignDriverModal

