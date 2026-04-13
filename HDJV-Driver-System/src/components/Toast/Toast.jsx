import React, { useEffect } from 'react'
import './Toast.css'

const Toast = ({ message, type = 'info', duration = 3000, onClose, isVisible }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <div className="toast-icon">
          {type === 'success' && <i className="bi bi-check-circle-fill"></i>}
          {type === 'error' && <i className="bi bi-x-circle-fill"></i>}
          {type === 'warning' && <i className="bi bi-exclamation-triangle-fill"></i>}
          {type === 'info' && <i className="bi bi-info-circle-fill"></i>}
        </div>
        <div className="toast-message">
          {message}
        </div>
        <button className="toast-close" onClick={onClose}>
          <i className="bi bi-x"></i>
        </button>
      </div>
    </div>
  )
}

export default Toast
