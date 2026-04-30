import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { fetchDashboardSummary, fetchApprovalSla } from '../../utils/api/index.js'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import './Dashboard.css'

const Dashboard = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalVehicles: 0,
    totalTrips: 0,
    totalPassengers: 0,
    pendingKrApproval: 0,
    approvedForGa: 0
  })
  const [slaStats, setSlaStats] = useState({
    avgApprovalMinutes: 0,
    lateApprovals: 0,
    lateRate: 0,
    totalRequests: 0,
    days: 30,
    slaMinutes: 1440
  })
  const [loading, setLoading] = useState(true)
  const refreshInFlightRef = useRef(false)
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const role = currentUser?.role || ''
  const canSeeKr = role === 'kradmin'
  const canSeeGa = role === 'gaadmin'

  usePageHeader(t('pages.dashboardOverview'))

  const loadDashboardData = async ({ silent = false } = {}) => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    try {
      if (!silent) {
        setLoading(true)
      }
      const [summary, sla] = await Promise.all([
        fetchDashboardSummary(),
        fetchApprovalSla({ days: 30, sla_minutes: 1440 })
      ])
      setStats({
        totalDrivers: summary?.total_drivers ?? 0,
        totalVehicles: summary?.total_vehicles ?? 0,
        totalTrips: summary?.total_routes ?? 0,
        totalPassengers: summary?.total_passengers ?? 0,
        pendingKrApproval: summary?.pending_kr_approval ?? 0,
        approvedForGa: summary?.approved_for_ga ?? 0
      })
      setSlaStats({
        avgApprovalMinutes: sla?.avg_approval_minutes ?? 0,
        lateApprovals: sla?.late_approvals ?? 0,
        lateRate: sla?.late_rate ?? 0,
        totalRequests: sla?.total_requests ?? 0,
        days: sla?.days ?? 30,
        slaMinutes: sla?.sla_minutes ?? 1440
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      if (!silent) {
        setLoading(false)
      }
      refreshInFlightRef.current = false
    }
  }

  useEffect(() => {
    let isActive = true

    const runInitialLoad = async () => {
      if (!isActive) return
      await loadDashboardData()
    }

    runInitialLoad()

    const intervalId = setInterval(() => {
      if (!isActive) return
      if (typeof document !== 'undefined' && document.hidden) return
      loadDashboardData({ silent: true })
    }, 1000)

    return () => {
      isActive = false
      clearInterval(intervalId)
    }
  }, [])

  const handleAddDriver = () => navigate('/users', { state: { openModal: true } })
  const handleAddVehicle = () => navigate('/vehicles', { state: { openModal: true } })
  const handleViewRoutes = () => navigate('/routes')
  const handleViewRequests = () => navigate('/requests')
  const handleViewTimeRecords = () => navigate('/time-records')
  const handleViewAccounts = () => navigate('/accounts')
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-people-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : stats.totalDrivers}</h3>
            <p>Total Drivers</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-person-check-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : stats.totalPassengers}</h3>
            <p>Total Passengers</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-geo-alt-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : stats.totalTrips}</h3>
            <p>Total Routes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-car-front-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : stats.totalVehicles}</h3>
            <p>Total Vehicles</p>
          </div>
        </div>

        {canSeeKr && (
          <div className="stat-card">
            <div className="stat-icon">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div className="stat-content">
              <h3>{loading ? '-' : stats.pendingKrApproval}</h3>
              <p>Pending Approval</p>
            </div>
          </div>
        )}

        {canSeeGa && (
          <div className="stat-card">
            <div className="stat-icon">
              <i className="bi bi-check2-circle"></i>
            </div>
            <div className="stat-content">
              <h3>{loading ? '-' : stats.approvedForGa}</h3>
              <p>Ready for Assignment</p>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : `${slaStats.avgApprovalMinutes} min`}</h3>
            <p>Avg Approval Time</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : slaStats.lateApprovals}</h3>
            <p>Late Approvals</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="bi bi-bar-chart-line-fill"></i>
          </div>
          <div className="stat-content">
            <h3>{loading ? '-' : `${slaStats.lateRate}%`}</h3>
            <p>Late Rate</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon">
                <i className="bi bi-person-plus-fill"></i>
              </div>
              <div className="activity-details">
                <p><strong>New driver added</strong> - John Smith joined the team</p>
                <span className="activity-time">2 hours ago</span>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon">
                <i className="bi bi-route"></i>
              </div>
              <div className="activity-details">
                <p><strong>Route completed</strong> - Manila to Baguio route finished</p>
                <span className="activity-time">3 hours ago</span>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon">
                <i className="bi bi-shield-check"></i>
              </div>
              <div className="activity-details">
                <p><strong>Account activated</strong> - Sarah Johnson's account is now active</p>
                <span className="activity-time">5 hours ago</span>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon">
                <i className="bi bi-people-fill"></i>
              </div>
              <div className="activity-details">
                <p><strong>Passengers boarded</strong> - 12 passengers on Route 5</p>
                <span className="activity-time">6 hours ago</span>
              </div>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="quick-action-btn" onClick={handleAddDriver}>
              <i className="bi bi-person-plus"></i>
              <span>Add Driver</span>
            </button>
            <button className="quick-action-btn" onClick={handleAddVehicle}>
              <i className="bi bi-car-front"></i>
              <span>Add Vehicle</span>
            </button>
            <button className="quick-action-btn" onClick={handleViewRoutes}>
              <i className="bi bi-map"></i>
              <span>View Routes</span>
            </button>
            <button className="quick-action-btn" onClick={handleViewRequests}>
              <i className="bi bi-inbox"></i>
              <span>View Requests</span>
            </button>
            <button className="quick-action-btn" onClick={handleViewTimeRecords}>
              <i className="bi bi-clock-history"></i>
              <span>Time Records</span>
            </button>
            <button className="quick-action-btn" onClick={handleViewAccounts}>
              <i className="bi bi-shield-lock"></i>
              <span>View Accounts</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Dashboard


