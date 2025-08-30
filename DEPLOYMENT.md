# Deployment Guide

This guide covers deploying the Applicant Reviewer application to various platforms.

## Prerequisites

Before deploying, ensure you have:
1. ✅ Set up Google Cloud Project with required APIs
2. ✅ Created OAuth 2.0 credentials
3. ✅ Created Service Account for Google Sheets API
4. ✅ Tested the application locally

## Environment Variables for Production

Update your `.env` file with production values:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Allowed Gmail Account
ALLOWED_EMAIL=your_email@gmail.com

# Server Configuration
PORT=5001
SESSION_SECRET=your_strong_production_session_secret
NODE_ENV=production

# Google Sheets API
GOOGLE_SHEETS_PRIVATE_KEY=your_production_private_key
GOOGLE_SHEETS_CLIENT_EMAIL=your_production_service_account_email
```

## Platform-Specific Deployment

### 1. Heroku

#### A. Prepare for Heroku
1. Install Heroku CLI: `npm install -g heroku`
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`

#### B. Set Environment Variables
```bash
heroku config:set GOOGLE_CLIENT_ID=your_client_id
heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
heroku config:set GOOGLE_CALLBACK_URL=https://your-app-name.herokuapp.com/auth/google/callback
heroku config:set ALLOWED_EMAIL=your_email@gmail.com
heroku config:set SESSION_SECRET=your_session_secret
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_SHEETS_PRIVATE_KEY=your_private_key
heroku config:set GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
```

#### C. Deploy
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### D. Open App
```bash
heroku open
```

### 2. Railway

#### A. Prepare for Railway
1. Go to [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Create new project

#### B. Configure Environment
1. Go to Variables tab
2. Add all environment variables from your `.env` file
3. Update `GOOGLE_CALLBACK_URL` to your Railway domain

#### C. Deploy
1. Railway automatically deploys on git push
2. Monitor deployment in Railway dashboard

### 3. Render

#### A. Prepare for Render
1. Go to [Render](https://render.com/)
2. Connect your GitHub repository
3. Create new Web Service

#### B. Configure Service
- **Name**: applicant-reviewer
- **Environment**: Node
- **Build Command**: `npm run install-all && npm run build`
- **Start Command**: `npm run server`
- **Plan**: Free or paid

#### C. Set Environment Variables
Add all variables from your `.env` file in the Environment tab.

#### D. Deploy
Render automatically deploys on git push to main branch.

### 4. Vercel (Frontend) + Railway/Render (Backend)

#### A. Deploy Backend
Follow Railway or Render instructions above.

#### B. Deploy Frontend to Vercel
1. Go to [Vercel](https://vercel.com/)
2. Import your GitHub repository
3. Configure build settings:
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm run install-all`

#### C. Update Frontend Configuration
Update `client/package.json` proxy to your backend URL:
```json
{
  "proxy": "https://your-backend-url.com"
}
```

#### D. Set Environment Variables
In Vercel dashboard, add:
```
REACT_APP_API_URL=https://your-backend-url.com
```

### 5. Docker Deployment

#### A. Create Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm run install-all

# Copy source code
COPY . .

# Build client
RUN npm run build

# Expose port
EXPOSE 5001

# Start server
CMD ["npm", "run", "server"]
```

#### B. Build and Run
```bash
# Build image
docker build -t applicant-reviewer .

# Run container
docker run -p 5001:5001 --env-file .env applicant-reviewer
```

#### C. Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./server/data:/app/server/data
```

Run with:
```bash
docker-compose up -d
```

## Post-Deployment Checklist

### 1. Update Google Cloud Console
- Add production callback URLs to OAuth 2.0 credentials
- Verify API quotas and billing

### 2. Test Application
- ✅ Login with Google OAuth
- ✅ Submit a test Google Sheet
- ✅ Review applicants
- ✅ Submit votes
- ✅ Check vote counting

### 3. Monitor Performance
- Check application logs
- Monitor API usage
- Set up error tracking (e.g., Sentry)

### 4. Security Review
- ✅ HTTPS enabled
- ✅ Environment variables secured
- ✅ CORS properly configured
- ✅ Session security enabled

## Troubleshooting Deployment

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are in package.json
   - Check build logs for specific errors

2. **Environment Variable Issues**
   - Verify all variables are set in deployment platform
   - Check for typos in variable names
   - Ensure sensitive data is properly escaped

3. **CORS Errors**
   - Update CORS origin in `server/index.js`
   - Verify frontend and backend URLs match

4. **Database Issues**
   - Check file permissions for JSON database
   - Verify data directory is writable
   - Consider using external database for production

### Getting Help

1. Check deployment platform logs
2. Review application logs
3. Test locally with production environment variables
4. Check Google Cloud Console for API issues

## Scaling Considerations

### For High Traffic
1. **Database**: Replace JSON file with PostgreSQL/MongoDB
2. **Caching**: Add Redis for session storage
3. **Load Balancing**: Use multiple server instances
4. **CDN**: Serve static assets from CDN

### For Multiple Users
1. **Database**: Add user management system
2. **Permissions**: Implement role-based access control
3. **Audit Logs**: Track all actions and changes

## Backup and Recovery

### Database Backups
```bash
# Manual backup
npm run backup

# Automated backup (add to cron)
0 2 * * * cd /path/to/app && npm run backup
```

### Environment Recovery
1. Keep `.env` file backed up securely
2. Document all configuration steps
3. Test recovery process regularly
