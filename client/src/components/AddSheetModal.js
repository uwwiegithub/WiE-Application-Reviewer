import React, { useState } from 'react';

const AddSheetModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    year: '',
    term: '',
    sheetUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [serviceAccountConfirmed, setServiceAccountConfirmed] = useState('');
  const [columnsConfirmed, setColumnsConfirmed] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.year || !formData.term || !formData.sheetUrl) {
      alert('Please fill in all fields');
      return;
    }

    if (serviceAccountConfirmed !== 'yes') {
      alert('Please confirm that you have given the service account viewer access to the Google Sheet');
      return;
    }

    if (columnsConfirmed !== 'yes') {
      alert('Please confirm that your Google Sheet has all 3 required columns');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add New Google Sheet</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Year</label>
            <input
              type="text"
              name="year"
              className="form-input"
              placeholder="e.g., 2026"
              value={formData.year}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Term</label>
            <select
              name="term"
              className="form-select"
              value={formData.term}
              onChange={handleChange}
              required
            >
              <option value="">Select a term</option>
              <option value="W">Winter (W)</option>
              <option value="F">Fall (F)</option>
              <option value="S">Spring (S)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Google Sheet URL</label>
            <input
              type="url"
              name="sheetUrl"
              className="form-input"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={formData.sheetUrl}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">You must share the google sheet with the email <u>{process.env.REACT_APP_GOOGLE_SERVICE_ACCOUNT_EMAIL}</u> and give it viewer access</label>
            <select
              name="serviceAccountConfirmed"
              className="form-select"
              value={serviceAccountConfirmed}
              onChange={(e) => setServiceAccountConfirmed(e.target.value)}
              required
            >
              <option value="">Select confirmation</option>
              <option value="yes">Yes, I have shared the sheet</option>
            </select>
            <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
              You must give the service account viewer access to your Google Sheet before adding it
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">The Google Sheet I am adding contains columns titled: "name", "email" and "First Choice Directorship"</label>
            <select
              name="columnsConfirmed"
              className="form-select"
              value={columnsConfirmed}
              onChange={(e) => setColumnsConfirmed(e.target.value)}
              required
            >
              <option value="">Select confirmation</option>
              <option value="yes">Yes, my sheet has all 3 columns</option>
            </select>
            <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
              Your Google Sheet must contain these exact column names for the application to work properly
            </small>
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Sheet'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddSheetModal;
