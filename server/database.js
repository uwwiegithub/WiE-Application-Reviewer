const fs = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize database with default structure
const initializeDB = async () => {
  try {
    await fs.access(DB_FILE);
  } catch (error) {
    // File doesn't exist, create it with default structure
    const defaultData = {
      sheets: [],
      votes: {},
      selections: {}, // New field for interview and hiring selections
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
};

// Read data from database
const readDB = async () => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { sheets: [], votes: {}, lastUpdated: new Date().toISOString() };
  }
};

// Write data to database
const writeDB = async (data) => {
  try {
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing to database:', error);
    return false;
  }
};

// Database operations
const db = {
  // Initialize database
  init: initializeDB,

  // Get all sheets
  getSheets: async () => {
    const data = await readDB();
    return data.sheets || [];
  },

  // Add new sheet
  addSheet: async (sheet) => {
    const data = await readDB();
    data.sheets.push(sheet);
    await writeDB(data);
    return sheet;
  },

  // Get sheet by ID
  getSheetById: async (id) => {
    const data = await readDB();
    return data.sheets.find(s => s.id === id);
  },

  // Delete a sheet and all associated votes
  deleteSheet: async (id) => {
    const data = await readDB();
    const sheetIndex = data.sheets.findIndex(s => s.id === id);
    
    if (sheetIndex === -1) {
      throw new Error('Sheet not found');
    }
    
    const deletedSheet = data.sheets[sheetIndex];
    
    // Remove the sheet
    data.sheets.splice(sheetIndex, 1);
    
    // Remove all votes associated with this sheet
    const votesToRemove = [];
    Object.keys(data.votes).forEach(key => {
      if (key.startsWith(id + '-')) {
        votesToRemove.push(key);
      }
    });
    
    votesToRemove.forEach(key => {
      delete data.votes[key];
    });
    
    await writeDB(data);
    return { success: true, deletedSheet, removedVoteKeys: votesToRemove.length };
  },

  // Get all votes
  getVotes: async () => {
    const data = await readDB();
    return data.votes || {};
  },

  // Add vote
  addVote: async (sheetId, applicantRow, voterName) => {
    const data = await readDB();
    const key = `${sheetId}-${applicantRow}`;
    
    if (!data.votes[key]) {
      data.votes[key] = [];
    }
    
    // Check if voter already voted
    if (data.votes[key].includes(voterName)) {
      throw new Error('You have already voted for this applicant');
    }
    
    data.votes[key].push(voterName);
    await writeDB(data);
    return data.votes[key];
  },

  // Get votes for a specific sheet
  getVotesForSheet: async (sheetId) => {
    const data = await readDB();
    const sheetVotes = {};
    
    Object.keys(data.votes).forEach(key => {
      if (key.startsWith(sheetId + '-')) {
        // Keep the full key (sheetId-applicantRow) instead of just applicantRow
        sheetVotes[key] = data.votes[key];
      }
    });
    
    return sheetVotes;
  },

  // Delete a specific vote
  deleteVote: async (sheetId, applicantRow, voterName) => {
    const data = await readDB();
    const voteKey = `${sheetId}-${applicantRow}`;
    
    if (!data.votes[voteKey]) {
      throw new Error('Vote not found');
    }
    
    const voters = data.votes[voteKey];
    const voterIndex = voters.indexOf(voterName);
    
    if (voterIndex === -1) {
      throw new Error('Voter not found in the list');
    }
    
    // Remove the specific voter
    voters.splice(voterIndex, 1);
    
    // If no more voters, remove the entire vote key
    if (voters.length === 0) {
      delete data.votes[voteKey];
    }
    
    await writeDB(data);
    return { success: true, remainingVoters: voters };
  },

  // Get selections for a specific sheet
  getSelections: async (sheetId) => {
    const data = await readDB();
    
    // Filter selections for the specific sheet
    const sheetSelections = {};
    if (data.selections) {
      Object.keys(data.selections).forEach(key => {
        if (key.startsWith(sheetId + '-')) {
          sheetSelections[key] = data.selections[key];
        }
      });
    }
    
    return sheetSelections;
  },

  // Update selections for a specific applicant
  updateSelections: async (sheetId, applicantRow, selections) => {
    const data = await readDB();
    
    // Initialize selections if it doesn't exist
    if (!data.selections) {
      data.selections = {};
    }
    
    const selectionKey = `${sheetId}-${applicantRow}`;
    data.selections[selectionKey] = {
      ...data.selections[selectionKey],
      ...selections,
      updatedAt: new Date().toISOString()
    };
    
    await writeDB(data);
    return data.selections[selectionKey];
  },

  // Get selections for a specific applicant
  getApplicantSelections: async (sheetId, applicantRow) => {
    const data = await readDB();
    const selectionKey = `${sheetId}-${applicantRow}`;
    return data.selections[selectionKey] || { selectedForInterview: false, selectedForHiring: false };
  },

  // Backup database
  backup: async () => {
    const data = await readDB();
    const backupFile = path.join(__dirname, `backup-${Date.now()}.json`);
    await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
    return backupFile;
  },

  // Restore database from backup
  restore: async (backupFile) => {
    try {
      const backupData = await fs.readFile(backupFile, 'utf8');
      const data = JSON.parse(backupData);
      await writeDB(data);
      return true;
    } catch (error) {
      console.error('Error restoring database:', error);
      return false;
    }
  }
};

module.exports = db;
