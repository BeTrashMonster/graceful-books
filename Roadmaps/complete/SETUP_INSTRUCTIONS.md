# Quick Setup Instructions - What YOU Need to Do

I've automated most of the setup! Here's what I need from you:

---

## ✅ Already Done by Me:
- Generated JWT secret: `c2b2370498db20a2e097da2ddf27d8e21d584cb379712d20c3d3f50eb943b9a3`
- Created all `.env` files with the JWT secret
- Set up all configuration

---

## 🚀 What YOU Need to Do (5 Steps):

### Step 1: Install Bun (2 minutes)
**Open PowerShell as Administrator** and run:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify:
```powershell
bun --version
```

---

### Step 2: Install PostgreSQL 15 (5 minutes)

**Option A: Using Docker (Recommended)**
```powershell
docker pull postgres:15

docker run --name audacious-postgres `
  -e POSTGRES_PASSWORD=audacious2024 `
  -e POSTGRES_DB=audacious_money `
  -p 5432:5432 `
  -d postgres:15
```

**Option B: Direct Install**
Download from: https://www.postgresql.org/download/windows/
- Set password: `audacious2024` (or your choice)
- Port: `5432` (default)

**After installation, update the password in .env files:**

I'll help you update the files - just tell me what password you chose!

---

### Step 3: Get Stripe API Keys (3 minutes)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Click "Reveal test key" for Secret key
3. Copy these two values:
   - **Secret key** (starts with `sk_test_`)
   - **Publishable key** (starts with `pk_test_`)

Send me these keys and I'll update the .env files!

---

### Step 4: Install Stripe CLI (Optional - 2 minutes)

**Windows with Scoop:**
```powershell
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**Or download from:**
https://github.com/stripe/stripe-cli/releases/latest

Then login:
```powershell
stripe login
```

---

### Step 5: Tell Me When Ready!

Once you've completed steps 1-3, give me:
1. PostgreSQL password you chose
2. Stripe Secret Key (sk_test_...)
3. Stripe Publishable Key (pk_test_...)

I'll update all the .env files and run the database setup automatically!

---

## 📝 Summary:

**You do:**
- [ ] Install Bun (1 command)
- [ ] Install PostgreSQL (Docker or download)
- [ ] Get Stripe keys from dashboard
- [ ] Give me the values

**I'll do:**
- [x] Generate JWT secret
- [x] Create .env files
- [ ] Update .env with your values
- [ ] Create database and tables
- [ ] Install all dependencies
- [ ] Test everything works
- [ ] Launch agents for Phase 0

---

**Ready? Start with Step 1 (Install Bun) and let me know how it goes!** 🚀
