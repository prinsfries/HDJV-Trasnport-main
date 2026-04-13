import React from 'react'

const DeleteActionButton = ({ onClick, title = 'Delete', className = '' }) => (
  <button
    className={`action-btn delete-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}>
    <i className="bi bi-trash"></i>
  </button>
)

export default DeleteActionButton
