# Firebase Configuration Steps for Production

## 1. Firebase Console Setup (CRITICAL)

### A. Add Authorized Domains:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `abjee-travel-4fc38`
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Add these domains:
   - `abjee-travels.netlify.app`
   - `localhost` (for development)

### B. Configure OAuth Redirect URIs:
1. In Firebase Console → **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Under "Authorized domains", ensure these are added:
   - `abjee-travels.netlify.app`
   - `localhost`

### C. Enable Google Sign-In:
1. Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add your support email
4. Save

## 2. Render Environment Variables

Set these in your Render dashboard:

```
NODE_ENV=production
PORT=10000
CLIENT_URL=https://abjee-travels.netlify.app
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<generate-a-secure-secret>
FIREBASE_SERVICE_ACCOUNT=<paste-minified-json-from-firebase>
FIREBASE_STORAGE_BUCKET=abjee-travel-4fc38.firebasestorage.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 3. Netlify Environment Variables

These are already in netlify.toml, but verify in Netlify dashboard:

```
VITE_SERVER_URL=https://abjee-travel.onrender.com
VITE_FIREBASE_API_KEY=AIzaSyD2RQGDQWj6uv5zZfcNOwjbi8wX6vv61Ss
VITE_FIREBASE_AUTH_DOMAIN=abjee-travel-4fc38.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=abjee-travel-4fc38
VITE_FIREBASE_STORAGE_BUCKET=abjee-travel-4fc38.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1042055167342
VITE_FIREBASE_APP_ID=1:1042055167342:web:4c9e26116cd60e9459d57f
```

## 4. Verify Socket Connection

After deployment, test:
- Health check: `https://abjee-travel.onrender.com/api/health`
- Socket connection: Open browser console on Netlify site
- Look for: `[Socket] Initializing socket connection...`

## Common Issues & Solutions

### Issue 1: "Failed to sign in with Google"
**Solution:** Firebase Console → Authentication → Authorized domains → Add `abjee-travels.netlify.app`

### Issue 2: "Socket connection failed"
**Solution:** Check Render logs for CORS errors. Verify CLIENT_URL environment variable is set correctly.

### Issue 3: "Authentication token expired"
**Solution:** This is normal. The app should auto-refresh tokens. If not working, check Firebase Admin SDK configuration.

### Issue 4: "CORS policy blocked"
**Solution:** Verify server/src/server.js has correct allowedOrigins in production mode.
