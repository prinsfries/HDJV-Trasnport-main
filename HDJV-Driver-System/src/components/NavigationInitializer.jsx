import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { initializeNavigation } from '../utils/navigation.js'

const NavigationInitializer = ({ children }) => {
  const navigate = useNavigate()

  useEffect(() => {
    // Initialize the navigation service with React Router's navigate function
    initializeNavigation(navigate)
  }, [navigate])

  return children
}

export default NavigationInitializer
