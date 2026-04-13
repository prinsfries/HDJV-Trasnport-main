import React, { useState, useEffect, useCallback } from 'react';
import { getAuthToken, removeAuthToken } from '../utils/api/index.js';
import { navigateToLogin } from '../utils/navigation.js';
import UserContext from './UserContextBase';

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const pendingRequestRef = React.useRef(null);

  const fetchUser = async (isRefetch = false) => {
    // If there's already a pending request, return it
    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }
    
    // Create the request promise
    const requestPromise = (async () => {
      try {
        if (!isRefetch) {
          setLoading(true);
        } else {
          setIsRefetching(true);
        }
        
        const token = getAuthToken();
        if (!token) {
          setUser(null);
          setLoading(false);
          setIsRefetching(false);
          return null;
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            removeAuthToken();
            localStorage.removeItem('user');
            navigateToLogin();
            return null;
          }
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        return userData;
      } catch (error) {
        console.error('Error fetching user:', error);
        setUser(null);
        throw error;
      } finally {
        setLoading(false);
        setIsRefetching(false);
        pendingRequestRef.current = null;
      }
    })();

    // Store the pending request
    pendingRequestRef.current = requestPromise;
    return requestPromise;
  };

  useEffect(() => {
    fetchUser(false);
  }, []);

  const refetchUser = useCallback(async () => {
    try {
      await fetchUser(true);
    } catch (error) {
      // Error is already logged in fetchUser, no need to handle here
      console.warn('Refetch user failed:', error.message);
    }
  }, []);

  const value = {
    user,
    setUser,
    loading: loading || isRefetching,
    refetchUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};




