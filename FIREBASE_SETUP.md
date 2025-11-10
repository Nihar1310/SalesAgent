# Firebase Phone Authentication Setup Guide

This guide walks you through configuring Firebase Phone Authentication for the Sales Quotation Memory System.

## Prerequisites

- Firebase project created at [https://console.firebase.google.com](https://console.firebase.google.com)
- Node.js ≥ 18 installed locally

## 1. Configure Firebase Console

### Enable Phone Authentication

1. Go to **Firebase Console → Authentication → Sign-in method**
2. Click **Phone** and toggle it to **Enabled**
3. Save changes

### Get Web App Credentials

1. Go to **Project Settings → General**
2. Under "Your apps", click the **Web icon** (</>) to add a web app
3. Register your app (name it "Sales Agent Web")
4. Copy the `firebaseConfig` object values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Generate Admin SDK Service Account

1. Go to **Project Settings → Service accounts**
2. Click **Generate new private key**
3. Download the JSON file (keep it secure; never commit to git)
4. Extract these fields from the JSON:
   - `project_id`
   - `client_email`
   - `private_key`

## 2. Update Environment Variables

Edit `.env` in the project root with the values from step 1:

```bash
# Firebase Client Config (for frontend)
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (for backend)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIB...your_key_here...\n-----END PRIVATE KEY-----\n"
```

**Important:** The `FIREBASE_PRIVATE_KEY` must:
- Include the full key with `BEGIN` and `END` markers
- Preserve `\n` for line breaks (wrapped in quotes)
- Keep the escaped newlines; the server code unescapes them

## 3. Install Dependencies

Already done if you followed the automated setup. Otherwise run:

```bash
# Frontend
cd client
npm install firebase

# Backend
cd ..
npm install firebase-admin
```

## 4. Restart Dev Servers

```bash
# Terminal 1 - Backend
npm run server:dev

# Terminal 2 - Frontend
cd client && npm run dev
```

Watch the backend logs for:
- `✅ Firebase Admin SDK initialized successfully` (if credentials valid)
- `⚠️  Firebase Admin: Credentials not found...` (if you skipped Firebase setup; auth will be disabled)

## 5. Test Phone Login Flow

1. Open `http://localhost:5173` in your browser
2. You should be redirected to `/login`
3. Enter your phone number with country code (e.g., `+91 9876543210`)
4. Click **Send OTP**
5. Firebase sends an SMS with a 6-digit code
6. Enter the OTP and click **Verify & Sign In**
7. On success, you're redirected to the dashboard; the sidebar shows your phone number

## 6. Authorize Test Phone Numbers (Development)

During development, you may want to skip SMS delivery for faster testing:

1. Go to **Firebase Console → Authentication → Sign-in method → Phone**
2. Expand **Phone numbers for testing**
3. Add your test phone number and a fixed OTP (e.g., `+1 650-555-1234` → `123456`)
4. Firebase will accept that OTP without sending SMS

## 7. Production Checklist

Before deploying:

- [ ] Update `VITE_FIREBASE_AUTH_DOMAIN` to your production domain if using a custom domain
- [ ] Add production domain to Firebase **Authorized domains** (Console → Authentication → Settings)
- [ ] Store `FIREBASE_PRIVATE_KEY` securely (environment variable or secret manager, never in code)
- [ ] Enable **App Check** in Firebase Console to prevent abuse
- [ ] Configure Firebase quota limits and billing alerts
- [ ] Test OTP delivery in your target regions (SMS rates vary)
- [ ] Review Firebase **Usage and billing** to monitor costs

## Troubleshooting

### "reCAPTCHA verification failed"
- Ensure your domain is whitelisted in Firebase Authorized domains
- Check browser console for reCAPTCHA errors
- Try incognito mode (extensions can interfere)

### "Firebase Admin not initialized"
- Verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` are set
- Check that `FIREBASE_PRIVATE_KEY` preserves newlines (`\n`) and is wrapped in quotes
- Restart backend server after updating `.env`

### "Token expired" errors
- Firebase ID tokens expire after 1 hour
- The frontend axios interceptor auto-refreshes; if it fails, user is redirected to `/login`
- Check network tab for 401 responses

### SMS not delivered
- Verify phone number format includes country code (E.164: `+[country][number]`)
- Check Firebase Console → Authentication → Usage for delivery status
- India requires DLT registration for commercial SMS; test numbers bypass this

## Security Notes

- **Never commit** `.env` or the service account JSON to git
- Firebase private keys grant full project access; rotate them if exposed
- ID tokens are bearer tokens; always use HTTPS in production
- Consider adding rate limiting to prevent OTP abuse

## Cost Estimates

Firebase Phone Auth pricing (as of 2024):
- **US/Canada**: ~$0.01 per verification
- **India**: ~$0.008 per verification  
- **First 10,000/month**: Free tier (check current Firebase pricing)

Monitor usage in Firebase Console → Usage and billing.

---

For additional help, see:
- [Firebase Phone Auth Docs](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)

