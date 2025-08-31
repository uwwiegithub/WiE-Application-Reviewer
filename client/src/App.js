import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Home from './components/Home';
import ApplicantReview from './components/ApplicantReview';
import './App.css';

// Configure axios to include credentials and base URL
axios.defaults.withCredentials = true;
axios.defaults.baseURL = process.env.REACT_APP_SERVER_URL;

// Add axios interceptor to handle authentication errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.log('Authentication error detected in interceptor, but letting component handle it');
      // Don't redirect immediately, let the component handle it
      // This prevents infinite redirects and allows for session refresh attempts
    }
    return Promise.reject(error);
  }
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [lastAuthCheck, setLastAuthCheck] = useState(Date.now());

  // Axios interceptors for authentication
  useEffect(() => {
    // Request interceptor to ensure withCredentials is set and add JWT token
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        config.withCredentials = true;
        
        // Add JWT token to Authorization header if available
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for authentication errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response && error.response.status === 401) {
          // Handle authentication errors
          if (error.response.data && error.response.data.reason === 'session_expired') {
            setIsAuthenticated(false);
            setUser(null);
            window.location.href = '/?error=session_expired';
          } else {
            // Other authentication error, let component handle it
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    // Check for JWT token in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('JWT token received from URL, length:', token.length);
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.log('No JWT token in URL parameters');
    }
    
    // Check if token exists in localStorage
    const existingToken = localStorage.getItem('authToken');
    if (existingToken) {
      console.log('Existing JWT token found in localStorage, length:', existingToken.length);
    } else {
      console.log('No JWT token in localStorage');
    }
    
    // Initial authentication check
    checkAuthStatus();
    
    // Check authentication status every 30 seconds
    const authInterval = setInterval(() => {
      checkAuthStatus();
    }, 30 * 1000);
    
    // Keep session alive every 20 seconds
    const keepAliveInterval = setInterval(() => {
      keepAlive();
    }, 20 * 1000);
    
    return () => {
      clearInterval(authInterval);
      clearInterval(keepAliveInterval);
    };
  }, []);

  const checkAuthStatus = async (retryCount = 0) => {
    console.log('=== checkAuthStatus called ===');
    try {
      const response = await axios.get('/auth/status');
      console.log('Auth status response:', response.data);
      
      if (response.data.authenticated) {
        console.log('Setting isAuthenticated to true');
        setIsAuthenticated(true);
        setUser(response.data.user);
        setLastAuthCheck(Date.now());
      } else {
        console.log('Setting isAuthenticated to false, reason:', response.data.reason);
        // Check the reason for authentication failure
        const reason = response.data.reason;
        
        if (reason === 'no_valid_session' || reason === 'no_session_id' || reason === 'store_error') {
          setIsAuthenticated(false);
          setUser(null);
          // Redirect to login with error message
          window.location.href = '/?error=session_lost';
          return;
        }
        
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      // If we get a 401 error, try to recover the session
      if (error.response && error.response.status === 401) {
        // Try to refresh the session before giving up
        try {
          const refreshResponse = await axios.post('/auth/refresh');
          if (refreshResponse.data.message === 'Session refreshed successfully') {
            setIsAuthenticated(true);
            setUser(refreshResponse.data.user);
            setLastAuthCheck(Date.now());
            return;
          }
        } catch (refreshError) {
          // Session recovery failed
        }
        
        // If recovery fails, redirect to login
        setIsAuthenticated(false);
        setUser(null);
        window.location.href = '/?error=session_lost';
        return;
      }
      
      // Retry logic for network errors
      if (retryCount < 3 && (!error.response || error.response.status >= 500)) {
        setTimeout(() => checkAuthStatus(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      // Handle different error types
      if (error.response) {
        if (error.response.status === 401) {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await axios.get('/auth/logout');
      // Clear JWT token from localStorage
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      // Logout failed, but still clear local state and token
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const keepAlive = async () => {
    try {
      await axios.post('/auth/refresh');
    } catch (error) {
      // Session refresh failed, will retry on next auth check
    }
  };

  console.log('=== App Render Debug ===');
  console.log('loading:', loading);
  console.log('isAuthenticated:', isAuthenticated);
  console.log('user:', user);

  if (loading) {
    return (
      <div className="loading">
        <h2>Loading...</h2>
        <p>Checking authentication status...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('Showing Login component - user not authenticated');
    return (
      <div>
        <Login onLogin={checkAuthStatus} />
      </div>
    );
  }

  console.log('Showing Home component - user authenticated');

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <>
              <header className="header">
                <div className="container">
                  <h1>WiE Applicant Reviewer</h1>
                  <p>Review and vote on club applicants</p>
                  <button className="logout-button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </header>
              <Home user={user} />
            </>
          } />
          <Route path="/review/:sheetId" element={<ApplicantReview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
