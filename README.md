# Applicant Reviewer

A React web application that allows club administrators to review applicants from Google Sheets, with the ability to vote on candidates and track voting results.

## Features

- **Google OAuth Authentication**: Secure login with Google accounts
- **Restricted Access**: Only authorized Gmail accounts can access the application
- **Google Sheets Integration**: Submit and parse Google Sheets containing applicant information
- **Applicant Review**: Navigate through applicants organized by role/directorship
- **Voting System**: Vote for applicants with your name
- **Vote Tracking**: View vote counts and sort applicants by popularity
- **Responsive Design**: Modern, mobile-friendly interface

## Prerequisites

Before running this application, you'll need:

1. **Node.js** (version 16 or higher)
2. **Google Cloud Project** with the following APIs enabled:
   - Google Sheets API
   - Google+ API (for OAuth)
3. **Google OAuth 2.0 Credentials**
4. **Google Service Account** (for accessing Google Sheets)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd applicant_reviewer
npm run install-all
```

### 2. Google Cloud Setup

#### A. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google+ API (for OAuth)
4. **Important**: You'll also need to configure the OAuth consent screen before creating credentials

#### B. Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace organization)
3. Fill in the required information:
   - **App name**: "Applicant Reviewer" (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click "Save and Continue"
5. On "Scopes" page, click "Save and Continue"
6. On "Test users" page, add your email address as a test user
7. Click "Save and Continue"
8. Review and click "Back to Dashboard"

#### C. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application" as application type
4. Add authorized redirect URIs:
   - `http://localhost:5001/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
5. Click "Create"
6. Note down your Client ID and Client Secret

#### D. Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - **Service account name**: "applicant-reviewer-sheets" (or your preferred name)
   - **Service account ID**: Will auto-generate
   - **Description**: "Service account for accessing Google Sheets in Applicant Reviewer app"
4. Click "Create and Continue"
5. **Permissions (optional)**: Click "Select a role"
   - Search for and select: **"Google Sheets API > Sheets API > Sheets API Reader"**
   - This gives read-only access to Google Sheets
6. Click "Continue"
7. **Principals with access (optional)**: Leave this blank - no additional users need access
8. Click "Done"
9. Click on your newly created service account
10. Go to "Keys" tab
11. Click "Add Key" > "Create new key"
12. Choose "JSON" format
13. Download the JSON key file
14. Note down the `client_email` and `private_key` from the JSON

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. **Generate a Session Secret** (required for security):
   ```bash
   # Option A: Use the setup script (recommended)
   npm run setup
   
   # Option B: Generate manually
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   
   # Option C: Use an online generator (less secure)
   # Go to: https://generate-secret.vercel.app/64
   ```

3. Edit `.env` with your actual values:
   ```env
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_CALLBACK_URL=http://localhost:5001/auth/google/callback

   # Allowed Gmail Account (only this account can access the app)
   ALLOWED_EMAIL=your_email@gmail.com

   # Server Configuration
   PORT=5001
   SESSION_SECRET=your_random_session_secret_here
   # Note: SESSION_SECRET should be a long, random string for security

   # Client Configuration
   CLIENT_URL=http://localhost:3000
   SERVER_URL=http://localhost:5001

   # Google Sheets API
   GOOGLE_SHEETS_PRIVATE_KEY=your_private_key_here
   GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email_here
   ```

4. Create client environment file:
   ```bash
   # Create client/.env file
   echo "REACT_APP_SERVER_URL=http://localhost:5001" > client/.env
   ```

### 4. Google Sheets Permissions

For each Google Sheet you want to submit:

1. **Option A: Share with Service Account**
   - Share the sheet with your service account email
   - Give it "Viewer" permissions

2. **Option B: Make Public (Less Secure)**
   - Right-click on the sheet tab
   - Select "Share" > "Change to anyone with the link"
   - Set to "Viewer"

**Note**: Option A is recommended for security. Option B makes the sheet accessible to anyone with the link.

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start both the backend server (port 5001) and frontend (port 3000).

### Production Mode

```bash
npm run build
npm run server
```

### Production Deployment

When deploying to production, update your `.env` file:

```env
# Production URLs (replace with your actual domain)
CLIENT_URL=https://yourdomain.com
SERVER_URL=https://yourdomain.com

# Update Google OAuth callback URL
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

**Important**: Update your Google Cloud Console OAuth settings to include your production domain in the authorized redirect URIs.

## Usage

### 1. Login
- Navigate to `http://localhost:3000`
- Click "Sign in with Google"
- Use your authorized Gmail account

### 2. Submit Google Sheets
- Click "Add New Sheet" button
- Fill in:
  - **Year**: e.g., 2026
  - **Term**: W (Winter), F (Fall), or S (Spring)
  - **Google Sheet URL**: Full URL to your Google Sheet

### 3. Review Applicants
- Click on any submitted sheet card
- Navigate through applicants using Previous/Next buttons
- Applicants are grouped by their "First Choice Directorship"
- View all applicant details from the sheet

### 4. Vote for Applicants
- Enter your name in the voting section
- Click "Vote for Applicant"
- Each person can only vote once per applicant

### 5. Track Results
- Vote counts are displayed on each applicant card
- Applicants are sorted by vote count (most to least)

## Google Sheet Format Requirements

Your Google Sheet must have these columns:
- **Name**: Applicant's full name
- **First Choice Directorship**: The role they're applying for (this is used for grouping)
- **Email**: Applicant's email address
- **Any other columns**: Will be displayed but not used for grouping

Example structure:
```
| Timestamp | Name | Email | First Choice Directorship | Are you an undergraduate student? | Other Info |
|-----------|------|-------|---------------------------|-----------------------------------|------------|
| 2024-01-15 | John Doe | john@email.com | Marketing Director | Yes | Additional details |
| 2024-01-15 | Jane Smith | jane@email.com | Events Coordinator | No | More info |
```

## Understanding SESSION_SECRET

### What is SESSION_SECRET?

The `SESSION_SECRET` is a cryptographic key used by Express.js to:
- **Sign session cookies**: Ensures session data hasn't been tampered with
- **Encrypt session data**: Protects user session information
- **Prevent session hijacking**: Makes it extremely difficult for attackers to forge valid sessions

### Why is it important?

- **Security**: Without a strong secret, attackers could potentially hijack user sessions
- **Required**: Express.js requires this value to function properly with sessions
- **Unique per app**: Each application should have its own, unique secret

### How to generate a strong SESSION_SECRET:

1. **Use the setup script** (recommended):
   ```bash
   npm run setup
   ```

2. **Generate manually with Node.js**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Use an online generator** (less secure, only for development):
   - Visit: https://generate-secret.vercel.app/64
   - Copy the generated 64-character string

### Example SESSION_SECRET:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0
```

## Troubleshooting

### Common Issues

1. **"Access denied" error during login**
   - Ensure your email matches `ALLOWED_EMAIL` in `.env`
   - Check that Google OAuth is properly configured
   - Verify your email is added as a test user in OAuth consent screen
   - Check that OAuth consent screen is configured before creating credentials

2. **"Failed to submit sheet" error**
   - Verify the Google Sheet URL is correct
   - Ensure the service account has access to the sheet
   - Check that the sheet has the required columns

3. **"Failed to fetch applicants" error**
   - Verify the service account credentials in `.env`
   - Check that the Google Sheets API is enabled
   - Ensure the sheet is accessible to the service account

4. **CORS errors**
   - Verify the `origin` in `server/index.js` matches your frontend URL
   - Check that `credentials: true` is set in CORS configuration

### Permission Issues with Google Sheets

If you encounter permission issues sharing Google Sheets:

**Alternative Solutions:**

1. **Use a Shared Drive**
   - Move your sheets to a Google Shared Drive
   - Add the service account as a member with Viewer access

2. **Create a Public Sheet**
   - Make a copy of your sheet
   - Set sharing to "Anyone with the link can view"
   - Use the copy for the application

3. **Manual CSV Export**
   - Export your Google Sheet as CSV
   - Upload to a cloud storage service (Google Drive, Dropbox)
   - Share the file with the service account

4. **Use Google Forms Instead**
   - Create a Google Form for applications
   - Responses automatically go to a Google Sheet
   - Share the responses sheet with the service account

## Security Considerations

- **Environment Variables**: Never commit `.env` files to version control
- **Session Secret**: Use a strong, random string for `SESSION_SECRET`
- **Google Sheets Access**: Limit service account permissions to only what's necessary
- **HTTPS**: Use HTTPS in production for secure cookie transmission

## Deployment

### Heroku
1. Set environment variables in Heroku dashboard
2. Deploy using Heroku Git or GitHub integration

### Vercel/Netlify (Frontend) + Railway/Render (Backend)
1. Deploy backend to Railway/Render
2. Deploy frontend to Vercel/Netlify
3. Update CORS origins and callback URLs

### Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5001
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Google Cloud Console logs
3. Check browser console for frontend errors
4. Check server logs for backend errors
