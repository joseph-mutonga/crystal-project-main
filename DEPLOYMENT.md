# 🚀 Crystal Crest — Production Deployment Guide

This guide details the steps required to deploy the **Crystal Crest Luxury Cosmetics** web application to a live production environment.

---

## 1. Pre-Deployment Checklist

| Check | Requirement | Production Value |
|---|---|---|
| 🟢 **Environment** | `NODE_ENV` | `production` |
| 🟢 **Port Binding** | `PORT` & Host | Listens on `0.0.0.0:${PORT}` (Default: 3000) |
| 🟢 **Database** | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Pointed to production MySQL 8.0+ instance |
| 🟢 **Session Security** | `JWT_SECRET` | 64+ char random string generated via `openssl rand -hex 32` |
| 🟢 **M-Pesa Gateway** | `MPESA_ENV` | `production` |
| 🟢 **M-Pesa Webhook** | `MPESA_CALLBACK_URL` | **Must be your live HTTPS domain** (e.g. `https://crystalcrest.co.ke`) |
| 🟢 **Payments Mode** | `PAYMENTS_MODE` | `live` |
| 🟢 **Cresti AI** | `GEMINI_API_KEY` | Production Google Gemini API key |

---

## 2. Critical Security Actions Before Going Live

> [!CAUTION]
> ### 🚨 Compromised Seeded Credentials Warning
> The initial `schema.sql` migration seeds default accounts for local development. **You MUST change or remove these immediately upon deployment:**
> 
> 1. **Default Admin User**:
>    - **Email**: `admin@crystalcrest.com`
>    - **Initial Password**: `admin123`
>    - **Required Action**: Log in to `/admin/dashboard.html` and update your password immediately, or run an `UPDATE users SET password_hash = ...` query in MySQL.
> 
> 2. **Default Test Cashier**:
>    - **Name**: `Test Cashier`
>    - **Initial PIN**: `1234`
>    - **Required Action**: Deactivate or delete this account from `/admin/cashiers.html` and create production cashier accounts with unique PINs.

---

## 3. Safaricom M-Pesa & Co-op Bank Webhook Configuration

### A. Updating `MPESA_CALLBACK_URL`
> [!IMPORTANT]
> The `ngrok` URL used during local development (`https://dingo-barber-headpiece.ngrok-free.dev`) is a temporary tunnel. 
> In production, you **MUST** set `MPESA_CALLBACK_URL` in your `.env` to your public HTTPS domain:
> ```env
> MPESA_CALLBACK_URL=https://crystalcrest.co.ke
> ```
> Safaricom will deliver real-time payment notifications to:
> `https://crystalcrest.co.ke/api/payments/mpesa-callback`

### B. Co-operative Bank PayBill Details
- **PayBill / Business Number**: `400200`
- **Account Number / Reference**: `104514`
- **Account Name**: `Crystal Crest`

---

## 4. Production Hosting Deployment Steps

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/Toimasi21/crystal-project.git
cd crystal-project

# Install production dependencies only
npm install --omit=dev
```

### Step 2: Configure Production Environment Variables
Create your production `.env` file based on `.env.example`:
```bash
cp .env.example .env
nano .env
```

### Step 3: Initialize Database Schema
```bash
mysql -u your_db_user -p your_db_name < database/schema.sql
```
*(Or let `server.js` auto-migrate on first startup).*

### Step 4: Run with a Process Manager (PM2 recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start Crystal Crest server in cluster mode
pm2 start server/server.js --name "crystal-crest" -i max

# Save PM2 process list to restart on system reboot
pm2 save
pm2 startup
```

### Step 5: Configure NGINX Reverse Proxy with SSL (Let's Encrypt)
Sample Nginx configuration block:
```nginx
server {
    server_name crystalcrest.co.ke www.crystalcrest.co.ke;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/crystalcrest.co.ke/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crystalcrest.co.ke/privkey.pem;
}
```

---

## 5. Uptime & Health Monitoring
- Ping `https://crystalcrest.co.ke/api/health` with your monitoring service (UptimeRobot, BetterStack, AWS CloudWatch).
- Expected response:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-14T10:00:00.000Z",
    "env": "production"
  }
  ```
