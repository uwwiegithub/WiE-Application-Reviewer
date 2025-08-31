import React from 'react';

const Login = ({ onLogin }) => {
  const handleGoogleLogin = () => {
    try {
      // Clear any existing error state
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Clear any existing session data by making a logout request
      const serverUrl = process.env.REACT_APP_SERVER_URL;
      if (!serverUrl) {
        console.error('REACT_APP_SERVER_URL environment variable is not set');
        return;
      }
      
      fetch(`${serverUrl}/auth/logout`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(() => {
        // Redirect to the backend OAuth endpoint
        const oauthUrl = `${serverUrl}/auth/google`;
        window.location.href = oauthUrl;
      }).catch((error) => {
        // Redirect to the backend OAuth endpoint even if logout fails
        const oauthUrl = `${serverUrl}/auth/google`;
        window.location.href = oauthUrl;
      });
    } catch (error) {
      // Fallback redirect
      const serverUrl = process.env.REACT_APP_SERVER_URL;
      if (serverUrl) {
        const oauthUrl = `${serverUrl}/auth/google`;
        window.location.href = oauthUrl;
      } else {
        console.error('REACT_APP_SERVER_URL environment variable is not set');
      }
    }
  };

  return (
    <div className="login-container" style={{ backgroundColor: '#ecdefc', minHeight: '100vh' }}>
      <div className="login-card">
        <h2>Welcome to the WiE Undergrad Website</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Please sign in with the WiE Google account to continue.
        </p>
        <button className="login-button" onClick={handleGoogleLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;
