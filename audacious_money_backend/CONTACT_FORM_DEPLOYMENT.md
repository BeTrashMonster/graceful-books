# Contact Form - Deployment Checklist

## ✅ What's Been Done

### Backend Changes (All Committed & Pushed)
- ✅ Added `sendContactFormEmail()` function to `email.service.ts`
- ✅ Added `contactFormSchema` to `validation.ts`
- ✅ Created `/contact` route in `contact.ts`
- ✅ Registered route in `app.ts`
- ✅ Local `.env` updated with `http://localhost:4321`

### Frontend Changes (All Committed & Pushed)
- ✅ Contact page created at `/contact`
- ✅ Form submits to backend `/contact` endpoint
- ✅ 2000 character limit on message
- ✅ Mobile responsive with hamburger menu
- ✅ Character counter

## 🚨 REQUIRED: Production Deployment Step

**You MUST update this one environment variable on DigitalOcean for the contact form to work in production:**

### Step-by-Step:

1. **Log into DigitalOcean**
2. **Go to your backend App Platform app**
3. **Navigate to Settings → Environment Variables**
4. **Find `ALLOWED_ORIGINS`**
5. **Update it to include the marketing site:**

```
https://audacious.money,https://www.audacious.money,https://app.audacious.money,https://admin.audacious.money
```

6. **Save Changes**
7. **Redeploy** (should happen automatically)

### Current Production Issue

Right now, when someone submits the contact form from `https://audacious.money/contact`, they get:
> "The requested endpoint does not exist"

**This is because:**
- The frontend is trying to POST to `https://api.audacious.money/contact`
- The backend is blocking the request because `audacious.money` is not in ALLOWED_ORIGINS
- The browser shows a CORS error in the console

**After updating ALLOWED_ORIGINS:**
- The backend will accept requests from the marketing site
- Contact form submissions will go through
- Emails will be delivered to hello@audacious.money (or noreply@audacious.money based on POSTMARK_FROM_EMAIL)

## How It Works

### Flow:
1. User visits `https://audacious.money/contact`
2. User fills out form and clicks "Send Message"
3. Frontend validates (2000 char limit, required fields)
4. Frontend POSTs to `https://api.audacious.money/contact`
5. Backend validates request
6. Backend calls Postmark to send email
7. Email arrives at your inbox (FROM_EMAIL address)
8. **You can reply directly** - it's set to reply to the user's email!

### Email Format:
**Subject:** `[Contact Form] Technical Support - John Doe`
**To:** `hello@audacious.money` (or whatever POSTMARK_FROM_EMAIL is set to)
**Reply-To:** User's email address
**Body:** Formatted HTML with contact details and message

## Testing After Deployment

1. **Deploy the changes** (update ALLOWED_ORIGINS on DigitalOcean)
2. **Wait for deployment to complete** (~2-3 minutes)
3. **Go to** `https://audacious.money/contact`
4. **Fill out the form:**
   - Name: Test User
   - Email: your-test-email@example.com
   - Subject: General Inquiry
   - Message: Testing the contact form
5. **Click "Send Message"**
6. **You should see:** ✓ "Message sent! We'll get back to you soon."
7. **Check your inbox** - you should receive the email!

## Troubleshooting

### Still getting "endpoint does not exist" error?

1. **Check ALLOWED_ORIGINS on DigitalOcean:**
   - Make sure it includes `https://audacious.money` AND `https://www.audacious.money`
   - No trailing slashes
   - Comma-separated, no spaces

2. **Check if backend redeployed:**
   - DigitalOcean → App Platform → Your Backend App → Activity
   - Should show a recent deployment

3. **Check browser console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for CORS errors
   - If you see "Access-Control-Allow-Origin" error, ALLOWED_ORIGINS is still wrong

4. **Test the endpoint directly:**
   ```bash
   curl https://api.audacious.money/contact \
     -X OPTIONS \
     -H "Origin: https://audacious.money" \
     -v
   ```
   Should return `200 OK` with CORS headers

### Email not arriving?

1. **Check Postmark:**
   - Log into Postmark
   - Go to Message Streams → Outbound
   - Check recent activity
   - Look for errors or bounces

2. **Check environment variables:**
   - `POSTMARK_SERVER_TOKEN` is set correctly
   - `POSTMARK_FROM_EMAIL` is a verified sender in Postmark
   - `POSTMARK_FROM_NAME` is set

3. **Check spam folder:**
   - Sometimes transactional emails land in spam initially

## Local Development

For local testing, your `.env` file has been updated with:
```
ALLOWED_ORIGINS=http://localhost:3006,http://localhost:3000,http://localhost:3010,http://localhost:3008,http://localhost:4321,http://localhost:4322,http://localhost:4323
```

Port `4321` is the default Astro dev server port.

To test locally:
1. Start backend: `cd audacious_money_backend && npm run dev`
2. Start marketing site: `cd audacious_money_marketing && npm run dev`
3. Go to `http://localhost:4321/contact`
4. Fill out the form
5. Email should arrive at your configured FROM_EMAIL address

## Summary

**What you need to do RIGHT NOW:**
1. Update `ALLOWED_ORIGINS` on DigitalOcean (see above)
2. Wait for redeploy
3. Test the form at `https://audacious.money/contact`
4. Done! 🎉

After this one change, the contact form will work perfectly end-to-end.
