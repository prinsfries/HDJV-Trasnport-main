import React from 'react'

const ToggleStatusActionButton = ({ isActive, onClick, className = '' }) => (
  <button
    className={`action-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}${className ? ` ${className}` : ''}`}
    onClick={onClick}
    title={isActive ? 'Deactivate account' : 'Activate account'}>
    <i className={`bi ${isActive ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
  </button>
)

export default ToggleStatusActionButton
