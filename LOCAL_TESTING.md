# 🧪 NavBus Local Testing Guide

Complete guide to test NavBus on localhost before deploying.

---

## 📋 Prerequisites

- Node.js 18+ installed
- Python 3.8+ installed
- Android Studio (for Android testing)

---

## 🖥️ Option 1: Web Testing (Browser)

### Step 1: Start Backend Server

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python app.py
```

Backend will run on: **http://localhost:5000**

### Step 2: Start Frontend Dev Server

Open a **new terminal**:

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Start Vite dev server
npm run dev
```

Frontend will run on: **http://localhost:5173**

### Step 3: Test the Application

1. Open browser: `http://localhost:5173`
2. Login with default credentials:
   - **Passenger**: `passenger` / `pass123`
   - **Driver**: `driver` / `driver123`
3. Test all features:
   - Search routes
   - View bus tracking
   - Driver mode (GPS simulation)

### Step 4: Test API Endpoints

```bash
# Health check
curl http://localhost:5000/api/health

# Get all routes
curl http://localhost:5000/api/routes

# Get all buses
curl http://localhost:5000/api/buses

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"passenger","password":"pass123"}'

# Search stops
curl "http://localhost:5000/api/stops/search?from=vellore&to=chennai"
```

### Step 5: Test WebSocket Connection

Open browser console (F12) and run:

```javascript
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('✓ Connected'));
socket.on('disconnect', () => console.log('✗ Disconnected'));
```

---

## 📱 Option 2: Android Emulator Testing

### Step 1: Build Frontend

```bash
cd frontend

# Build for production
npm run build

# Sync to Android
npm run cap:sync
```

### Step 2: Start Backend

```bash
cd backend
python app.py
```

### Step 3: Find Your Local IP

**Windows:**
```cmd
ipconfig
```

**Mac/Linux:**
```bash
ifconfig
```

Look for IPv4 Address (e.g., `192.168.1.100`)

### Step 4: Configure Backend URL

Edit `frontend/.env`:

```env
VITE_BACKEND_URL=http://YOUR_LOCAL_IP:5000
VITE_GOOGLE_MAPS_KEY=your-key-here
```

Example:
```env
VITE_BACKEND_URL=http://192.168.1.100:5000
```

### Step 5: Start Android Emulator

1. Open **Android Studio**
2. Go to **Device Manager**
3. Start an emulator (or create new one)
4. Wait for emulator to boot

### Step 6: Run App on Emulator

```bash
cd frontend
npm run cap:run
```

Or manually:
1. Open Android Studio
2. **File** → **Open** → Select `frontend/android`
3. Wait for Gradle sync
4. Click **Run** (green play button)

### Step 7: Allow Cleartext Traffic (Important!)

Android blocks HTTP by default. The `capacitor.config.json` already has:

```json
"android": {
  "cleartext": true
}
```

If you get network errors, also edit `frontend/android/app/src/main/AndroidManifest.xml`:

```xml
<application
  android:usesCleartextTraffic="true"
  ...>
```

---

## 📲 Option 3: Physical Android Device Testing

### Step 1: Enable Developer Mode

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times
3. Go back to **Settings** → **System** → **Developer Options**
4. Enable **USB Debugging**

### Step 2: Connect Device

```bash
# Connect via USB
# Verify device is detected
adb devices
```

### Step 3: Configure Backend URL

Same as emulator - use your local IP in `.env`:

```env
VITE_BACKEND_URL=http://192.168.1.100:5000
```

### Step 4: Build and Run

```bash
npm run android:dev
```

Or:
1. Build: `npm run build`
2. Sync: `npm run cap:sync`
3. Open Android Studio and run on device

---

## 🔧 Troubleshooting

### Backend Won't Start

**Port already in use:**
```bash
# Windows - Find and kill process
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill -9
```

**Missing dependencies:**
```bash
cd backend
pip install -r requirements.txt --upgrade
```

### Frontend Can't Connect to Backend

**Check CORS:**
- Backend logs should show requests coming through
- Browser console should not show CORS errors

**Check backend URL:**
```javascript
// In browser console
console.log(import.meta.env.VITE_BACKEND_URL)
```

**Firewall blocking:**
- Windows: Allow Python through firewall
- Mac: Allow incoming connections in Security settings

### Android App Network Errors

**"Cleartext traffic not allowed":**
- Ensure `cleartext: true` in `capacitor.config.json`
- Rebuild: `npm run cap:sync`

**"Unable to resolve host":**
- Use your local IP, not `localhost` or `127.0.0.1`
- Ensure device/emulator is on same network as computer

**WebSocket not connecting:**
- Check backend is running with gevent
- Verify firewall allows WebSocket connections

### Geolocation Not Working

**On Emulator:**
1. Open **Extended Controls** (⋮) in emulator
2. Go to **Location**
3. Set latitude/longitude
4. Click **Send**

**On Physical Device:**
1. Enable **Location Services**
2. Grant app permission in **Settings** → **Apps** → **NavBus** → **Permissions**

---

## 🧪 Testing Checklist

### Backend Tests

- [ ] Server starts without errors
- [ ] `/api/health` returns `{"status": "ok"}`
- [ ] `/api/routes` returns route list
- [ ] `/api/buses` returns bus list
- [ ] Login works with default credentials
- [ ] WebSocket connections show in logs
- [ ] Rate limiting works (spam requests)

### Frontend Web Tests

- [ ] App loads in browser
- [ ] Login page appears
- [ ] Can login as passenger
- [ ] Can login as driver
- [ ] Routes display correctly
- [ ] Bus tracking shows on map
- [ ] Search works
- [ ] Theme toggle works
- [ ] Profile drawer opens

### Android Tests

- [ ] App installs on emulator/device
- [ ] Splash screen shows
- [ ] Login works
- [ ] Location permission prompt appears
- [ ] Hardware back button works
- [ ] GPS location updates (driver mode)
- [ ] Real-time bus updates (WebSocket)
- [ ] App doesn't crash on navigation

---

## 🔍 Debugging Tools

### Backend Debugging

```bash
# Enable debug mode
cd backend
$env:FLASK_DEBUG="true"  # Windows
export FLASK_DEBUG=true  # Mac/Linux
python app.py
```

View logs in terminal for real-time debugging.

### Frontend Debugging

**Browser:**
- Open DevTools (F12)
- Check **Console** for errors
- Check **Network** tab for API calls
- Check **Application** tab for PWA/Cache

**Android:**
```bash
# View logs
adb logcat | grep -i navbus

# Inspect WebView (Chrome)
# 1. Open Chrome on desktop
# 2. Go to: chrome://inspect
# 3. Select your device/app
# 4. Click "inspect"
```

### Test WebSocket in Real-Time

Open two browser tabs:

**Tab 1 (Driver):**
```javascript
// In console
const socket = io('http://localhost:5000');
socket.emit('driver_location', {
  bus_id: 1,
  lat: 12.9716,
  lng: 77.5946,
  speed: 30
});
```

**Tab 2 (Passenger):**
```javascript
// In console
const socket = io('http://localhost:5000');
socket.emit('watch_bus', { bus_id: 1 });
socket.on('bus_update', (data) => console.log(data));
```

---

## 📊 Performance Testing

### Test Rate Limiting

```bash
# Rapid fire requests (should get 429 after limit)
for i in {1..20}; do
  curl http://localhost:5000/api/health
done
```

### Test WebSocket Stability

```javascript
// In browser console
let messages = 0;
const socket = io('http://localhost:5000');
socket.on('bus_update', () => messages++);
setTimeout(() => console.log(`Received ${messages} updates`), 60000);
```

---

## 🎯 Quick Test Commands

```bash
# Start everything (2 terminals)

# Terminal 1 - Backend
cd backend && python app.py

# Terminal 2 - Frontend
cd frontend && npm run dev

# Test API
curl http://localhost:5000/api/health

# Build Android
cd frontend && npm run android:build

# Open Android Studio
cd frontend && npm run cap:open
```

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] All features work on localhost
- [ ] Android app works on emulator
- [ ] Android app works on physical device
- [ ] WebSocket connections are stable
- [ ] GPS/location works correctly
- [ ] No console errors
- [ ] Backend handles errors gracefully
- [ ] Rate limiting doesn't break functionality
- [ ] Database persists data correctly

---

**Next:** Once everything works locally, follow `ANDROID_BUILD.md` and `backend/DEPLOY.md` for production deployment.
