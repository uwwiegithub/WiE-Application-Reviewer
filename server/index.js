const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const path = require('path');
// Load environment variables
require('dotenv').config();

// Environment variables loaded successfully

// In-memory session store for development (in production, use Redis or database)
const MemoryStore = session.MemoryStore;

// Create a more robust memory store
const sessionStore = new MemoryStore();

// Add error handling for the session store
sessionStore.on('error', (err) => {
  console.error('Session store error:', err);
});

const app = express();
const PORT = process.env.PORT || 5001;

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET', 
  'GOOGLE_CALLBACK_URL',
  'ALLOWED_EMAIL',
  'SESSION_SECRET',
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease check your .env file or run: npm run setup');
  process.exit(1);
}

// Database for persistent storage
const db = require('./database');

// Middleware
app.use(cors({
  origin: [process.env.CLIENT_URL, process.env.SERVER_URL],
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: true,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days instead of 24 hours
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Explicit expiration
  },
  name: 'applicant-reviewer-session',
  rolling: true // Extend session on each request
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if the user's email matches the allowed email
    const email = profile.emails[0].value;
    if (email === process.env.ALLOWED_EMAIL) {
      return done(null, profile);
    } else {
      return done(null, false, { message: 'Access denied. Only authorized users can access this application.' });
    }
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.session.touch();
    return next();
  } else if (req.session && req.session.authenticated && req.session.user) {
    req.session.touch();
    return next();
  }
  
  res.status(401).json({ error: 'Not authenticated' });
};

// Routes
app.get('/auth/google', (req, res, next) => {
  // Clear any existing session data to force fresh authentication
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      
      // Force re-authentication by adding prompt=consent
      passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'consent', // Force consent screen
        access_type: 'offline' // Request refresh token
      })(req, res, next);
    });
  } else {
    // Force re-authentication by adding prompt=consent
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      prompt: 'consent', // Force consent screen
      access_type: 'offline' // Request refresh token
    })(req, res, next);
  }
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Check if the user's email matches the allowed email
    if (req.user && req.user.emails && req.user.emails[0]) {
      const userEmail = req.user.emails[0].value;
      
      if (userEmail === process.env.ALLOWED_EMAIL) {
        // Store user data in session
        req.session.user = req.user;
        req.session.authenticated = true;
        req.session.authenticatedAt = new Date().toISOString();
        
        // Ensure session is saved before redirecting
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            return res.redirect(`${process.env.CLIENT_URL}?error=session_error`);
          }
          
          res.redirect(`${process.env.CLIENT_URL}?auth=success`);
        });
      } else {
        console.error('User email not authorized:', userEmail);
        res.redirect(`${process.env.CLIENT_URL}?error=access_denied`);
      }
    } else {
      console.error('User object not properly set after authentication');
      res.redirect(`${process.env.CLIENT_URL}?error=user_data_missing`);
    }
  }
);

app.get('/auth/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session during logout:', err);
      }
      
      // Clear the session cookie
      res.clearCookie('applicant-reviewer-session');
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'No session to clear' });
  }
});

app.get('/auth/status', (req, res) => {
  // Check passport authentication first
  if (req.isAuthenticated()) {
    // Extend session on each status check
    req.session.touch();
    res.json({ 
      authenticated: true, 
      user: req.user
    });
  } else if (req.session && req.session.authenticated && req.session.user) {
    // Check if we have stored user data in session
    res.json({ 
      authenticated: true, 
      user: req.session.user
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Session refresh endpoint
app.post('/auth/refresh', ensureAuthenticated, (req, res) => {
  try {
    // Touch the session to extend it
    req.session.touch();
    
    res.json({ 
      message: 'Session refreshed successfully',
      user: req.user
    });
  } catch (error) {
    console.error('Error refreshing session:', error);
    res.status(500).json({ error: 'Failed to refresh session' });
  }
});

// Debug endpoint to check session details
app.get('/auth/debug', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    cookies: req.headers.cookie ? 'present' : 'missing'
  });
});





// Google Sheets API helper function
async function getGoogleSheetsClient() {
  try {
    // Try to use credentials file first (more reliable)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      return google.sheets({ version: 'v4', auth });
    }
    
    // Fallback to environment variables
    let privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('GOOGLE_SHEETS_PRIVATE_KEY is not set');
    }
    
    // Remove any quotes and clean the key
    privateKey = privateKey.replace(/"/g, '').trim();
    
    // If the key doesn't have BEGIN/END markers, add them
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
    }
    
    // Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: privateKey
    },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error creating Google Sheets client:', error);
    throw error;
  }
}

// Submit new Google Sheet
app.post('/api/sheets', ensureAuthenticated, async (req, res) => {
  try {
    const { year, term, sheetUrl } = req.body;
    
    if (!year || !term || !sheetUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract sheet ID from URL
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const sheetId = sheetIdMatch[1];
    
    // Fetch sheet data
    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      includeGridData: false
    });

    const sheetTitle = response.data.properties.title;
    
    const newSheet = {
      id: Date.now().toString(),
      year,
      term,
      sheetUrl,
      sheetId,
      sheetTitle,
      submittedAt: new Date().toISOString()
    };

    await db.addSheet(newSheet);
    
    res.json(newSheet);
  } catch (error) {
    console.error('Error submitting sheet:', error);
    res.status(500).json({ error: 'Failed to submit sheet' });
  }
});

// Get all sheets
app.get('/api/sheets', ensureAuthenticated, async (req, res) => {
  try {
    const sheets = await db.getSheets();
    res.json(sheets);
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
});

// Delete a specific sheet
app.delete('/api/sheets/:sheetId', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId) {
      return res.status(400).json({ error: 'Missing sheet ID' });
    }

    const result = await db.deleteSheet(sheetId);
    
    res.json({ 
      message: 'Sheet deleted successfully',
      deletedSheetId: sheetId
    });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    res.status(500).json({ error: 'Failed to delete sheet' });
  }
});

// Get applicants from a specific sheet
app.get('/api/sheets/:sheetId/applicants', ensureAuthenticated, async (req, res) => {
  try {
      const { sheetId } = req.params;
  const sheet = await db.getSheetById(sheetId);
    
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheet.sheetId,
      range: 'A:Z' // Get all columns
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ applicants: [], headers: [] });
    }

    const headers = rows[0];
    
    // Clean and validate headers to prevent duplication issues
    const cleanHeaders = headers.map(header => header ? header.trim() : '').filter(header => header !== '');
    
    // Handle duplicate headers by appending "(return director)" to the first duplicate
    const processedHeaders = [];
    const headerCounts = {};
    
    // First pass: count how many times each header appears
    cleanHeaders.forEach(header => {
      headerCounts[header] = (headerCounts[header] || 0) + 1;
    });
    
    // Second pass: process headers, only adding suffix to duplicates
    const seenHeaders = new Set();
    cleanHeaders.forEach(header => {
      if (headerCounts[header] > 1) {
        // This header has duplicates
        if (!seenHeaders.has(header)) {
          // First occurrence gets the suffix
          const duplicateHeader = `${header} (return director)`;
          processedHeaders.push(duplicateHeader);
          seenHeaders.add(header);
        } else {
          // Subsequent occurrence keeps original name
          processedHeaders.push(header);
        }
      } else {
        // No duplicates, keep original name
        processedHeaders.push(header);
      }
    });
    
    // Use processedHeaders for all subsequent processing
    const finalHeaders = processedHeaders;
    
    // Find all columns with "First Choice Directorship" in the name (case insensitive)
    const roleColumnIndices = finalHeaders
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => {
        if (!header) return false;
        const lowerHeader = header.toLowerCase();
        return lowerHeader.includes('first choice directorship') || 
               lowerHeader.includes('first choice') ||
               lowerHeader.includes('directorship');
      });
    
    // If no role columns found, log a warning
    if (roleColumnIndices.length === 0) {
      console.warn('No role columns found in sheet headers');
    }
    
    // Find name and email column indices for validation
    const nameColumnIndex = finalHeaders.findIndex(header => 
      header && (
        header.toLowerCase().includes('name') ||
        header.toLowerCase().includes('full name') ||
        header.toLowerCase().includes('applicant name')
      )
    );
    const emailColumnIndex = finalHeaders.findIndex(header => 
      header && (
        header.toLowerCase().includes('email') ||
        header.toLowerCase().includes('email address') ||
        header.toLowerCase().includes('e-mail')
      )
    );
    
    if (nameColumnIndex === -1) {
      console.warn('No name column found in sheet headers');
    }
    if (emailColumnIndex === -1) {
      console.warn('No email column found in sheet headers');
    }
    
    const applicants = rows.slice(1)
      .map((row, index) => {
        const applicant = {};
        
        // CRITICAL FIX: Map headers to row data correctly
        // The issue was that cleanHeaders.forEach was using colIndex which didn't correspond to row indices
        finalHeaders.forEach((header, headerIndex) => {
          if (header && header.trim() !== '') {
            // Find the actual column index in the original headers array
            const originalColIndex = headers.findIndex(h => h === header);
            if (originalColIndex !== -1) {
              const cellValue = row[originalColIndex];
              applicant[header.trim()] = cellValue !== undefined && cellValue !== null ? String(cellValue).trim() : '';
            } else {
              // Fallback: use headerIndex if header not found in original headers
              const cellValue = row[headerIndex];
              applicant[header.trim()] = cellValue !== undefined && cellValue !== null ? String(cellValue).trim() : '';
            }
          }
        });
        
        applicant.rowIndex = index + 1;
        
        // Find the first non-empty role value from any of the role columns
        let role = 'Unknown Role';
        if (roleColumnIndices.length > 0) {
          for (const { index: colIndex } of roleColumnIndices) {
            const roleValue = row[colIndex];
            if (roleValue && roleValue.trim() !== '') {
              role = roleValue.trim();
              break;
            }
          }
        } else {
          // Fallback: try to find any column that might contain role information
          const potentialRoleHeaders = finalHeaders.filter(header => 
            header && (
              header.toLowerCase().includes('role') ||
              header.toLowerCase().includes('position') ||
              header.toLowerCase().includes('title') ||
              header.toLowerCase().includes('job')
            )
          );
          
          if (potentialRoleHeaders.length > 0) {
            for (const header of potentialRoleHeaders) {
              const colIndex = finalHeaders.indexOf(header);
              const roleValue = row[colIndex];
              if (roleValue && roleValue.trim() !== '') {
                role = roleValue.trim();
                break;
              }
            }
          }
        }
        
        applicant.role = role;
        
        // Log warning for rows with Unknown Role
        if (role === 'Unknown Role') {
          console.warn(`Row ${index + 1} has no role value`);
        }
        
        return applicant;
      })
      .filter(applicant => {
        // Only include rows that have both name and email
        const hasName = nameColumnIndex >= 0 && applicant[finalHeaders[nameColumnIndex]] && applicant[finalHeaders[nameColumnIndex]].trim() !== '';
        const hasEmail = emailColumnIndex >= 0 && applicant[finalHeaders[emailColumnIndex]] && applicant[finalHeaders[emailColumnIndex]].trim() !== '';
        
        return hasName && hasEmail;
      });

    // Group by role and ensure clean data structure
    const groupedApplicants = {};
    applicants.forEach(applicant => {
      const role = applicant.role;
      if (!groupedApplicants[role]) {
        groupedApplicants[role] = [];
      }
      
      // Create a clean copy of the applicant data to prevent any reference issues
      const cleanApplicant = { ...applicant };
      groupedApplicants[role].push(cleanApplicant);
    });
    
    // Fetch votes for this sheet to enable sorting
    let sheetVotes = {};
    try {
      const votesResponse = await db.getVotesForSheet(sheetId);
      sheetVotes = votesResponse;
    } catch (error) {
      console.warn('Could not fetch votes for sorting, continuing without vote data');
    }
    
    // Sort applicants within each role by vote count (most votes first)
    Object.keys(groupedApplicants).forEach(role => {
      groupedApplicants[role].sort((a, b) => {
        const votesA = sheetVotes[`${sheetId}-${a.rowIndex}`] ? sheetVotes[`${sheetId}-${a.rowIndex}`].length : 0;
        const votesB = sheetVotes[`${sheetId}-${b.rowIndex}`] ? sheetVotes[`${sheetId}-${b.rowIndex}`].length : 0;
        return votesB - votesA; // Descending order (most votes first)
      });
      
      // Sort applicants within each role by vote count (most votes first)
    });

    res.json({
      applicants: groupedApplicants,
      headers: finalHeaders,
      totalApplicants: applicants.length
    });
  } catch (error) {
    console.error('Error fetching applicants:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// Submit a vote for an applicant
app.post('/api/votes', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId, applicantRow, voterName } = req.body;
    
    if (!sheetId || !applicantRow || !voterName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const votes = await db.addVote(sheetId, applicantRow, voterName);
    
    res.json({ 
      message: 'Vote submitted successfully',
      totalVotes: votes.length
    });
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

// Get votes for applicants in a sheet
app.get('/api/sheets/:sheetId/votes', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId } = req.params;
    
    const sheetVotes = await db.getVotesForSheet(sheetId);
    
    res.json(sheetVotes);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// Get selections for applicants in a sheet
app.get('/api/sheets/:sheetId/selections', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId } = req.params;
    const selections = await db.getSelections(sheetId);
    res.json(selections);
  } catch (error) {
    console.error('Error fetching selections:', error);
    res.status(500).json({ error: 'Failed to fetch selections' });
  }
});

// Update selections for a specific applicant
app.put('/api/sheets/:sheetId/selections/:applicantRow', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId, applicantRow } = req.params;
    const { selectedForInterview, selectedForHiring } = req.body;
    
    if (selectedForInterview === undefined || selectedForHiring === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const selections = await db.updateSelections(sheetId, applicantRow, {
      selectedForInterview,
      selectedForHiring
    });
    
    res.json(selections);
  } catch (error) {
    console.error('Error updating selections:', error);
    res.status(500).json({ error: 'Failed to update selections', details: error.message });
  }
});

// Delete a specific vote
app.delete('/api/votes/:sheetId/:applicantRow/:voterName', ensureAuthenticated, async (req, res) => {
  try {
    const { sheetId, applicantRow, voterName } = req.params;
    
    if (!sheetId || !applicantRow || !voterName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.deleteVote(sheetId, applicantRow, voterName);
    
    res.json({ 
      message: 'Vote deleted successfully',
      deletedVoter: voterName
    });
  } catch (error) {
    console.error('Error deleting vote:', error);
    res.status(500).json({ error: 'Failed to delete vote' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Initialize database and start server
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database initialized successfully`);
    
    // Set up session cleanup every hour
    setInterval(() => {
      const store = app.get('session store') || app.locals.sessionStore;
      if (store && store.all) {
        store.all((err, sessions) => {
          if (err) {
            console.error('Error during session cleanup:', err);
            return;
          }
          console.log(`Active sessions: ${Object.keys(sessions).length}`);
        });
      }
    }, 60 * 60 * 1000); // Every hour
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
