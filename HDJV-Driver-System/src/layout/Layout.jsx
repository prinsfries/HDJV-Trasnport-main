import React, { useState, useEffect, Suspense } from 'react'
import { Outlet } from 'react-router'
import Sidebar from '../components/sidebar/Sidebar'
import Header from '../components/header/Header'
import { HeaderProvider } from '../components/header/HeaderContext'
import NotificationPrompt from '../components/notifications/NotificationPrompt'
import { useDateTimeFormat } from '../contexts/useDateTimeFormat'
import './Layout.css'

const RouteFallback = () => (
  <div className="route-fallback">
    <div className="route-fallback-header">
      <div className="route-fallback-title shimmer"></div>
      <div className="route-fallback-subtitle shimmer"></div>
    </div>
    <div className="route-fallback-grid">
      <div className="route-fallback-card shimmer"></div>
      <div className="route-fallback-card shimmer"></div>
      <div className="route-fallback-card shimmer"></div>
    </div>
    <div className="route-fallback-table">
      <div className="route-fallback-row shimmer"></div>
      <div className="route-fallback-row shimmer"></div>
      <div className="route-fallback-row shimmer"></div>
      <div className="route-fallback-row shimmer"></div>
    </div>
  </div>
)

const Layout = () => {
  useDateTimeFormat()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = sessionStorage.getItem('sidebarCollapsed')
    if (savedState === null) return false
    try {
      return JSON.parse(savedState)
    } catch {
      return false
    }
  })

  useEffect(() => {
    sessionStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  return (
    <HeaderProvider>
      <div className="app">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <main className={`main-content ${isCollapsed ? 'collapsed' : ''}`}>
          <Header />
          <div className="content">
            <NotificationPrompt />
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </HeaderProvider>
  )
}

export default Layout

