# Crystal Crest Database Administration & Migration Guide

This directory contains the MySQL relational database schema and initial seed data for Crystal Crest.

---

## 1. Initial Database Setup

To run `schema.sql` against a fresh MySQL instance:

### Option A: Automatic Initialization
When you start the Node server (`npm start`), `server.js` automatically connects to MySQL using your `.env` variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), creates the `crystal_crest` database if missing, and executes `schema.sql`.

### Option B: Manual Import via MySQL CLI
```bash
mysql -u root -p < database/schema.sql
```

---

## 2. Production Security Requirements

> [!CAUTION]
> **CRITICAL SECURITY STEP BEFORE GOING LIVE**:
> The `schema.sql` file seeds default test accounts for initial deployment validation:
> 
> 1. **Default Admin User**:
>    - **Email**: `admin@crystalcrest.com`
>    - **Password**: `admin123`
>    - **Action**: Log in to the Admin Portal (`/admin/dashboard.html`) and update the administrator password immediately, or execute an `UPDATE users SET password_hash = ...` statement in MySQL.
> 
> 2. **Default Test Cashier**:
>    - **Name**: `Test Cashier`
>    - **PIN**: `1234`
>    - **Action**: Deactivate or delete this cashier account from the Admin Cashiers Management page (`/admin/cashiers.html`) and create real cashier accounts with new 4-digit PINs.
