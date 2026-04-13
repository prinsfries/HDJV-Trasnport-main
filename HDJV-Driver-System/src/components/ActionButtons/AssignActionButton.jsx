import React from 'react'

const AssignActionButton = ({ onClick, title = 'Assign', className = '' }) => (
  <button
    className={`action-btn assign-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}
  >
    <i className="bi bi-person-check"></i>
  </button>
)

export default AssignActionButton
