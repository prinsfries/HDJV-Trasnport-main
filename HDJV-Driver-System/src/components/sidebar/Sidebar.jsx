import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { useUser } from '../../contexts/useUser'
import { useLanguage } from '../../contexts/useLanguage'
import { removeAuthToken } from '../../utils/api/index.js'
import './Sidebar.css'

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const [showLogout, setShowLogout] = useState(false)
  const [hoveredLabel, setHoveredLabel] = useState('')
  const [tooltipStyle, setTooltipStyle] = useState({})
  const dropdownRef = useRef(null)
  const location = useLocation()
  const { user, setUser } = useUser()
  const { t } = useLanguage()

  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: 'bi-grid-1x2-fill', path: '/dashboard' },
    { id: 'users', label: t('sidebar.users'), icon: 'bi-people', path: '/users' },
    { id: 'routes', label: t('sidebar.routes'), icon: 'bi bi-map', path: '/routes' },
    { id: 'vehicles', label: t('sidebar.vehicles'), icon: 'bi-truck', path: '/vehicles' },
    { id: 'accounts', label: t('sidebar.accounts'), icon: 'bi bi-shield-lock', path: '/accounts' },
    { id: 'requests', label: t('sidebar.requests'), icon: 'bi bi-inbox', path: '/requests' },
    { id: 'time-records', label: t('sidebar.timeRecords'), icon: 'bi bi-clock-history', path: '/time-records' },
    { id: 'reports', label: t('sidebar.reports'), icon: 'bi bi-graph-up-arrow', path: '/reports' },
    { id: 'settings', label: t('sidebar.settings'), icon: 'bi-gear', path: '/settings' }
  ]

  const getActiveItem = () => {
    const currentPath = location.pathname
    if (currentPath.startsWith('/time-records')) {
      return 'time-records'
    }
    if (currentPath === '/notifications') {
      return null
    }
    const activeItem = menuItems.find(item => item.path === currentPath)
    return activeItem ? activeItem.id : 'dashboard'
  }

  const activeItem = getActiveItem()

  const handleNavHover = (event, label) => {
    if (!isCollapsed) return
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredLabel(label)
    setTooltipStyle({
      top: rect.top + rect.height / 2,
      left: rect.right + 15
    })
  }

  const clearNavHover = () => {
    setHoveredLabel('')
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLogout(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">
          <i className="bi bi-truck logo-icon"></i>
          {!isCollapsed && (
            <div className="logo-text-container">
              <span className="logo-text-main">HDJV</span>
              <span className="logo-text-sub">{t('app.subName')}</span>
            </div>
          )}  
        </div>
        <button 
          className="collapse-toggle-btn" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
        >
          <i className={`bi ${isCollapsed ? 'bi-arrow-right' : 'bi-arrow-left'}`}></i>
          <span className="collapse-tooltip">{isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item">
              <Link
                to={item.path}
                className={`nav-button ${activeItem === item.id ? 'active' : ''}`}
                aria-label={item.label}
                aria-current={activeItem === item.id ? 'page' : undefined}
                onMouseEnter={(event) => handleNavHover(event, item.label)}
                onMouseLeave={clearNavHover}
              >
                <i className={`bi ${item.icon} nav-icon`}></i>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div 
          className="user-info" 
          onClick={() => setShowLogout(!showLogout)}
          title={isCollapsed ? t('sidebar.userMenu') : ''}
        >
          <div className="user-avatar">
            <i className="bi bi-person-fill"></i>
          </div>
          {!isCollapsed && (
            <div className="user-details">
              <div className="user-name">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : t('sidebar.adminUser')}</div>
              <div className="user-role">{user?.role || t('sidebar.systemAdmin')}</div>
            </div>
          )}
          {showLogout && (
            <div ref={dropdownRef} className={`user-dropdown ${showLogout ? 'show' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
              <div className="dropdown-divider"></div>
              <Link 
                to="/login" 
                className="dropdown-item logout-item"
                onClick={() => {
                  setUser(null)
                  removeAuthToken()
                  localStorage.removeItem('user')
                }}
              >
                <i className="bi bi-box-arrow-right dropdown-icon"></i>
                <span className="dropdown-label">{t('sidebar.logout')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>
      {isCollapsed && hoveredLabel && (
        <div className="sidebar-tooltip" style={tooltipStyle}>
          {hoveredLabel}
        </div>
      )}
    </div>
  )
}

export default Sidebar
