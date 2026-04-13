import React from 'react'

const ViewActionButton = ({ onClick, title = 'View', className = '' }) => (
  <button
    className={`action-btn view-btn${className ? ` ${className}` : ''}`}
    title={title}
    onClick={onClick}>
    <i className="bi bi-eye"></i>
  </button>
)

export default ViewActionButton
