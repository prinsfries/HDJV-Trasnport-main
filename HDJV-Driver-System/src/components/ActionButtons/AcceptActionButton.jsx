import React from 'react'

const AcceptActionButton = ({ onClick, title = 'Accept', className = '' }) => (
  <button
    className={`action-btn accept-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}
  >
    <i className="bi bi-check-lg"></i>
  </button>
)

export default AcceptActionButton
