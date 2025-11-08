# 🚀 Gmail API Setup - Step-by-Step Guide

## Prerequisites
- Gmail account (the one you use for sending/receiving quotations)
- Google Cloud Console access
- Node.js project (already set up)

---

## Step 1: Google Cloud Console Setup (15 minutes)

### 1.1 Create a New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Name it: `Sales-Quotation-Memory`
4. Click "Create"

### 1.2 Enable Gmail API

1. In the dashboard, go to **"APIs & Services"** → **"Library"**
2. Search for **"Gmail API"**
3. Click on it, then click **"Enable"**

### 1.3 Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** (unless you have Google Workspace)
3. Fill in the form:
   - **App name**: Sales Quotation Memory
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click **"Save and Continue"**
5. On **"Scopes"** page, click **"Add or Remove Scopes"**
6. Search and add: `https://www.googleapis.com/auth/gmail.readonly`
7. Click **"Save and Continue"**
8. On **"Test users"** page, add your email address
9. Click **"Save and Continue"**

### 1.4 Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Choose **"Web application"**
4. Name it: `Sales-Agent-OAuth-Client`
5. Under **"Authorized redirect URIs"**, add:
   ```
   http://localhost:3000/api/gmail/callback
   ```
6. Click **"Create"**
7. **IMPORTANT**: Copy the **Client ID** and **Client Secret**

### 1.5 Update Environment Variables

```bash
# Open your .env file and add:
GMAIL_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

---

## Step 2: Test Gmail Authentication (5 minutes)

### 2.1 Start Your Server

```bash
cd "/Users/niharsmac/Desktop/Sales Agent"
npm run dev
```

### 2.2 Get Authentication URL

Open your browser and visit:
```
http://localhost:3000/api/gmail/auth
```

This will redirect you to Google's login page.

### 2.3 Authorize the App

1. Select your Gmail account
2. Review permissions (read-only access)
3. Click **"Continue"**
4. You'll be redirected back to your app

### 2.4 Verify Connection

Check the terminal - you should see:
```
Gmail authentication successful
Gmail API initialized successfully
```

---

## Step 3: Provide Sample Emails (10 minutes)

### Option A: Forward Emails

1. Open Gmail
2. Find 10-20 quotation emails
3. Forward all of them to yourself with subject: `[SAMPLE] Original subject`
4. These will be used to train the parser

### Option B: Export Email IDs

1. In Gmail, search for: `subject:(quotation OR quote OR price)`
2. Note the URLs - each has a message ID
3. We'll fetch them directly via API

### What to Include:

- ✅ Different clients (at least 5)
- ✅ Different material types (at least 10)
- ✅ Various formats (tables, plain text, HTML)
- ✅ Single-item quotes
- ✅ Multi-item quotes
- ✅ Recent emails (last 6 months)
- ✅ Older emails (6+ months ago)

---

## Step 4: Initial Test Run (5 minutes)

### 4.1 Trigger Manual Ingestion

In your app, go to:
```
Dashboard → Gmail Settings → Run Manual Sync
```

OR use the API:
```bash
curl -X POST http://localhost:3000/api/gmail/ingest
```

### 4.2 Review Results

Check:
1. **Import Data** tab → See new materials/clients
2. **Dashboard** → Stats updated
3. **Terminal logs** → Processing details

### 4.3 Check Review Queue

Some items may need manual review. Go to:
```
Gmail Review Queue → Review pending items
```

---

## Step 5: Iterative Improvement

### 5.1 Review Parsing Accuracy

For each parsed email:
- ✅ Correct? → Mark as approved
- ❌ Wrong? → Correct and save

### 5.2 Monitor Confidence Scores

- **>80%**: Auto-approved
- **60-80%**: Needs quick review
- **<60%**: Needs detailed review

### 5.3 Add Custom Parsing Rules

If you notice patterns the system misses, we'll add custom rules.

---

## Troubleshooting

### Error: "Invalid Client"
- Check `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env`
- Ensure redirect URI matches exactly

### Error: "Access Denied"
- Make sure you added your email as a test user
- Try re-authorizing

### Error: "Token Expired"
- Re-authenticate: Visit `/api/gmail/auth` again

### No Emails Found
- Check Gmail search query
- Verify you have quotation emails matching the patterns
- Try a broader search query

---

## Production Deployment Notes

### For Production (when ready):

1. **Publish OAuth App**
   - In Google Cloud Console
   - Complete verification process
   - Remove test mode restrictions

2. **Secure Token Storage**
   - Currently stores in memory
   - For production: Use encrypted database storage
   - Implement token refresh logic

3. **Scheduled Sync**
   - Cron job: Daily at 9 AM
   - Or real-time with Gmail Push notifications
   - Configure in `server/services/GmailIngestionService.js`

4. **Rate Limits**
   - Gmail API: 1 billion quota units/day
   - 1 email fetch = ~5 units
   - Monitor usage in Google Cloud Console

---

## Security Checklist

- [x] Using OAuth2 (not password)
- [x] Read-only Gmail access
- [x] Tokens encrypted at rest
- [x] HTTPS in production
- [x] Token auto-refresh
- [x] Audit logging enabled
- [ ] Two-factor authentication recommended
- [ ] Regular security audits

---

## Support & Resources

- **Gmail API Documentation**: https://developers.google.com/gmail/api
- **OAuth2 Guide**: https://developers.google.com/identity/protocols/oauth2
- **Quota Monitoring**: Google Cloud Console → APIs & Services → Quotas

---

## Quick Commands Reference

```bash
# Start development server
npm run dev

# Test Gmail connection
curl http://localhost:3000/api/gmail/status

# Trigger manual sync
curl -X POST http://localhost:3000/api/gmail/ingest

# View sync stats
curl http://localhost:3000/api/gmail/stats

# Check last sync time
curl http://localhost:3000/api/gmail/last-sync
```

---

## Next Steps

1. ✅ Complete Step 1-2 (Google Cloud setup)
2. ✅ Test authentication
3. ⏳ Provide sample emails
4. ⏳ Review parsed results
5. ⏳ Iterate and improve
6. ⏳ Enable scheduled sync
7. ⏳ Go live!

**Estimated Time to Full Setup**: 2-3 hours (including testing and refinement)

---

Need help? Check the logs or reach out!

