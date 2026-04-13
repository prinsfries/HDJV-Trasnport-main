// Navigation service for handling redirects outside of React components
// Use closure to prevent race conditions during hot reload
const NavigationService = (() => {
  let navigateFunction = null
  let isInitialized = false

  return {
    /**
     * Initialize the navigation service with React Router's navigate function
     * This should be called once in your App component or router setup
     */
    initialize: (navigate) => {
      if (!isInitialized || import.meta.env?.DEV) {
        navigateFunction = navigate
        isInitialized = true
      }
    },

    /**
     * Navigate to a path using React Router
     * @param {string} path - The path to navigate to
     * @param {object} options - Navigation options
     */
    navigate: (path, options = {}) => {
      if (navigateFunction && isInitialized) {
        try {
          navigateFunction(path, options)
        } catch (error) {
          console.error('Navigation failed:', error)
          // Fallback for critical errors
          console.warn('Navigation failed, falling back to window.location')
          window.location.href = path
        }
      } else {
        // Fallback for development or when navigation isn't initialized
        console.warn('Navigation not initialized, falling back to window.location')
        window.location.href = path
      }
    },

    /**
     * Check if navigation is properly initialized
     */
    isReady: () => {
      return navigateFunction !== null && isInitialized
    }
  }
})()

/**
 * Initialize the navigation service with React Router's navigate function
 * This should be called once in your App component or router setup
 */
export const initializeNavigation = NavigationService.initialize

/**
 * Navigate to a path using React Router
 * @param {string} path - The path to navigate to
 * @param {object} options - Navigation options
 */
export const navigateTo = NavigationService.navigate

/**
 * Navigate to login page
 */
export const navigateToLogin = () => {
  navigateTo('/login')
}
