import React from 'react'

const RejectActionButton = ({ onClick, title = 'Reject', className = '' }) => (
  <button
    className={`action-btn reject-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}
  >
    <i className="bi bi-x-lg"></i>
  </button>
)

export default RejectActionButton
