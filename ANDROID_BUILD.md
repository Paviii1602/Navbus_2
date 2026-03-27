# 📱 NavBus Android Build Guide

Complete guide to building and deploying the NavBus Android application.

---

## 📋 Prerequisites

### 1. Node.js & npm
- Install [Node.js](https://nodejs.org/) (v18 or higher)
- Verify: `node --version` and `npm --version`

### 2. Android Studio
- Download [Android Studio](https://developer.android.com/studio)
- Install with default settings
- Open Android Studio once to complete setup

### 3. Java Development Kit (JDK)
- Android Studio bundles JDK 17 (recommended)
- Or install JDK 17 separately from [Oracle](https://www.oracle.com/java/technologies/downloads/)

### 4. Android SDK
Android Studio includes the SDK. Ensure these are installed via SDK Manager:
- Android SDK Platform (API 33 or higher)
- Android SDK Build-Tools
- Android Emulator (optional, for testing)

---

## 🚀 Quick Start

### Step 1: Deploy Backend First

Before building the Android app, deploy your backend:

```bash
cd ../backend

# Option A: Deploy to Render (recommended)
# 1. Create account at https://render.com
# 2. Create new Web Service
# 3. Connect your GitHub repo
# 4. Set build command: pip install -r requirements.txt
# 5. Set start command: gunicorn --worker-class gevent -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --bind 0.0.0.0:$PORT app:app
# 6. Deploy and copy the URL

# Option B: Deploy to Railway
# 1. Install Railway CLI: npm i -g railway
# 2. railway login
# 3. railway init
# 4. railway up

# Option C: Deploy to your VPS
# See backend/DEPLOY.md for detailed instructions
```

### Step 2: Configure Frontend Environment

```bash
cd ../frontend

# Copy the APK environment file
cp .env.apk .env

# Edit .env and set your backend URL:
# VITE_BACKEND_URL=https://your-backend.onrender.com
# VITE_GOOGLE_MAPS_KEY=your-api-key (optional)
```

### Step 3: Install Dependencies

```bash
npm install

# Install Capacitor Android
npx cap add android
```

### Step 4: Build and Sync

```bash
# Build the React app
npm run build

# Sync to Android project
npm run cap:sync
```

### Step 5: Open in Android Studio

```bash
npm run cap:open
```

### Step 6: Build APK in Android Studio

1. **Wait for Gradle sync** to complete
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Find APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔧 Development Workflow

### Run on Emulator

```bash
# Start Android emulator from Android Studio
# Then run:
npm run android:dev
```

### Run on Physical Device

1. Enable **Developer Options** on your Android phone
2. Enable **USB Debugging**
3. Connect phone via USB
4. Run: `npm run cap:run`

### Live Development

```bash
# Start dev server
npm run dev

# In another terminal, sync changes
npm run cap:sync
```

---

## 📦 Building Release APK

### Option 1: Debug APK (for testing)

```bash
npm run android:build
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Release APK (for production)

#### Generate Keystore (first time only)

```bash
keytool -genkey -v -keystore navbus-release.keystore -alias navbus -keyalg RSA -keysize 2048 -validity 10000
```

#### Configure in `capacitor.config.json`

```json
"android": {
  "buildOptions": {
    "releaseType": "APK",
    "keystorePath": "../navbus-release.keystore",
    "keystorePassword": "your-password",
    "keystoreAlias": "navbus",
    "keystoreAliasPassword": "your-password"
  }
}
```

#### Build Release APK

```bash
npm run android:build:release
```

Or manually:

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## ⚙️ Android Studio Configuration

### Minimum SDK Version

Edit `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        minSdkVersion 22  // Android 5.1
        targetSdkVersion 34  // Android 14
    }
}
```

### Permissions

Permissions are configured in `capacitor.config.json`. The app requires:

- `ACCESS_FINE_LOCATION` - GPS for bus tracking
- `ACCESS_COARSE_LOCATION` - Approximate location
- `INTERNET` - Backend API connection
- `ACCESS_NETWORK_STATE` - Check connectivity

### App Name & ID

Edit `capacitor.config.json`:

```json
{
  "appId": "com.navbus.app",
  "appName": "NavBus"
}
```

Then run `npm run cap:sync` to apply changes.

---

## 🎨 App Icons & Splash Screen

### Generate Icons

Use [Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) or generate manually:

1. Create icons in multiple sizes:
   - `mipmap-mdpi` (48x48)
   - `mipmap-hdpi` (72x72)
   - `mipmap-xhdpi` (96x96)
   - `mipmap-xxhdpi` (144x144)
   - `mipmap-xxxhdpi` (192x192)

2. Place in `android/app/src/main/res/mipmap-*/ic_launcher.png`

### Splash Screen

Update splash in `capacitor.config.json`:

```json
"plugins": {
  "SplashScreen": {
    "backgroundColor": "#15a8cd",
    "launchShowDuration": 2500
  }
}
```

---

## 🐛 Troubleshooting

### "Cannot find module '@capacitor/android'"

```bash
npm install @capacitor/android @capacitor/cli
npx cap sync android
```

### Gradle Build Failed

```bash
cd android
./gradlew clean
cd ..
npm run cap:sync
```

### APK Won't Install

1. Enable "Install from Unknown Sources" on device
2. Check minimum SDK version matches device
3. Try debug build first

### Backend Connection Failed

1. Verify `VITE_BACKEND_URL` in `.env`
2. Ensure backend is running and accessible
3. Check CORS settings in backend
4. For emulator, use `10.0.2.2` instead of `localhost`

### Geolocation Not Working

1. Check app permissions in Android settings
2. Ensure location services are enabled
3. Test on physical device (emulator GPS can be flaky)

### WebSocket Not Connecting

1. Check backend supports WebSocket (gevent)
2. Verify firewall allows WebSocket connections
3. Check browser console for errors

---

## 📤 Distributing Your App

### Google Play Store

1. Create Google Play Console account ($25 one-time)
2. Build signed release APK or AAB
3. Create store listing with screenshots
4. Submit for review

### Direct APK Distribution

1. Build release APK
2. Share via Google Drive, Dropbox, or website
3. Users enable "Unknown Sources" and install

---

## 🔐 Security Checklist

- [ ] Backend URL is set to production (not localhost)
- [ ] API keys (Google Maps) are restricted to your app signature
- [ ] Backend uses HTTPS in production
- [ ] Passwords are hashed with bcrypt (done ✅)
- [ ] Rate limiting is enabled on backend (done ✅)
- [ ] App is signed with release keystore

---

## 📚 Additional Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Google Play Publishing](https://support.google.com/googleplay/android-developer)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)

---

## ✅ Build Checklist

- [ ] Backend deployed and accessible
- [ ] `.env` configured with backend URL
- [ ] Dependencies installed (`npm install`)
- [ ] App builds locally (`npm run build`)
- [ ] Capacitor synced (`npm run cap:sync`)
- [ ] Android Studio project opens
- [ ] Gradle sync completes without errors
- [ ] Debug APK builds successfully
- [ ] App runs on emulator/device
- [ ] All features tested (GPS, WebSocket, etc.)
- [ ] Release APK built and signed
- [ ] App icons and splash screen configured

---

**Need Help?** Check the troubleshooting section or review the Capacitor documentation.
