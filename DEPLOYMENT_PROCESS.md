# Deployment Process - Audacious Money Platform

**Purpose**: Systematic deployment checklist ensuring all changes flow from development → production seamlessly.

---

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   Local Dev     │─────▶│  GitHub Repo     │─────▶│  Cloudflare Pages   │
│  (Your Machine) │ push │ (Version Control)│ auto │  (Frontend Hosting) │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
                                │
                                │ manual trigger
                                ▼
                         ┌──────────────────┐
                         │ DigitalOcean DB  │
                         │   (PostgreSQL)   │
                         └──────────────────┘
                                ▲
                                │ API calls
                         ┌──────────────────┐
                         │  Backend Server  │
                         │ (Node + Hono.js) │
                         └──────────────────┘
```

---

## PHASE 1: Pre-Deployment Verification (Local)

### Step 1: Code Quality Checks
```bash
# From project root
npm run type-check           # Verify TypeScript compiles
npm run lint                 # Check for code issues
npm run build:production     # Verify build succeeds
```

**Expected**: All commands succeed with no errors.

### Step 2: Backend Verification
```bash
# From project root
cd audacious_money_backend
npm run dev                  # Start backend locally

# In another terminal
curl http://localhost:3006/health  # Should return 200 OK
```

### Step 3: Local Integration Test
```bash
# Terminal 1: Backend
cd audacious_money_backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Browser: Test the specific feature
# - Log in as admin
# - Navigate to admin dashboard
# - Click "Workshop Management"
# - Click "Create First Workshop"
# - Verify form loads (not 404)
```

**If local works but production doesn't** → Deployment issue (continue to Phase 2)

---

## PHASE 2: Database Migration (Production)

### Step 1: Check Current Migration Status

**Option A: Via Production Server SSH**
```bash
ssh your-production-server
cd /path/to/backend
npm run migrate:status
```

**Option B: Via Local Connection to Production DB**
```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="postgresql://user:pass@prod-db-host:25060/dbname?sslmode=require"
cd audacious_money_backend
npm run migrate:status
```

**Expected Output**:
```
✅ Migration 001_initial_schema.sql - Applied
✅ Migration 002_add_charities.sql - Applied
...
✅ Migration 014_fix_subscription_status_values.sql - Applied
❌ Migration 015_educational_workshops_simplified.sql - Pending
```

### Step 2: Run Pending Migrations

```bash
# From production server OR with production DATABASE_URL
npm run migrate:up
```

**Verification**:
```sql
-- Connect to production database
psql $DATABASE_URL

-- Verify workshops table exists
\dt workshops

-- Should show:
--  Schema |    Name    | Type  |  Owner
-- --------+------------+-------+---------
--  public | workshops  | table | youruser
```

### Step 3: Check Migration File Names

**CRITICAL**: Ensure no duplicate migration numbers:
```bash
ls -la audacious_money_backend/src/db/migrations/
```

**Issue Found**: You have BOTH:
- `015_educational_workshops.sql` (old)
- `015_educational_workshops_simplified.sql` (new)

**Fix Required**:
```bash
# Delete the old version
rm audacious_money_backend/src/db/migrations/015_educational_workshops.sql

# Rename simplified to 016
mv audacious_money_backend/src/db/migrations/015_educational_workshops_simplified.sql \
   audacious_money_backend/src/db/migrations/016_educational_workshops_simplified.sql
```

Then commit:
```bash
git add audacious_money_backend/src/db/migrations/
git commit -m "fix: Rename workshop migration to 016 to avoid conflict"
git push origin main
```

---

## PHASE 3: Frontend Deployment (Cloudflare Pages)

### Step 1: Verify Git Push Succeeded
```bash
git log --oneline -5  # Check your recent commits are there
git push origin main  # Push if needed
```

### Step 2: Check Cloudflare Pages Dashboard

**Go to**: https://dash.cloudflare.com/ → Pages → `graceful-books` (or your project name)

**Check**:
1. **Latest deployment status** - Is it "Success" or "Failed"?
2. **Latest commit** - Does it match your local `git log`?
3. **Deployment time** - When was the last deployment?

### Step 3: Trigger Manual Deployment (If Auto-Deploy Didn't Work)

**Option A: Retry Deployment (Cloudflare Dashboard)**
- Pages → Your Project → Deployments
- Find the failed/pending deployment
- Click "Retry deployment"

**Option B: Force New Deployment (Empty Commit)**
```bash
git commit --allow-empty -m "chore: Force Cloudflare Pages rebuild"
git push origin main
```

**Option C: Cloudflare Pages API**
```bash
# If you have API token configured
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project_name}/deployments" \
  -H "Authorization: Bearer {api_token}"
```

### Step 4: Monitor Deployment Progress

**Cloudflare Pages Build Logs**:
1. Go to Cloudflare Dashboard → Pages → Your Project
2. Click on the latest deployment
3. View build logs
4. Look for errors like:
   - TypeScript compilation errors
   - Dependency installation failures
   - Build command failures

**Expected Successful Output**:
```
✓ Installing dependencies
✓ Building application
✓ Uploading build output
✓ Deploying to production
```

### Step 5: Verify Deployment URL

**Once deployed, check**:
```bash
curl -I https://your-app.pages.dev/admin/workshops/new
# Should return: 200 OK (not 404)
```

**Or visit in browser**:
- https://your-production-url.com/admin/workshops/new
- Should load the workshop form page (not 404 error)

---

## PHASE 4: Backend Deployment

### Step 1: Deploy Backend Code

**If using DigitalOcean App Platform**:
1. Push to GitHub (already done)
2. DigitalOcean auto-deploys from GitHub
3. Check deploy status in DigitalOcean dashboard

**If using manual deployment**:
```bash
ssh your-backend-server
cd /path/to/backend
git pull origin main
npm install --production
pm2 restart audacious-money-backend
```

### Step 2: Verify Backend Health

```bash
curl https://api.your-domain.com/health
# Expected: {"status":"healthy"}

curl https://api.your-domain.com/api/workshops
# Expected: 401 Unauthorized (requires admin auth - that's correct!)
```

### Step 3: Check Backend Logs

```bash
# If using pm2
pm2 logs audacious-money-backend --lines 50

# If using systemd
journalctl -u audacious-money-backend -n 50 -f

# Look for errors like:
# - Database connection failures
# - Missing environment variables
# - Route registration errors
```

---

## PHASE 5: End-to-End Verification

### Complete Flow Test

**Step 1: Admin Login**
1. Go to https://your-app.com/admin/login
2. Log in with admin credentials
3. Verify redirect to admin dashboard

**Step 2: Navigate to Workshop Management**
1. Click purple "🎓 Workshop Management" button
2. Should load `/admin/workshops` page
3. Should see "Create First Workshop" button

**Step 3: Create Workshop**
1. Click "Create First Workshop"
2. Should load `/admin/workshops/new` (not 404!)
3. Fill out form:
   - Cohort Name: "Test Workshop - June 2026"
   - Verify slug auto-generates: "test-workshop-june-2026"
   - Workshop Type: "Online"
   - Workshop Start: Future date
   - Workshop End: Future date + 3 hours
   - Access Grant: Future date - 7 days
   - Stripe Price ID: Get from Stripe dashboard
   - Trial Duration: 30 days
4. Click "Create Workshop"

**Step 4: Verify Workshop Created**
1. Should redirect to `/admin/workshops`
2. New workshop should appear in list
3. Check database:
```sql
SELECT cohort_name, slug, status FROM workshops ORDER BY created_at DESC LIMIT 1;
```

**Step 5: Test User Enrollment Flow**
1. Log out as admin
2. Visit `/workshops/test-workshop-june-2026` (public signup page)
3. Should load workshop signup page (not 404)
4. Click "Enroll" button
5. Should redirect to Stripe checkout
6. Use Stripe test card: 4242 4242 4242 4242
7. Complete checkout
8. Should redirect to thank-you page
9. Check database:
```sql
SELECT * FROM workshop_enrollments ORDER BY enrolled_at DESC LIMIT 1;
SELECT * FROM user_products WHERE user_id = (SELECT user_id FROM workshop_enrollments ORDER BY enrolled_at DESC LIMIT 1);
```

**Step 6: Verify Emails Sent**
1. Check Postmark dashboard
2. Should see 1 email sent immediately (Welcome email)
3. Should see 6 emails scheduled for future delivery:
   - 24h before workshop (Reminder)
   - 1, 2, 3, 4 weeks after workshop (Challenges)
   - 30 days after workshop (Wrap-up)

---

## TROUBLESHOOTING GUIDE

### Issue: "Still getting 404 on /admin/workshops/new"

**Diagnosis Steps**:
1. **Check if route exists in build**:
   ```bash
   # Look in dist/assets/index-*.js for "workshops/new"
   grep -r "workshops/new" dist/
   ```
   - If NOT found → Build didn't include new routes → Check if files committed
   - If FOUND → Build has routes → Deployment issue

2. **Check Cloudflare Pages deployment**:
   - Latest deployment has your commit? NO → Wait/trigger redeploy
   - Latest deployment failed? YES → Check build logs
   - Latest deployment succeeded? YES → Cache issue (see below)

3. **Clear browser cache**:
   ```
   Ctrl + Shift + R (hard refresh)
   OR
   Ctrl + Shift + Delete → Clear cache
   ```

4. **Check _redirects file deployed**:
   ```bash
   curl https://your-app.com/_redirects
   # Should return: /* /index.html 200
   ```

5. **Check Cloudflare Pages build settings**:
   - Build command: `npm run build:production`
   - Build output directory: `dist`
   - Root directory: `/` (not `/frontend`)

### Issue: "Admin dashboard doesn't show Workshop button"

**Diagnosis**:
- Frontend deployment hasn't completed
- Browser cached old version
- Different user (not admin role)

**Fix**:
```bash
# Check admin role in database
SELECT id, email, role FROM users WHERE email = 'your-admin-email@example.com';
# Should show: role = 'admin' or 'super_admin'
```

### Issue: "Form loads but submit fails with 401 Unauthorized"

**Diagnosis**:
- Admin auth not working
- Cookie not being sent
- Backend not recognizing admin session

**Fix**:
```bash
# Check backend logs during form submit
# Look for: "Unauthorized access attempt" or "No admin session"

# Verify CORS and credentials
# Frontend should use: credentials: 'include'
# Backend should set: Access-Control-Allow-Credentials: true
```

### Issue: "Form loads but submit fails with 500 Internal Server Error"

**Diagnosis**:
- Database migration not run (workshops table doesn't exist)
- Database connection issue
- Missing required field in API request

**Fix**:
1. Check backend logs for exact error
2. Run migration if table missing:
   ```bash
   npm run migrate:up
   ```
3. Check database connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

### Issue: "Duplicate migration numbers (015)"

**Fix**:
```bash
# List migrations
ls -la audacious_money_backend/src/db/migrations/

# Remove old 015
rm audacious_money_backend/src/db/migrations/015_educational_workshops.sql

# Rename simplified to 016
mv audacious_money_backend/src/db/migrations/015_educational_workshops_simplified.sql \
   audacious_money_backend/src/db/migrations/016_educational_workshops_simplified.sql

# Commit and deploy
git add audacious_money_backend/src/db/migrations/
git commit -m "fix: Resolve duplicate migration number"
git push origin main

# Run migration on production
npm run migrate:up
```

---

## DEPLOYMENT CHECKLIST (TL;DR)

Use this quick checklist for each deployment:

```
□ Code changes committed and pushed to GitHub
□ TypeScript compiles (npm run type-check)
□ Production build succeeds (npm run build:production)
□ Database migrations numbered correctly (no duplicates)
□ Database migrations run on production (npm run migrate:up)
□ Cloudflare Pages deployment triggered
□ Cloudflare Pages deployment succeeded (check dashboard)
□ Backend deployment completed (if backend changes)
□ Backend health check passes (curl /health)
□ Admin can access new routes (no 404)
□ Feature works end-to-end (tested manually)
□ No errors in browser console
□ No errors in backend logs
```

---

## IMMEDIATE ACTION ITEMS FOR CURRENT ISSUE

1. **Fix duplicate migration**:
   ```bash
   rm audacious_money_backend/src/db/migrations/015_educational_workshops.sql
   mv audacious_money_backend/src/db/migrations/015_educational_workshops_simplified.sql \
      audacious_money_backend/src/db/migrations/016_educational_workshops_simplified.sql
   git add . && git commit -m "fix: Rename workshop migration to 016" && git push
   ```

2. **Check Cloudflare Pages**:
   - Go to Cloudflare dashboard
   - Verify latest deployment has commit `c170e17` (your workshop form commit)
   - If not deployed, trigger manual deployment

3. **Run production migration**:
   ```bash
   # Connect to production and run:
   npm run migrate:up
   ```

4. **Test the flow**:
   - Visit your live site
   - Hard refresh (Ctrl + Shift + R)
   - Log in as admin
   - Click Workshop Management
   - Click Create First Workshop
   - Should load form (not 404)

---

## Success Criteria

✅ `/admin/workshops/new` loads workshop creation form
✅ `/admin/workshops/:id` loads workshop edit form
✅ Form submission creates workshop in database
✅ Workshop appears in admin workshop list
✅ Users can enroll via `/workshops/:slug` public page
✅ Stripe checkout completes successfully
✅ All 7 workshop emails schedule correctly
✅ No 404 errors
✅ No console errors
✅ No backend errors in logs
