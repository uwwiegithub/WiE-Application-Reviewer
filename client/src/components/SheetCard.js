import React from 'react';

const SheetCard = ({ sheet, onClick, onDelete }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent triggering the card click
    if (window.confirm(`Are you sure you want to delete "${sheet.sheetTitle}"? This action cannot be undone.`)) {
      onDelete(sheet.id);
    }
  };

  return (
    <div className="sheet-card" onClick={onClick}>
      <div className="sheet-header">
        <h3 className="sheet-title">{sheet.sheetTitle}</h3>
        <button 
          className="delete-sheet-button"
          onClick={handleDelete}
          title="Delete this application sheet"
        >
          ×
        </button>
      </div>
      
      <div className="sheet-meta">
        <span className="sheet-badge">{sheet.year}</span>
        <span className="sheet-badge">{sheet.term}</span>
      </div>
      
      <p className="sheet-date">
        Submitted: {formatDate(sheet.submittedAt)}
      </p>
      
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Click to view applicant list
      </p>
    </div>
  );
};

export default SheetCard;
