import React from 'react'
import './UserCreatedModal.css'

const UserCreatedModal = ({ isOpen, onClose, user, defaultPassword }) => {
  if (!isOpen) return null


  return (
    <div className="modal-overlay">
      <div className="modal-container user-created-modal">
        <div className="modal-header">
          <h3>User Created Successfully!</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="modal-content">
          <div className="success-icon">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          
          <div className="user-info">
            <h4>{user.full_name}</h4>
            <p className="user-role">{user.role}</p>
          </div>
          
          <div className="credentials-container">
            <h5>Login Credentials</h5>
            
            <div className="credential-item">
              <label>Username:</label>
              <div className="credential-value">
                <input 
                  type="text" 
                  value={user.username} 
                  readOnly 
                  className="credential-input"
                />
                <button 
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(user.username)}
                  title="Copy username"
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
            
            <div className="credential-item">
              <label>Email:</label>
              <div className="credential-value">
                <input 
                  type="text" 
                  value={user.email} 
                  readOnly 
                  className="credential-input"
                />
                <button 
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(user.email)}
                  title="Copy email"
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
            
            <div className="credential-item">
              <label>Default Password:</label>
              <div className="credential-value">
                <input 
                  type="text" 
                  value={defaultPassword} 
                  readOnly 
                  className="credential-input"
                />
                <button 
                  className="copy-btn"
                  onClick={() => navigator.clipboard.writeText(defaultPassword)}
                  title="Copy password"
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserCreatedModal
