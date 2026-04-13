import React from 'react'

const EditActionButton = ({ onClick, title = 'Edit', className = '' }) => (
  <button
    className={`action-btn edit-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}>
    <i className="bi bi-pencil"></i>
  </button>
)

export default EditActionButton
