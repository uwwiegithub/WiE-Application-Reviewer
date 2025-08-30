import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AddSheetModal from './AddSheetModal';
import SheetCard from './SheetCard';

const Home = ({ user }) => {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSheets();
  }, []);

  const fetchSheets = async () => {
    try {
      setLoading(true);
      
      // First, check if we're still authenticated
      try {
        const authResponse = await axios.get('/auth/status');
        if (!authResponse.data.authenticated) {
          setError('Your session has expired. Please refresh the page and log in again.');
          return;
        }
        console.log('Authentication status confirmed before fetching sheets');
      } catch (authError) {
        console.log('Could not verify auth status, attempting to continue');
      }
      
      const response = await axios.get('/api/sheets');
      setSheets(response.data);
    } catch (error) {
      console.error('Error fetching sheets:', error);
      
      // Handle authentication errors gracefully
      if (error.response && error.response.status === 401) {
        try {
          console.log('Authentication error while fetching sheets, checking auth status');
          
          // Check current auth status
          const authResponse = await axios.get('/auth/status');
          if (authResponse.data.authenticated) {
            // We're authenticated, try to refresh and retry
            await axios.post('/auth/refresh');
            const retryResponse = await axios.get('/api/sheets');
            setSheets(retryResponse.data);
            return;
          } else {
            setError('Your session has expired. Please refresh the page and log in again.');
          }
        } catch (retryError) {
          console.error('Failed to refresh session and retry fetching sheets:', retryError);
          if (retryError.response && retryError.response.status === 401) {
            setError('Your session has expired. Please refresh the page and log in again.');
          } else {
            setError('Authentication failed. Please refresh the page and try again.');
          }
        }
      } else {
        setError('Failed to fetch submitted sheets');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSheet = async (sheetData) => {
    try {
      const response = await axios.post('/api/sheets', sheetData);
      setSheets([...sheets, response.data]);
      setShowModal(false);
      setError('');
    } catch (error) {
      console.error('Error adding sheet:', error);
      setError(error.response?.data?.error || 'Failed to add sheet');
    }
  };

  const handleDeleteSheet = async (sheetId) => {
    try {
      // First, check if we're still authenticated
      try {
        const authResponse = await axios.get('/auth/status');
        if (!authResponse.data.authenticated) {
          setError('Your session has expired. Please refresh the page and log in again.');
          return;
        }
        console.log('Authentication status confirmed before deleting sheet');
      } catch (authError) {
        console.log('Could not verify auth status, attempting to continue');
      }
      
      // Try to refresh the session
      try {
        await axios.post('/auth/refresh');
        console.log('Session refreshed before deleting sheet');
      } catch (refreshError) {
        console.log('Session refresh failed, but continuing with delete attempt');
      }
      
      await axios.delete(`/api/sheets/${sheetId}`);
      setSheets(sheets.filter(sheet => sheet.id !== sheetId));
      setError('');
    } catch (error) {
      console.error('Error deleting sheet:', error);
      
      // Handle specific error types
      if (error.response) {
        if (error.response.status === 401) {
          // Authentication error - try to check auth status and refresh
          try {
            console.log('Authentication error, checking auth status and attempting refresh');
            
            // Check current auth status
            const authResponse = await axios.get('/auth/status');
            if (authResponse.data.authenticated) {
              // We're authenticated, try to refresh and retry
              await axios.post('/auth/refresh');
              await axios.delete(`/api/sheets/${sheetId}`);
              setSheets(sheets.filter(sheet => sheet.id !== sheetId));
              setError('');
              return;
            } else {
              setError('Your session has expired. Please refresh the page and log in again.');
            }
          } catch (retryError) {
            console.error('Retry after session refresh failed:', retryError);
            if (retryError.response && retryError.response.status === 401) {
              setError('Your session has expired. Please refresh the page and log in again.');
            } else {
              setError('Authentication failed. Please refresh the page and try again.');
            }
          }
        } else {
          setError(error.response?.data?.error || 'Failed to delete sheet');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    }
  };

  const handleSheetClick = (sheetId) => {
    // Navigate to applicant review page using React Router
    navigate(`/review/${sheetId}`);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading submitted sheets...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="home-container">
        <div className="section-header">
          <h2 className="section-title">Submit New Google Sheet</h2>
          <button 
            className="add-sheet-button"
            onClick={() => setShowModal(true)}
          >
            + Add New Sheet
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="section-header">
          <h2 className="section-title">Past Application Sheets</h2>
        </div>

        {sheets.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            No sheets have been submitted yet. Click "Add New Sheet" to get started.
          </p>
        ) : (
          <div className="sheets-grid">
            {sheets
              .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
              .map((sheet) => (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  onClick={() => handleSheetClick(sheet.id)}
                  onDelete={handleDeleteSheet}
                />
              ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddSheetModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddSheet}
        />
      )}
    </div>
  );
};

export default Home;
