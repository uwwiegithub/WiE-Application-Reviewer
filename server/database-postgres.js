const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
const initializeDB = async () => {
  const client = await pool.connect();
  try {
    // Create sheets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sheets (
        id VARCHAR(255) PRIMARY KEY,
        year VARCHAR(10) NOT NULL,
        term VARCHAR(10) NOT NULL,
        sheet_url TEXT NOT NULL,
        sheet_id VARCHAR(255) NOT NULL,
        sheet_title TEXT NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        sheet_id VARCHAR(255) NOT NULL,
        applicant_row INTEGER NOT NULL,
        voter_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(sheet_id, applicant_row, voter_name)
      )
    `);

    // Create selections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS selections (
        id SERIAL PRIMARY KEY,
        sheet_id VARCHAR(255) NOT NULL,
        applicant_row INTEGER NOT NULL,
        selected_for_interview BOOLEAN DEFAULT FALSE,
        selected_for_hiring BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(sheet_id, applicant_row)
      )
    `);

    // Create notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        sheet_id VARCHAR(255) NOT NULL,
        applicant_row INTEGER NOT NULL,
        notes_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(sheet_id, applicant_row)
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_votes_sheet_id ON votes(sheet_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_selections_sheet_id ON selections(sheet_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_sheet_id ON notes(sheet_id);
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Database operations
const db = {
  // Initialize database
  init: initializeDB,

  // Get all sheets
  getSheets: async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, year, term, sheet_url as "sheetUrl", sheet_id as "sheetId", 
               sheet_title as "sheetTitle", submitted_at as "submittedAt"
        FROM sheets 
        ORDER BY submitted_at DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('Error fetching sheets:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Add new sheet
  addSheet: async (sheet) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO sheets (id, year, term, sheet_url, sheet_id, sheet_title, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, year, term, sheet_url as "sheetUrl", sheet_id as "sheetId", 
                  sheet_title as "sheetTitle", submitted_at as "submittedAt"
      `, [sheet.id, sheet.year, sheet.term, sheet.sheetUrl, sheet.sheetId, sheet.sheetTitle, sheet.submittedAt]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error adding sheet:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get sheet by ID
  getSheetById: async (id) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, year, term, sheet_url as "sheetUrl", sheet_id as "sheetId", 
               sheet_title as "sheetTitle", submitted_at as "submittedAt"
        FROM sheets 
        WHERE id = $1
      `, [id]);
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching sheet by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Delete a sheet and all associated votes and selections
  deleteSheet: async (id) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get sheet info before deletion
      const sheetResult = await client.query('SELECT * FROM sheets WHERE id = $1', [id]);
      if (sheetResult.rows.length === 0) {
        throw new Error('Sheet not found');
      }
      const deletedSheet = sheetResult.rows[0];

      // Delete associated votes
      const votesResult = await client.query('DELETE FROM votes WHERE sheet_id = $1', [id]);
      
      // Delete associated selections
      const selectionsResult = await client.query('DELETE FROM selections WHERE sheet_id = $1', [id]);
      
      // Delete associated notes
      const notesResult = await client.query('DELETE FROM notes WHERE sheet_id = $1', [id]);
      
      // Delete the sheet
      await client.query('DELETE FROM sheets WHERE id = $1', [id]);

      await client.query('COMMIT');
      
      return { 
        success: true, 
        deletedSheet, 
        removedVoteKeys: votesResult.rowCount,
        removedSelections: selectionsResult.rowCount,
        removedNotes: notesResult.rowCount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting sheet:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get all votes
  getVotes: async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT sheet_id, applicant_row, voter_name
        FROM votes 
        ORDER BY sheet_id, applicant_row, created_at
      `);
      
      // Convert to the expected format: { "sheetId-applicantRow": [voterNames] }
      const votes = {};
      result.rows.forEach(row => {
        const key = `${row.sheet_id}-${row.applicant_row}`;
        if (!votes[key]) {
          votes[key] = [];
        }
        votes[key].push(row.voter_name);
      });
      
      return votes;
    } catch (error) {
      console.error('Error fetching votes:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Add vote
  addVote: async (sheetId, applicantRow, voterName) => {
    const client = await pool.connect();
    try {
      // Insert the vote (will fail if duplicate due to UNIQUE constraint)
      await client.query(`
        INSERT INTO votes (sheet_id, applicant_row, voter_name)
        VALUES ($1, $2, $3)
      `, [sheetId, applicantRow, voterName]);
      
      // Get all votes for this applicant
      const result = await client.query(`
        SELECT voter_name
        FROM votes 
        WHERE sheet_id = $1 AND applicant_row = $2
        ORDER BY created_at
      `, [sheetId, applicantRow]);
      
      return result.rows.map(row => row.voter_name);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('You have already voted for this applicant');
      }
      console.error('Error adding vote:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get votes for a specific sheet
  getVotesForSheet: async (sheetId) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT applicant_row, voter_name
        FROM votes 
        WHERE sheet_id = $1
        ORDER BY applicant_row, created_at
      `, [sheetId]);
      
      // Convert to the expected format: { "sheetId-applicantRow": [voterNames] }
      const sheetVotes = {};
      result.rows.forEach(row => {
        const key = `${sheetId}-${row.applicant_row}`;
        if (!sheetVotes[key]) {
          sheetVotes[key] = [];
        }
        sheetVotes[key].push(row.voter_name);
      });
      
      return sheetVotes;
    } catch (error) {
      console.error('Error fetching votes for sheet:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Delete a specific vote
  deleteVote: async (sheetId, applicantRow, voterName) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM votes 
        WHERE sheet_id = $1 AND applicant_row = $2 AND voter_name = $3
      `, [sheetId, applicantRow, voterName]);
      
      if (result.rowCount === 0) {
        throw new Error('Vote not found');
      }
      
      // Get remaining votes for this applicant
      const remainingResult = await client.query(`
        SELECT voter_name
        FROM votes 
        WHERE sheet_id = $1 AND applicant_row = $2
        ORDER BY created_at
      `, [sheetId, applicantRow]);
      
      return { 
        success: true, 
        remainingVoters: remainingResult.rows.map(row => row.voter_name)
      };
    } catch (error) {
      console.error('Error deleting vote:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get selections for a specific sheet
  getSelections: async (sheetId) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT applicant_row, selected_for_interview, selected_for_hiring, updated_at
        FROM selections 
        WHERE sheet_id = $1
      `, [sheetId]);
      
      // Convert to the expected format: { "sheetId-applicantRow": {selections} }
      const sheetSelections = {};
      result.rows.forEach(row => {
        const key = `${sheetId}-${row.applicant_row}`;
        sheetSelections[key] = {
          selectedForInterview: row.selected_for_interview,
          selectedForHiring: row.selected_for_hiring,
          updatedAt: row.updated_at.toISOString()
        };
      });
      
      return sheetSelections;
    } catch (error) {
      console.error('Error fetching selections:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Update selections for a specific applicant
  updateSelections: async (sheetId, applicantRow, selections) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO selections (sheet_id, applicant_row, selected_for_interview, selected_for_hiring, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (sheet_id, applicant_row)
        DO UPDATE SET 
          selected_for_interview = EXCLUDED.selected_for_interview,
          selected_for_hiring = EXCLUDED.selected_for_hiring,
          updated_at = NOW()
        RETURNING selected_for_interview, selected_for_hiring, updated_at
      `, [sheetId, applicantRow, selections.selectedForInterview, selections.selectedForHiring]);
      
      const row = result.rows[0];
      return {
        selectedForInterview: row.selected_for_interview,
        selectedForHiring: row.selected_for_hiring,
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error updating selections:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get selections for a specific applicant
  getApplicantSelections: async (sheetId, applicantRow) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT selected_for_interview, selected_for_hiring, updated_at
        FROM selections 
        WHERE sheet_id = $1 AND applicant_row = $2
      `, [sheetId, applicantRow]);
      
      if (result.rows.length === 0) {
        return { selectedForInterview: false, selectedForHiring: false };
      }
      
      const row = result.rows[0];
      return {
        selectedForInterview: row.selected_for_interview,
        selectedForHiring: row.selected_for_hiring,
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error fetching applicant selections:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Backup database (export to JSON)
  backup: async () => {
    const client = await pool.connect();
    try {
      const sheets = await client.query('SELECT * FROM sheets ORDER BY submitted_at');
      const votes = await client.query('SELECT * FROM votes ORDER BY sheet_id, applicant_row, created_at');
      const selections = await client.query('SELECT * FROM selections ORDER BY sheet_id, applicant_row');
      
      const backupData = {
        sheets: sheets.rows,
        votes: votes.rows,
        selections: selections.rows,
        exportedAt: new Date().toISOString()
      };
      
      return backupData;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get notes for a specific sheet
  getNotesForSheet: async (sheetId) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT applicant_row, notes_text, updated_at
        FROM notes 
        WHERE sheet_id = $1
      `, [sheetId]);
      
      // Convert to the expected format: { "sheetId-applicantRow": {text, updatedAt} }
      const sheetNotes = {};
      result.rows.forEach(row => {
        const key = `${sheetId}-${row.applicant_row}`;
        sheetNotes[key] = {
          text: row.notes_text || '',
          updatedAt: row.updated_at ? row.updated_at.toISOString() : null
        };
      });
      
      return sheetNotes;
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Update notes for a specific applicant
  updateNotes: async (sheetId, applicantRow, notesText) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO notes (sheet_id, applicant_row, notes_text, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (sheet_id, applicant_row)
        DO UPDATE SET 
          notes_text = EXCLUDED.notes_text,
          updated_at = NOW()
        RETURNING notes_text, updated_at
      `, [sheetId, applicantRow, notesText]);
      
      const row = result.rows[0];
      return {
        text: row.notes_text || '',
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error updating notes:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Get notes for a specific applicant
  getApplicantNotes: async (sheetId, applicantRow) => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT notes_text, updated_at
        FROM notes 
        WHERE sheet_id = $1 AND applicant_row = $2
      `, [sheetId, applicantRow]);
      
      if (result.rows.length === 0) {
        return { text: '', updatedAt: null };
      }
      
      const row = result.rows[0];
      return {
        text: row.notes_text || '',
        updatedAt: row.updated_at ? row.updated_at.toISOString() : null
      };
    } catch (error) {
      console.error('Error fetching applicant notes:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Close database connection pool
  close: async () => {
    await pool.end();
  }
};

module.exports = db;
