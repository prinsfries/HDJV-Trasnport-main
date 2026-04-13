import React from 'react'
import './DeleteConfirmModal.css'

const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Delete',
  message = 'Are you sure you want to delete this item?',
  confirmLabel = 'Delete',
  confirmIcon = 'bi bi-trash',
  confirmClassName = 'btn-danger',
  icon = 'bi bi-exclamation-triangle',
  iconClassName = 'delete-icon',
  showWarning = true,
  warningText = 'This action cannot be undone.',
}) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className="modal-overlay delete-confirm-modal-overlay">
      <div className="modal-container delete-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="modal-body">
          <div className={iconClassName}>
            <i className={icon}></i>
          </div>
          <p className="delete-message">{message}</p>
          {showWarning && <p className="delete-warning">{warningText}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`btn ${confirmClassName}`} onClick={handleConfirm}>
            <i className={confirmIcon}></i> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
