import React, { useState, useEffect } from 'react'
import './AddEditModal.css'

const AddEditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  title = 'Edit Item',
  fields = [],
  initialData = {},
  mode = 'edit', // 'add' or 'edit'
  twoColumn = false // enable two-column layout
}) => {
  const [formData, setFormData] = useState(initialData)

  useEffect(() => {
    setFormData(initialData)
  }, [initialData])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    
    let processedValue = value
    
    // Handle phone number input - allow only numbers and specific characters
    if (type === 'tel') {
      processedValue = value.replace(/[^0-9+\-()\s]/g, '')
    }
    
    // Handle numeric input - allow only numbers
    if (type === 'number') {
      processedValue = value.replace(/[^0-9]/g, '')
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  const handleClose = () => {
    setFormData(initialData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay add-edit-modal-overlay">
      <div className={`modal-container ${twoColumn ? 'modal-two-column' : ''}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={handleClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className={`modal-form ${twoColumn ? 'form-two-column' : ''}`}>
          {fields.map((field) => (
            <div key={field.name} className={`form-group ${field.fullWidth ? 'full-width' : ''}`}>
              <label htmlFor={field.name}>{field.label}</label>
              {field.type === 'select' ? (
                <select
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  required={field.required}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  required={field.required}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === 'add' ? 'Add' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEditModal
