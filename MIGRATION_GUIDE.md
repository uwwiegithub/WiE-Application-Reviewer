# Migration Guide: JSON to PostgreSQL

## Problem
OnRender's free tier uses ephemeral storage, which means the `data.json` file gets wiped when the service spins down due to inactivity. This causes all sheets to disappear after a few hours.

## Solution
Migrate from JSON file storage to PostgreSQL database for persistent storage.

## Steps to Migrate

### 1. Create PostgreSQL Database on OnRender

1. Go to [OnRender Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `applicant-reviewer-db`
   - **Database**: `applicant_reviewer`
   - **Region**: Same as your backend service
   - **Plan**: **Free**
4. Click **"Create Database"**
5. Wait for it to be created (takes ~2 minutes)

### 2. Add DATABASE_URL to Backend Service

1. Copy the **"External Database URL"** from your PostgreSQL service
2. Go to your backend web service on OnRender
3. Click **"Environment"** in the left sidebar
4. Click **"Add Environment Variable"**
5. Add:
   - **Key**: `DATABASE_URL`
   - **Value**: (paste the External Database URL)
6. Click **"Save Changes"**

### 3. Deploy the Updated Code

```bash
# Commit the changes
git add .
git commit -m "Add PostgreSQL support for persistent storage"
git push origin main
```

OnRender will automatically deploy the changes.

### 4. Verify the Migration

1. Wait for the deployment to complete
2. Check the logs for: "Database tables initialized successfully"
3. Log in to your application
4. Add a new sheet
5. Wait 20+ minutes (or until service spins down)
6. Come back and verify the sheet is still there!

## How It Works

The code now automatically detects if `DATABASE_URL` is set:
- **If DATABASE_URL exists**: Uses PostgreSQL (`database-postgres.js`)
- **If DATABASE_URL is missing**: Falls back to JSON file (`database.js`)

This means:
- ✅ Local development still uses JSON file
- ✅ Production uses PostgreSQL
- ✅ No code changes needed between environments

## Migration Script (Optional)

If you have existing data in your JSON file that you want to migrate to PostgreSQL:

```bash
# Make sure DATABASE_URL is set in your .env file
node server/migrate-to-postgres.js
```

This will:
- Read your existing `data.json` file
- Create PostgreSQL tables
- Import all sheets, votes, and selections
- Create a backup of the original JSON file

## Troubleshooting

### "Error: connect ECONNREFUSED"
- Make sure DATABASE_URL is correctly set in your environment variables
- Verify the PostgreSQL service is running on OnRender

### "relation does not exist"
- The database tables weren't created
- Check the logs for "Database tables initialized successfully"
- If missing, the service needs to restart to run the initialization

### Sheets still disappearing
- Verify DATABASE_URL is set correctly
- Check logs to confirm it's using PostgreSQL: look for "Database tables initialized successfully"
- Make sure you committed and pushed all the changes

## Rollback

If you need to rollback to JSON file storage:
1. Remove the `DATABASE_URL` environment variable from OnRender
2. The app will automatically fall back to using `data.json`

