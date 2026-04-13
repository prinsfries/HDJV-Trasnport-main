import React, { useEffect, useRef, useState } from 'react'
import Toast from './Toast.jsx'
import './Toast.css'
import { ToastContext } from './ToastContext'

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const removeTimersRef = useRef(new Map())
  const nextIdRef = useRef(1)

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    const newToast = { id, message, type, duration, isVisible: true }
    
    setToasts(prev => [...prev, newToast])
    
    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, isVisible: false } : toast
    ))
    
    // Remove from array after animation
    const existing = removeTimersRef.current.get(id)
    if (existing) {
      clearTimeout(existing)
    }
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
      removeTimersRef.current.delete(id)
    }, 300)
    removeTimersRef.current.set(id, timer)
  }

  const showSuccess = (message, duration) => addToast(message, 'success', duration)
  const showError = (message, duration) => addToast(message, 'error', duration)
  const showWarning = (message, duration) => addToast(message, 'warning', duration)
  const showInfo = (message, duration) => addToast(message, 'info', duration)

  const value = {
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }

  useEffect(() => {
    const timersRef = removeTimersRef.current
    return () => {
      timersRef.forEach((timer) => clearTimeout(timer))
      timersRef.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          isVisible={toast.isVisible}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  )
}
