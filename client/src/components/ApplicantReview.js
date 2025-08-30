import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ApplicantReview = () => {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  
  const [sheet, setSheet] = useState(null);
  const [applicants, setApplicants] = useState({});
  const [headers, setHeaders] = useState([]);
  const [currentRole, setCurrentRole] = useState('');
  const [currentApplicantIndex, setCurrentApplicantIndex] = useState(0);
  const [votes, setVotes] = useState({});
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [voterName, setVoterName] = useState('');

  const fetchSheetAndApplicants = useCallback(async () => {
    try {
      setLoading(true);
      const [sheetResponse, applicantsResponse] = await Promise.all([
        axios.get(`/api/sheets`),
        axios.get(`/api/sheets/${sheetId}/applicants`)
      ]);

      const sheetData = sheetResponse.data.find(s => s.id === sheetId);
      if (!sheetData) {
        setError('Sheet not found');
        return;
      }

      setSheet(sheetData);
      
      // Create a completely isolated, immutable data structure
      const cleanApplicants = {};
      Object.keys(applicantsResponse.data.applicants).forEach(role => {
        cleanApplicants[role] = applicantsResponse.data.applicants[role].map(applicant => {
          // Create a completely new object with all properties as immutable strings
          const cleanApplicant = {};
          Object.keys(applicant).forEach(key => {
            // Ensure all values are strings and create new string instances
            cleanApplicant[key] = String(applicant[key] || '');
          });
          return cleanApplicant;
        });
      });
      
      // Handle duplicate headers by appending "(return director)" to the first duplicate
      const processedHeaders = [];
      const headerCounts = {};
      
      // First pass: count how many times each header appears
      applicantsResponse.data.headers.forEach(header => {
        const headerStr = String(header);
        headerCounts[headerStr] = (headerCounts[headerStr] || 0) + 1;
      });
      
      // Second pass: process headers, only adding suffix to duplicates
      const seenHeaders = new Set();
      applicantsResponse.data.headers.forEach(header => {
        const headerStr = String(header);
        if (headerCounts[headerStr] > 1) {
          // This header has duplicates
          if (!seenHeaders.has(headerStr)) {
            // First occurrence gets the suffix
            const duplicateHeader = `${headerStr} (return director)`;
            processedHeaders.push(duplicateHeader);
            seenHeaders.add(headerStr);
            console.log(`Frontend: Duplicate header "${headerStr}" renamed to "${duplicateHeader}"`);
          } else {
            // Subsequent occurrence keeps original name
            processedHeaders.push(headerStr);
          }
        } else {
          // No duplicates, keep original name
          processedHeaders.push(headerStr);
        }
      });
      
      setApplicants(cleanApplicants);
      setHeaders(processedHeaders);

      // Set initial role
      const roles = Object.keys(cleanApplicants);
      if (roles.length > 0) {
        setCurrentRole(roles[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch sheet data');
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  const fetchVotes = useCallback(async () => {
    try {
      const response = await axios.get(`/api/sheets/${sheetId}/votes`);
      console.log('fetchVotes: Response data', response.data);
      setVotes(response.data);
    } catch (error) {
      console.error('Error fetching votes:', error);
      
      // Handle authentication errors gracefully
      if (error.response && error.response.status === 401) {
        console.log('Authentication error while fetching votes, attempting to refresh session');
        try {
          await axios.post('/auth/refresh');
          // Retry fetching votes after session refresh
          const retryResponse = await axios.get(`/api/sheets/${sheetId}/votes`);
          setVotes(retryResponse.data);
          return;
        } catch (retryError) {
          console.error('Failed to refresh session and retry fetching votes:', retryError);
          // Don't show error to user, just log it
        }
      }
    }
  }, [sheetId]);

  const fetchSelections = useCallback(async () => {
    try {
      const response = await axios.get(`/api/sheets/${sheetId}/selections`);
      setSelections(response.data);
    } catch (error) {
      console.error('Error fetching selections:', error);
      
      // Handle authentication errors gracefully
      if (error.response && error.response.status === 401) {
        try {
          await axios.post('/auth/refresh');
          const retryResponse = await axios.get(`/api/sheets/${sheetId}/selections`);
          setSelections(retryResponse.data);
          return;
        } catch (retryError) {
          console.error('Failed to refresh session and retry fetching selections:', retryError);
        }
      }
    }
  }, [sheetId]);

  useEffect(() => {
    fetchSheetAndApplicants();
    fetchVotes();
    fetchSelections();
  }, [fetchSheetAndApplicants, fetchVotes, fetchSelections]);

  const handleApplicantClick = (role, index) => {
    setCurrentRole(role);
    setCurrentApplicantIndex(index);
    setViewMode('detail');
    // Reset voter name when switching applicants
    setVoterName('');
    // Refresh votes to ensure vote counts are up to date
    fetchVotes();
    // Scroll to top of page to show applicant data
    window.scrollTo(0, 0);
  };

  const handleBackToList = () => {
    setViewMode('list');
    // Reset voter name when going back to list
    setVoterName('');
    // Refresh votes to ensure vote counts are up to date
    fetchVotes();
  };

  const handleVote = async () => {
    if (!voterName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const currentApplicantData = getCurrentApplicant();
      if (!currentApplicantData) {
        setError('No applicant data available');
        return;
      }
      
      const voteData = {
        sheetId,
        applicantRow: currentApplicantData.rowIndex,
        voterName: voterName.trim()
      };
      
      console.log('handleVote: Sending vote data', voteData);
      
      // First, try to refresh the session to ensure it's valid
      try {
        await axios.post('/auth/refresh');
        console.log('Session refreshed before voting');
      } catch (refreshError) {
        console.log('Session refresh failed, but continuing with vote attempt');
      }
      
      await axios.post('/api/votes', voteData);

      // Clear the input field after successful vote
      setVoterName('');
      
      setSuccessMessage('Vote submitted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh votes immediately
      await fetchVotes();
    } catch (error) {
      console.error('Error submitting vote:', error);
      
      // Handle specific error types
      if (error.response) {
        if (error.response.status === 401) {
          // Authentication error - try to refresh session and retry once
          try {
            console.log('Authentication error, attempting to refresh session and retry');
            await axios.post('/auth/refresh');
            
            // Retry the vote after session refresh
            const currentApplicantData = getCurrentApplicant();
            const voteData = {
              sheetId,
              applicantRow: currentApplicantData.rowIndex,
              voterName: voterName.trim()
            };
            
            await axios.post('/api/votes', voteData);
            
            // Clear the input field after successful vote
            setVoterName('');
            setSuccessMessage('Vote submitted successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
            await fetchVotes();
            return;
          } catch (retryError) {
            console.error('Retry after session refresh failed:', retryError);
            setError('Authentication failed. Please refresh the page and try again.');
          }
        } else {
          setError(error.response?.data?.error || 'Failed to submit vote');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    }
  };

  const handleDeleteVote = async (voterName) => {
    try {
      const currentApplicantData = getCurrentApplicant();
      if (!currentApplicantData) {
        setError('No applicant data available');
        return;
      }

      const voteKey = `${sheetId}-${currentApplicantData.rowIndex}`;
      const voters = votes[voteKey] || [];

      if (!voters.includes(voterName)) {
        setError('Voter not found in the list');
        return;
      }

      const updatedVoters = voters.filter(v => v !== voterName);
      const updatedVotesData = { ...votes };
      updatedVotesData[voteKey] = updatedVoters;
      setVotes(updatedVotesData);

      console.log('handleDeleteVote: Sending delete vote data', { sheetId, applicantRow: currentApplicantData.rowIndex, voterName });
      await axios.delete(`/api/votes/${sheetId}/${currentApplicantData.rowIndex}/${voterName}`);

      setSuccessMessage('Vote deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Refresh votes immediately
      await fetchVotes();
    } catch (error) {
      console.error('Error deleting vote:', error);
      
      // Handle specific error types
      if (error.response) {
        if (error.response.status === 401) {
          // Authentication error - try to refresh session and retry
          try {
            console.log('Authentication error during delete, attempting to refresh session and retry');
            await axios.post('/auth/refresh');
            
            // Retry the delete after session refresh
            const currentApplicantData = getCurrentApplicant();
            await axios.delete(`/api/votes/${sheetId}/${currentApplicantData.rowIndex}/${voterName}`);
            
            setSuccessMessage('Vote deleted successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
            await fetchVotes();
            return;
          } catch (retryError) {
            console.error('Retry after session refresh failed:', retryError);
            if (retryError.response && retryError.response.status === 401) {
              setError('Your session has expired. Please refresh the page and log in again.');
            } else {
              setError('Authentication failed. Please refresh the page and try again.');
            }
          }
        } else {
          setError(error.response?.data?.error || 'Failed to delete vote');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    }
  };

  const handleSelectionChange = async (applicantRow, field, value) => {
    try {
      const currentSelections = selections[`${sheetId}-${applicantRow}`] || {};
      const updatedSelections = {
        ...currentSelections,
        [field]: value
      };
      
      // Update local state immediately for responsive UI
      setSelections(prev => ({
        ...prev,
        [`${sheetId}-${applicantRow}`]: updatedSelections
      }));
      
      // Send update to server
      await axios.put(`/api/sheets/${sheetId}/selections/${applicantRow}`, {
        selectedForInterview: updatedSelections.selectedForInterview || false,
        selectedForHiring: updatedSelections.selectedForHiring || false
      });
      
      setSuccessMessage('Selection updated successfully!');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (error) {
      console.error('Error updating selection:', error);
      
      // Get current selections again for error handling
      const currentSelections = selections[`${sheetId}-${applicantRow}`] || {};
      
      // Revert local state on error
      setSelections(prev => ({
        ...prev,
        [`${sheetId}-${applicantRow}`]: currentSelections
      }));
      
      setError('Failed to update selection. Please try again.');
      
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        try {
          await axios.post('/auth/refresh');
          // Retry the update
          await axios.put(`/api/sheets/${sheetId}/selections/${applicantRow}`, {
            selectedForInterview: value,
            selectedForHiring: currentSelections.selectedForHiring || false
          });
          
          setSuccessMessage('Selection updated successfully!');
          setTimeout(() => setSuccessMessage(''), 2000);
          setError('');
        } catch (retryError) {
          console.error('Retry after session refresh failed:', retryError);
          setError('Authentication failed. Please refresh the page and try again.');
        }
      }
    }
  };

  const nextApplicant = () => {
    const roleApplicants = applicants[currentRole] || [];
    if (currentApplicantIndex < roleApplicants.length - 1) {
      setCurrentApplicantIndex(currentApplicantIndex + 1);
      // Reset voter name when moving to next applicant
      setVoterName('');
      // Refresh votes to ensure vote counts are up to date
      fetchVotes();
    } else {
      // Move to next role
      const roles = Object.keys(applicants);
      const currentRoleIndex = roles.indexOf(currentRole);
      if (currentRoleIndex < roles.length - 1) {
        setCurrentRole(roles[currentRoleIndex + 1]);
        setCurrentApplicantIndex(0);
        // Reset voter name when moving to next role
        setVoterName('');
        // Refresh votes to ensure vote counts are up to date
        fetchVotes();
      }
    }
  };

  const previousApplicant = () => {
    if (currentApplicantIndex > 0) {
      setCurrentApplicantIndex(currentApplicantIndex - 1);
      // Reset voter name when moving to previous applicant
      setVoterName('');
      // Refresh votes to ensure vote counts are up to date
      fetchVotes();
    } else {
      // Move to previous role
      const roles = Object.keys(applicants);
      const currentRoleIndex = roles.indexOf(currentRole);
      if (currentRoleIndex > 0) {
        setCurrentRole(roles[currentRoleIndex - 1]);
        const roleApplicants = applicants[roles[currentRoleIndex - 1]] || [];
        setCurrentApplicantIndex(roleApplicants.length - 1);
        // Reset voter name when moving to previous role
        setVoterName('');
        // Refresh votes to ensure vote counts are up to date
        fetchVotes();
      }
    }
  };

  const getCurrentApplicant = () => {
    const roleApplicants = applicants[currentRole] || [];
    const applicant = roleApplicants[currentApplicantIndex];
    
    // Always return a clean copy to prevent mutation
    if (applicant) {
      const cleanApplicant = { ...applicant };
      return cleanApplicant;
    }
    
    return null;
  };

  const getVoteCount = (applicant) => {
    if (!applicant || !applicant.rowIndex) {
      // console.log('getVoteCount: No applicant or rowIndex', { applicant });
      return 0;
    }
    const key = `${sheetId}-${applicant.rowIndex}`;

    // // Try different key formats
    // const directKey = `${sheetId}-${applicant.rowIndex}`;
    // const stringKey = `${sheetId}-${String(applicant.rowIndex)}`;
    // const numberKey = `${sheetId}-${Number(applicant.rowIndex)}`;
    
    const voteCount = votes[key] ? votes[key].length : 0;
    // console.log('getVoteCount: Result', { key, voteCount, votesForKey: votes[key] });
    return voteCount;
  };

  const getTotalApplicants = () => {
    return Object.values(applicants).reduce((total, roleApplicants) => {
      const cleanRoleApplicants = roleApplicants || [];
      return total + cleanRoleApplicants.length;
    }, 0);
  };

  const getCurrentPosition = () => {
    let position = 0;
    const roles = Object.keys(applicants);
    
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      if (role === currentRole) {
        position += currentApplicantIndex + 1;
        break;
      } else {
        const roleApplicants = applicants[role] || [];
        position += roleApplicants.length;
      }
    }
    
    return position;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>Loading applicants...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">
          {error}
        </div>
        <button 
          className="nav-button" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Show applicant list view
  if (viewMode === 'list') {
    return (
      <div className="container">
        <div className="applicants-container">
          <div style={{ marginBottom: '20px' }}>
            <button 
              className="nav-button" 
              onClick={() => navigate('/')}
              style={{ marginBottom: '10px' }}
            >
              ← Back to Home
            </button>
            
            <h2 style={{ marginBottom: '10px' }}>
              {sheet?.sheetTitle} - {sheet?.year} {sheet?.term}
            </h2>
            
            {sheet?.sheetUrl && (
              <a 
                href={sheet.sheetUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="sheet-link"
                style={{
                  display: 'inline-block',
                  color: '#6400cf',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  padding: '8px 12px',
                  border: '2px solid #6400cf',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  marginBottom: '15px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#6400cf';
                  e.target.style.color = 'white';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 2px 4px rgba(100, 0, 207, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '';
                  e.target.style.color = '#6400cf';
                  e.target.style.transform = '';
                  e.target.style.boxShadow = '';
                }}
              >
                📊 View Original Google Sheet
              </a>
            )}
            
            <p className="applicant-instructions">
              Click on an applicant to review their details
            </p>
            <p className="applicant-total">
              Total: {getTotalApplicants()} applicant{getTotalApplicants() !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="applicants-list">
            {Object.entries(applicants).map(([role, roleApplicants]) => (
              <div key={role} className="role-section">
                <h3 className="role-title">
                  {role} ({roleApplicants.length} applicant{roleApplicants.length !== 1 ? 's' : ''})
                </h3>
                <div className="role-applicants">
                  {roleApplicants.map((applicant, index) => {
                    // Create a clean copy of the applicant data for display
                    const cleanApplicant = { ...applicant };
                    
                    return (
                      <div 
                        key={`${role}-${index}`}
                        className="applicant-list-item"
                        onClick={() => handleApplicantClick(role, index)}
                      >
                        <div className="applicant-list-header">
                          <h4 className="applicant-list-name">
                            {cleanApplicant.Name || 'Unnamed Applicant'}
                          </h4>
                          <span className="applicant-vote-count">
                            {getVoteCount(cleanApplicant)} votes
                          </span>
                        </div>
                        <div className="applicant-list-details">
                          {headers.slice(0, 3).map((header) => {
                            if (header === 'Name') return null;
                            const value = cleanApplicant[header] || 'N/A';
                            
                            // Check if this is an email field
                            const isEmail = header.toLowerCase().includes('email');
                            
                            return (
                              <span key={header} className="applicant-list-detail">
                                <strong>{header}:</strong> {value}
                                {isEmail && value !== 'N/A' && (
                                  <button
                                    className="copy-email-button"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent triggering the applicant click
                                      navigator.clipboard.writeText(value);
                                      // Show a brief success indicator
                                      const button = e.target;
                                      const originalText = button.textContent;
                                      button.textContent = 'Copied!';
                                      button.style.background = '#28a745';
                                      setTimeout(() => {
                                        button.textContent = originalText;
                                        button.style.background = '';
                                      }, 1000);
                                    }}
                                    title="Copy email"
                                  >
                                    Copy
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        
                        {/* Selection checkboxes */}
                        <div className="applicant-selections" onClick={(e) => e.stopPropagation()}>
                          <label className="selection-checkbox">
                            <input
                              type="checkbox"
                              checked={selections[`${sheetId}-${cleanApplicant.rowIndex}`]?.selectedForInterview || false}
                              onChange={(e) => {
                                e.stopPropagation(); // Prevent triggering the applicant click
                                handleSelectionChange(cleanApplicant.rowIndex, 'selectedForInterview', e.target.checked);
                              }}
                            />
                            <span className="checkbox-label">Interview</span>
                          </label>
                          
                          <label className="selection-checkbox">
                            <input
                              type="checkbox"
                              checked={selections[`${sheetId}-${cleanApplicant.rowIndex}`]?.selectedForHiring || false}
                              onChange={(e) => {
                                e.stopPropagation(); // Prevent triggering the applicant click
                                handleSelectionChange(cleanApplicant.rowIndex, 'selectedForHiring', e.target.checked);
                              }}
                            />
                            <span className="checkbox-label">Hire</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show applicant detail view
  const currentApplicant = getCurrentApplicant();
  if (!currentApplicant) {
    return (
      <div className="container">
        <div className="error-message">
          No applicants found
        </div>
        <button 
          className="nav-button" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="applicants-container">
        <div style={{ marginBottom: '20px' }}>
          <button 
            className="nav-button" 
            onClick={handleBackToList}
            style={{ marginBottom: '10px' }}
          >
            ← Back to List
          </button>
          
          <div className="role-info-section">
            <h2 className="role-info-title">
              Reviewing applicants for: <strong>{currentRole}</strong>
            </h2>
            <p className="role-info-count">
              {applicants[currentRole]?.length || 0} total applicants
            </p>
          </div>
        </div>

        <div className="applicant-card">
          <div className="applicant-header">
            <h3 className="applicant-name">
              {getCurrentApplicant()?.Name || 'Unnamed Applicant'}
            </h3>
            <span className="vote-count">
              {getVoteCount(getCurrentApplicant())} votes
            </span>
          </div>

          <div className="applicant-details">
            {headers.map((header) => {
              if (header === 'Name') return null; // Skip name as it's already displayed
              
              // Get the value from the clean applicant data
              const currentApplicantData = getCurrentApplicant();
              const value = currentApplicantData ? currentApplicantData[header] || 'N/A' : 'N/A';
              
              return (
                <div key={header} className={`detail-row ${(currentApplicantData ? currentApplicantData[header] || 'N/A' : 'N/A') === 'N/A' ? 'na-row' : ''}`}>
                  <span className="detail-label">{header}:</span>
                  <span className="detail-value">
                    {currentApplicantData ? currentApplicantData[header] || 'N/A' : 'N/A'}
                  </span>
                </div>
              );
            })}
          </div>

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          <div className="vote-section">
            <input
              type="text"
              className="vote-input"
              placeholder="Enter your name"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
            />
            <button 
              className="vote-button"
              onClick={handleVote}
            >
              Vote for Applicant
            </button>
          </div>

          {/* Voters List Section */}
          {(() => {
            const currentApplicantData = getCurrentApplicant();
            if (!currentApplicantData) return null;
            
            const voteKey = `${sheetId}-${currentApplicantData.rowIndex}`;
            const voters = votes[voteKey] || [];
            
            if (voters.length === 0) return null;
            
            return (
              <div className="voters-section">
                <h4 className="voters-title">Voters ({voters.length})</h4>
                <div className="voters-list">
                  {voters.map((voter, index) => (
                    <div key={index} className="voter-item">
                      <span className="voter-name">{voter}</span>
                      <button 
                        className="delete-vote-button"
                        onClick={() => handleDeleteVote(voter)}
                      >
                        Delete Vote
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Role Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '20px', 
          padding: '15px', 
          color: '#666', 
          fontSize: '0.9rem',
          borderTop: '1px solid #e0e0e0'
        }}>
          Role: <strong>{currentRole}</strong>
        </div>

        <div className="navigation">
          <button 
            className="nav-button"
            onClick={previousApplicant}
            disabled={currentApplicantIndex === 0 && Object.keys(applicants).indexOf(currentRole) === 0}
          >
            ← Previous
          </button>
          
          <span className="page-info">
            {getCurrentPosition()} of {getTotalApplicants()} applicants
          </span>
          
          <button 
            className="nav-button"
            onClick={nextApplicant}
            disabled={
              currentApplicantIndex === (applicants[currentRole]?.length || 0) - 1 && 
              Object.keys(applicants).indexOf(currentRole) === Object.keys(applicants).length - 1
            }
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicantReview;
