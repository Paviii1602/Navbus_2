# 🚀 NavBus Backend Deployment Guide

Complete guide to deploying the NavBus backend to production.

---

## 📋 Prerequisites

- Python 3.8 or higher
- Git account (GitHub/GitLab)
- Account on deployment platform (Render, Railway, or VPS)

---

## 🌐 Option 1: Deploy to Render (Recommended)

### Step 1: Prepare Your Repository

1. Push your code to GitHub/GitLab:
```bash
git init
git add .
git commit -m "Initial commit - NavBus production ready"
git remote add origin https://github.com/yourusername/navbus.git
git push -u origin main
```

### Step 2: Create Render Web Service

1. Go to [Render.com](https://render.com) and sign up/login
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `navbus-api` |
| **Region** | Choose closest to your users |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn --worker-class gevent -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --bind 0.0.0.0:$PORT app:app --timeout 120 --keep-alive 5` |

5. Choose **Free** plan (or paid for production)
6. Click **Create Web Service**

### Step 3: Configure Environment Variables

In Render dashboard, add these environment variables:

```
SECRET_KEY=your-super-secret-key-here
DATABASE_URL=sqlite:///navbus.db
RATELIMIT_ENABLED=true
FLASK_DEBUG=false
PORT=5000
```

### Step 4: Deploy

- Render will automatically build and deploy
- Wait 3-5 minutes for first deployment
- Your backend URL: `https://navbus-api.onrender.com`

### Step 5: Test Deployment

```bash
curl https://YOUR_APP.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "time": "2026-03-27T...",
  "async": "gevent",
  "database": "ok",
  "version": "1.0.0"
}
```

---

## 🚂 Option 2: Deploy to Railway

### Step 1: Install Railway CLI

```bash
npm install -g railway
railway login
```

### Step 2: Initialize Project

```bash
cd backend
railway init
railway up
```

### Step 3: Configure Environment

```bash
railway variables set SECRET_KEY=your-secret-key
railway variables set DATABASE_URL=sqlite:///navbus.db
railway variables set RATELIMIT_ENABLED=true
```

### Step 4: Deploy

```bash
railway up
```

Your URL: `https://navbus-production.up.railway.app`

---

## 🖥️ Option 3: Deploy to VPS (Ubuntu/Debian)

### Step 1: Server Setup

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and dependencies
sudo apt install -y python3 python3-pip python3-venv nginx supervisor git

# Install Node.js (for building frontend)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Clone Repository

```bash
cd /var/www
sudo git clone https://github.com/yourusername/navbus.git
sudo chown -R $USER:$USER navbus
cd navbus/backend
```

### Step 3: Setup Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment

```bash
nano .env
```

Add:
```
SECRET_KEY=your-super-secret-key-here
DATABASE_URL=sqlite:///navbus.db
RATELIMIT_ENABLED=true
FLASK_DEBUG=false
PORT=5000
```

### Step 5: Setup Supervisor

```bash
sudo nano /etc/supervisor/conf.d/navbus.conf
```

Add:
```ini
[program:navbus]
directory=/var/www/navbus/backend
command=/var/www/navbus/backend/venv/bin/gunicorn --worker-class gevent -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --bind 0.0.0.0:5000 app:app --timeout 120 --keep-alive 5
autostart=true
autorestart=true
stderr_logfile=/var/log/navbus/err.log
stdout_logfile=/var/log/navbus/out.log
user=www-data
group=www-data
```

```bash
sudo mkdir -p /var/log/navbus
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start navbus
```

### Step 6: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/navbus
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/navbus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Setup SSL (Optional but Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔧 Post-Deployment Checklist

- [ ] Backend is accessible via HTTPS
- [ ] `/api/health` endpoint returns OK
- [ ] WebSocket connections work (check browser console)
- [ ] Database is initialized with seed data
- [ ] Rate limiting is enabled
- [ ] CORS allows your frontend domain
- [ ] Environment variables are set correctly
- [ ] Logs are accessible for debugging

---

## 📊 Monitoring & Debugging

### View Logs (Render)
```bash
# In Render dashboard: Logs tab
# Or use CLI
render logs -f
```

### View Logs (Railway)
```bash
railway logs
```

### View Logs (VPS)
```bash
sudo tail -f /var/log/navbus/out.log
sudo tail -f /var/log/navbus/err.log
sudo journalctl -u nginx -f
```

### Test API Endpoints

```bash
# Health check
curl https://your-backend.com/api/health

# Get routes
curl https://your-backend.com/api/routes

# Test login
curl -X POST https://your-backend.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"passenger","password":"pass123"}'
```

---

## 🔐 Security Best Practices

1. **Change Default Credentials**
   - Update default passwords in seed_data.py before deploying
   - Or delete users and create new ones via API

2. **Generate Secure SECRET_KEY**
```python
python -c "import secrets; print(secrets.token_hex(32))"
```

3. **Enable HTTPS**
   - Render/Railway: Automatic
   - VPS: Use Let's Encrypt (certbot)

4. **Restrict CORS Origins** (Optional)
   - Edit `app.py` to allow only your domain

5. **Database Backups** (VPS)
```bash
# Backup SQLite database
cp navbus.db navbus.db.backup.$(date +%Y%m%d)
```

---

## ⚠️ Troubleshooting

### "Application failed to start"
- Check logs for specific error
- Verify all dependencies in requirements.txt
- Ensure PORT environment variable is set

### "WebSocket connection failed"
- Verify gevent-websocket is installed
- Check Nginx configuration for WebSocket upgrade headers
- Ensure firewall allows WebSocket connections

### "Database not found"
- Run the app once to initialize database
- Or manually: `python seed_data.py`

### "Too many requests" error
- Rate limiting is working
- Increase limits in app.py if needed
- Or disable: `RATELIMIT_ENABLED=false`

---

## 📈 Scaling Considerations

For high-traffic production:

1. **Upgrade Database**: Switch to PostgreSQL
2. **Add Redis**: For WebSocket message broker
3. **Multiple Workers**: Increase gunicorn workers
4. **CDN**: Serve static assets via Cloudflare
5. **Monitoring**: Add Sentry, New Relic, or Datadog

---

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Flask-SocketIO Documentation](https://flask-socketio.readthedocs.io)
- [Gunicorn Documentation](https://docs.gunicorn.org)

---

**Need Help?** Check the logs first, then review the troubleshooting section.
