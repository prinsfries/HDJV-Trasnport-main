import React from 'react'
import './ViewModal.css'

const ViewModal = ({ isOpen, title, onClose, maxWidth = '760px', children }) => {
  if (!isOpen) return null

  return (
    <div className="view-modal-overlay">
      <div className="view-modal-container" style={{ maxWidth }}>
        <div className="view-modal-header">
          <h3>{title}</h3>
          <button className="view-modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="view-modal-body">{children}</div>

        <div className="view-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ViewModal
