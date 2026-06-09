# How to Run the Billing Fix Migration

## What This Does

This fixes your Billing page so that:
- ✅ Payment method displays correctly
- ✅ Billing history shows your invoices
- ✅ Monthly cost shows $20 (not $15)

## Step-by-Step Instructions

### Step 1: Wait for Deployment (5 minutes)

The code is deploying to production right now. Check if it's done:

1. Go to: https://cloud.digitalocean.com/apps
2. Find your `audacious-money-backend` app
3. Wait for the green "Active" status

### Step 2: Run the Migration (2 minutes)

You have TWO options - pick whichever is easier:

#### Option A: Use Postman/Insomnia (Recommended)

1. **Open Postman** (or download it from https://www.postman.com/downloads/)

2. **Create a POST request**:
   - Method: `POST`
   - URL: `https://api.audacious.money/admin/migrations/backfill-stripe-customer-ids`

3. **Set Headers** tab:
   - Add header: `Content-Type` = `application/json`

4. **Set Body** tab:
   - Select "raw" and "JSON"
   - Paste this:
     ```json
     {
       "email": "your-admin-email@example.com",
       "password": "your-admin-password"
     }
     ```

5. **Click Send**

6. **You'll see a response** like:
   ```json
   {
     "success": true,
     "data": {
       "message": "Migration complete - updated 1 user(s)",
       "usersUpdated": 1,
       "errors": 0,
       "details": [
         {
           "email": "audreyanne614@gmail.com",
           "customerId": "cus_xxxxx",
           "status": "success"
         }
       ]
     }
   }
   ```

#### Option B: Use Your Browser Console (F12)

1. **Go to** your admin dashboard: https://admin.audacious.money
2. **Log in** as admin
3. **Press F12** to open console
4. **Paste this code** and press Enter:

```javascript
fetch('https://api.audacious.money/admin/migrations/backfill-stripe-customer-ids', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ MIGRATION COMPLETE:', data);
  if (data.success) {
    console.log(`Updated ${data.data.usersUpdated} user(s)`);
    console.log('Details:', data.data.details);
  }
})
.catch(err => console.error('❌ ERROR:', err));
```

### Step 3: Verify It Worked

1. **Go to the Billing page**: https://app.audacious.money/cpg/billing
2. **Hard refresh**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. **You should now see**:
   - Your payment method (card ending in xxxx)
   - Your billing history (past invoices)
   - Correct monthly cost ($20/month)

## If Something Goes Wrong

If you see an error, send me:
1. The exact error message you got
2. A screenshot of the response

## What About the $20 Price Update?

That's a separate simple SQL update. Once the migration works, I'll help you update the static price from $15 to $20.

---

**Created:** 2024-06-09
**Status:** Ready to run once deployment completes
