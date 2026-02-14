const { MongoClient, ServerApiVersion } = require('mongodb');

// Create MongoDB client
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db = null;
let isConnected = false;

// Initialize database connection
const initializeDB = async () => {
  try {
    if (isConnected && db) {
      console.log('MongoDB already connected');
      return;
    }

    await client.connect();
    db = client.db('applicant_reviewer');
    isConnected = true;
    
    // Create indexes for better performance
    await db.collection('sheets').createIndex({ id: 1 }, { unique: true });
    await db.collection('votes').createIndex({ sheet_id: 1, applicant_row: 1, voter_name: 1 }, { unique: true });
    await db.collection('selections').createIndex({ sheet_id: 1, applicant_row: 1 }, { unique: true });
    await db.collection('notes').createIndex({ sheet_id: 1, applicant_row: 1 }, { unique: true });
    
    console.log('MongoDB connected successfully to database: applicant_reviewer');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

// Get database instance
const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
};

// Database operations
const dbOperations = {
  // Initialize database
  init: initializeDB,

  // Get all sheets
  getSheets: async () => {
    try {
      const database = getDB();
      const sheets = await database.collection('sheets')
        .find({})
        .sort({ submittedAt: -1 })
        .toArray();
      
      return sheets;
    } catch (error) {
      console.error('Error fetching sheets:', error);
      throw error;
    }
  },

  // Add new sheet
  addSheet: async (sheet) => {
    try {
      const database = getDB();
      await database.collection('sheets').insertOne(sheet);
      return sheet;
    } catch (error) {
      console.error('Error adding sheet:', error);
      throw error;
    }
  },

  // Get sheet by ID
  getSheetById: async (id) => {
    try {
      const database = getDB();
      const sheet = await database.collection('sheets').findOne({ id });
      return sheet;
    } catch (error) {
      console.error('Error fetching sheet by ID:', error);
      throw error;
    }
  },

  // Delete a sheet and all associated votes, selections, and notes
  deleteSheet: async (id) => {
    try {
      const database = getDB();
      
      // Get sheet info before deletion
      const deletedSheet = await database.collection('sheets').findOne({ id });
      if (!deletedSheet) {
        throw new Error('Sheet not found');
      }

      // Delete associated votes
      const votesResult = await database.collection('votes').deleteMany({ sheet_id: id });
      
      // Delete associated selections
      const selectionsResult = await database.collection('selections').deleteMany({ sheet_id: id });
      
      // Delete associated notes
      const notesResult = await database.collection('notes').deleteMany({ sheet_id: id });
      
      // Delete the sheet
      await database.collection('sheets').deleteOne({ id });

      return { 
        success: true, 
        deletedSheet, 
        removedVoteKeys: votesResult.deletedCount,
        removedSelections: selectionsResult.deletedCount,
        removedNotes: notesResult.deletedCount
      };
    } catch (error) {
      console.error('Error deleting sheet:', error);
      throw error;
    }
  },

  // Get all votes
  getVotes: async () => {
    try {
      const database = getDB();
      const votes = await database.collection('votes')
        .find({})
        .sort({ sheet_id: 1, applicant_row: 1 })
        .toArray();
      
      // Convert to the expected format: { "sheetId-applicantRow": [voterNames] }
      const votesMap = {};
      votes.forEach(vote => {
        const key = `${vote.sheet_id}-${vote.applicant_row}`;
        if (!votesMap[key]) {
          votesMap[key] = [];
        }
        votesMap[key].push(vote.voter_name);
      });
      
      return votesMap;
    } catch (error) {
      console.error('Error fetching votes:', error);
      throw error;
    }
  },

  // Add vote
  addVote: async (sheetId, applicantRow, voterName) => {
    try {
      const database = getDB();
      
      // Check if voter already voted
      const existingVote = await database.collection('votes').findOne({
        sheet_id: sheetId,
        applicant_row: applicantRow,
        voter_name: voterName
      });
      
      if (existingVote) {
        throw new Error('You have already voted for this applicant');
      }
      
      // Insert the vote
      await database.collection('votes').insertOne({
        sheet_id: sheetId,
        applicant_row: applicantRow,
        voter_name: voterName,
        created_at: new Date()
      });
      
      // Get all votes for this applicant
      const allVotes = await database.collection('votes')
        .find({ sheet_id: sheetId, applicant_row: applicantRow })
        .sort({ created_at: 1 })
        .toArray();
      
      return allVotes.map(vote => vote.voter_name);
    } catch (error) {
      console.error('Error adding vote:', error);
      throw error;
    }
  },

  // Get votes for a specific sheet
  getVotesForSheet: async (sheetId) => {
    try {
      const database = getDB();
      const votes = await database.collection('votes')
        .find({ sheet_id: sheetId })
        .sort({ applicant_row: 1, created_at: 1 })
        .toArray();
      
      // Convert to the expected format: { "sheetId-applicantRow": [voterNames] }
      const sheetVotes = {};
      votes.forEach(vote => {
        const key = `${sheetId}-${vote.applicant_row}`;
        if (!sheetVotes[key]) {
          sheetVotes[key] = [];
        }
        sheetVotes[key].push(vote.voter_name);
      });
      
      return sheetVotes;
    } catch (error) {
      console.error('Error fetching votes for sheet:', error);
      throw error;
    }
  },

  // Delete a specific vote
  deleteVote: async (sheetId, applicantRow, voterName) => {
    try {
      const database = getDB();
      
      const result = await database.collection('votes').deleteOne({
        sheet_id: sheetId,
        applicant_row: applicantRow,
        voter_name: voterName
      });
      
      if (result.deletedCount === 0) {
        throw new Error('Vote not found');
      }
      
      // Get remaining votes for this applicant
      const remainingVotes = await database.collection('votes')
        .find({ sheet_id: sheetId, applicant_row: applicantRow })
        .sort({ created_at: 1 })
        .toArray();
      
      return { 
        success: true, 
        remainingVoters: remainingVotes.map(vote => vote.voter_name)
      };
    } catch (error) {
      console.error('Error deleting vote:', error);
      throw error;
    }
  },

  // Get selections for a specific sheet
  getSelections: async (sheetId) => {
    try {
      const database = getDB();
      const selections = await database.collection('selections')
        .find({ sheet_id: sheetId })
        .toArray();
      
      // Convert to the expected format: { "sheetId-applicantRow": {selections} }
      const sheetSelections = {};
      selections.forEach(selection => {
        const key = `${sheetId}-${selection.applicant_row}`;
        sheetSelections[key] = {
          selectedForInterview: selection.selected_for_interview,
          selectedForHiring: selection.selected_for_hiring,
          updatedAt: selection.updated_at
        };
      });
      
      return sheetSelections;
    } catch (error) {
      console.error('Error fetching selections:', error);
      throw error;
    }
  },

  // Update selections for a specific applicant
  updateSelections: async (sheetId, applicantRow, selections) => {
    try {
      const database = getDB();
      
      const updatedAt = new Date().toISOString();
      
      const result = await database.collection('selections').findOneAndUpdate(
        { sheet_id: sheetId, applicant_row: applicantRow },
        { 
          $set: { 
            selected_for_interview: selections.selectedForInterview,
            selected_for_hiring: selections.selectedForHiring,
            updated_at: updatedAt
          }
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      return {
        selectedForInterview: result.selected_for_interview,
        selectedForHiring: result.selected_for_hiring,
        updatedAt: result.updated_at
      };
    } catch (error) {
      console.error('Error updating selections:', error);
      throw error;
    }
  },

  // Get selections for a specific applicant
  getApplicantSelections: async (sheetId, applicantRow) => {
    try {
      const database = getDB();
      const selection = await database.collection('selections').findOne({
        sheet_id: sheetId,
        applicant_row: applicantRow
      });
      
      if (!selection) {
        return { selectedForInterview: false, selectedForHiring: false };
      }
      
      return {
        selectedForInterview: selection.selected_for_interview,
        selectedForHiring: selection.selected_for_hiring,
        updatedAt: selection.updated_at
      };
    } catch (error) {
      console.error('Error fetching applicant selections:', error);
      throw error;
    }
  },

  // Backup database (export to JSON)
  backup: async () => {
    try {
      const database = getDB();
      
      const sheets = await database.collection('sheets')
        .find({})
        .sort({ submittedAt: 1 })
        .toArray();
      
      const votes = await database.collection('votes')
        .find({})
        .sort({ sheet_id: 1, applicant_row: 1, created_at: 1 })
        .toArray();
      
      const selections = await database.collection('selections')
        .find({})
        .sort({ sheet_id: 1, applicant_row: 1 })
        .toArray();
      
      const notes = await database.collection('notes')
        .find({})
        .sort({ sheet_id: 1, applicant_row: 1 })
        .toArray();
      
      const backupData = {
        sheets,
        votes,
        selections,
        notes,
        exportedAt: new Date().toISOString()
      };
      
      return backupData;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  },

  // Get notes for a specific sheet
  getNotesForSheet: async (sheetId) => {
    try {
      const database = getDB();
      const notes = await database.collection('notes')
        .find({ sheet_id: sheetId })
        .toArray();
      
      // Convert to the expected format: { "sheetId-applicantRow": {text, updatedAt} }
      const sheetNotes = {};
      notes.forEach(note => {
        const key = `${sheetId}-${note.applicant_row}`;
        sheetNotes[key] = {
          text: note.notes_text || '',
          updatedAt: note.updated_at
        };
      });
      
      return sheetNotes;
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }
  },

  // Update notes for a specific applicant
  updateNotes: async (sheetId, applicantRow, notesText) => {
    try {
      const database = getDB();
      
      const updatedAt = new Date().toISOString();
      
      const result = await database.collection('notes').findOneAndUpdate(
        { sheet_id: sheetId, applicant_row: applicantRow },
        { 
          $set: { 
            notes_text: notesText,
            updated_at: updatedAt
          }
        },
        { 
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      return {
        text: result.notes_text || '',
        updatedAt: result.updated_at
      };
    } catch (error) {
      console.error('Error updating notes:', error);
      throw error;
    }
  },

  // Get notes for a specific applicant
  getApplicantNotes: async (sheetId, applicantRow) => {
    try {
      const database = getDB();
      const note = await database.collection('notes').findOne({
        sheet_id: sheetId,
        applicant_row: applicantRow
      });
      
      if (!note) {
        return { text: '', updatedAt: null };
      }
      
      return {
        text: note.notes_text || '',
        updatedAt: note.updated_at
      };
    } catch (error) {
      console.error('Error fetching applicant notes:', error);
      throw error;
    }
  },

  // Close database connection
  close: async () => {
    try {
      if (client && isConnected) {
        await client.close();
        isConnected = false;
        db = null;
        console.log('MongoDB connection closed');
      }
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }
};

module.exports = dbOperations;
