# TROUBLESHOOTING GUIDE - Firebase & Socket Issues

## Problem 1: "Failed to sign in with Google" ❌

### Root Cause:
Firebase does not have your Netlify domain authorized for OAuth redirects.

### Solution Steps:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. Select project: `abjee-travel-4fc38`
3. Navigate to: **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Enter: `abjee-travels.netlify.app`
6. Click **Save**

7. **Also Configure Google Provider**:
   - Go to **Authentication** → **Sign-in method**
   - Click on **Google**
   - Verify "Authorized domains" includes `abjee-travels.netlify.app`
   - Click **Save**

8. **Test Again**: Clear browser cache and try signing in

### Verification:
Open browser console (F12) and look for:
```
[Auth] Initiating Google Sign-In...
[Auth] Google Sign-In successful, getting token...
```

If you see `auth/unauthorized-domain`, the domain is still not authorized.

---

## Problem 2: Socket Connection Failing 🔌

### Root Cause:
Either CORS not configured properly on server, or environment variables not set in Render.

### Solution Steps:

#### A. Verify Render Environment Variables:
1. Go to Render Dashboard: https://dashboard.render.com/
2. Select your service: `abjee-travel-server`
3. Go to **Environment** tab
4. Verify these are set:
   ```
   NODE_ENV = production
   PORT = 10000
   CLIENT_URL = https://abjee-travels.netlify.app
   MONGODB_URI = <your-connection-string>
   FIREBASE_SERVICE_ACCOUNT = <json-string>
   FIREBASE_STORAGE_BUCKET = abjee-travel-4fc38.firebasestorage.app
   JWT_SECRET = <your-secret>
   ```

#### B. Check Server Logs:
1. In Render Dashboard → **Logs**
2. Look for:
   ```
   🚀 ABjee Travel Server running on port 10000
   🌍 Environment: production
   📡 Socket.IO enabled with CORS origins: ["https://abjee-travels.netlify.app"]
   ```

3. If you see different origins, CLIENT_URL is not set correctly

#### C. Test Socket Connection:
1. Open your Netlify app: https://abjee-travels.netlify.app/
2. Open browser console (F12)
3. Go to chat/community page
4. Look for:
   ```
   [Socket] Connecting to server: https://abjee-travel.onrender.com
   [Socket] ✅ Connected to server
   [Socket] Socket ID: <some-id>
   ```

### Common Errors & Fixes:

**Error**: `Socket connection failed: CORS`
**Fix**: Set `CLIENT_URL` environment variable in Render

**Error**: `Socket connecting to http://localhost:5000`
**Fix**: Netlify needs `VITE_SERVER_URL` in build environment (check netlify.toml)

**Error**: `Connection timeout`
**Fix**: Render service might be sleeping (free tier). Wait 30 seconds and refresh.

---

## Problem 3: Firebase Admin SDK Errors (Server Side) 🔥

### Root Cause:
`FIREBASE_SERVICE_ACCOUNT` environment variable not set or invalid JSON.

### Solution Steps:

1. **Get Firebase Service Account JSON**:
   - Go to Firebase Console
   - Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

2. **Minify the JSON**:
   - Use https://jsonformatter.org/json-minify
   - Or use command: `cat firebase-service-account.json | jq -c .`
   - Copy the entire single-line JSON

3. **Set in Render**:
   - Render Dashboard → Your Service → Environment
   - Key: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste the minified JSON (entire line)
   - **Important**: Make sure there are NO line breaks
   - Click **Save Changes**

4. **Verify in Logs**:
   ```
   [Firebase-Admin] Loading service account from environment variable
   [Firebase-Admin] Service account loaded from env
   [Firebase-Admin] Firebase Admin SDK initialized successfully
   ```

---

## Quick Verification Checklist ✅

### Client (Netlify):
- [ ] Build successful with no errors
- [ ] Environment variables in netlify.toml
- [ ] VITE_SERVER_URL = https://abjee-travel.onrender.com
- [ ] All Firebase config variables set

### Server (Render):
- [ ] NODE_ENV = production
- [ ] CLIENT_URL = https://abjee-travels.netlify.app  
- [ ] FIREBASE_SERVICE_ACCOUNT set (minified JSON)
- [ ] MONGODB_URI set
- [ ] Health check working: https://abjee-travel.onrender.com/api/health

### Firebase Console:
- [ ] Authorized domains include: abjee-travels.netlify.app
- [ ] Google Sign-In method enabled
- [ ] Support email configured

---

## Still Not Working? 🤔

### Debug Steps:

1. **Check Render Logs** (Live):
   ```
   # In Render Dashboard → Logs
   # Look for any ERROR messages
   ```

2. **Check Browser Console**:
   ```javascript
   // On Netlify app (F12 → Console)
   // Look for [Auth] or [Socket] logs
   ```

3. **Test Backend Directly**:
   ```bash
   # Should return 200 OK
   curl https://abjee-travel.onrender.com/api/health
   ```

4. **Test Socket Connection**:
   ```bash
   # Should establish connection
   wscat -c wss://abjee-travel.onrender.com/socket.io/?EIO=4&transport=websocket
   ```

### Contact Points:
- Firebase docs: https://firebase.google.com/docs/auth/web/google-signin
- Render docs: https://render.com/docs/environment-variables
- Socket.IO docs: https://socket.io/docs/v4/troubleshooting-connection-issues/
