import React from 'react'
import './NotFound.css'

const NotFound = () => {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="error-code">404</div>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <button className="home-btn" onClick={() => window.history.back()}>
          <i className="bi bi-arrow-left"></i>
          Go Back
        </button>
      </div>
    </div>
  )
}

export default NotFound