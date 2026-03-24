# Postmark Setup Guide

Quick reference for setting up Postmark email service.

## 1. Create Account

1. Go to https://postmarkapp.com
2. Sign up (100 emails/month free, no credit card)
3. Verify your email

## 2. Get Server API Token

1. In Postmark dashboard, click "Servers"
2. Click on "Default Server" (or create new: "Audacious Money Production")
3. Go to "API Tokens" tab
4. Copy the **Server API token**
5. Save it for your `.env` file

## 3. Quick Test (Before Domain Verification)

For immediate testing, add a Sender Signature:

1. Click "Sender Signatures" in left sidebar
2. Click "Add Sender Signature"
3. Enter YOUR email address (the one you signed up with)
4. Check your email and verify
5. Now you can send test emails from this address

## 4. Verify Your Domain (Production)

1. In Postmark: "Sender Signatures" → "Domains" tab
2. Click "Add Domain"
3. Enter: `audacious.money`
4. Postmark shows DNS records like:

```
DKIM Record:
Type: TXT
Name: 20240320._domainkey.audacious.money
Value: k=rsa; p=MIGfMA0GCS... [long string from Postmark]

Return-Path:
Type: CNAME
Name: pm-bounces.audacious.money
Value: pm.mtasv.net
```

5. Add these to Cloudflare DNS:
   - Go to Cloudflare dashboard
   - Select audacious.money domain
   - DNS → Add record
   - **Important:** Set Proxy status to "DNS only" (grey cloud icon)
   - Add both records Postmark gave you

6. Back in Postmark, click "Verify"
7. Wait a few minutes for DNS propagation
8. Once green checkmark appears, you're done!

## 5. Environment Variables

Add to your `.env` file:

```bash
POSTMARK_SERVER_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
POSTMARK_FROM_EMAIL=noreply@audacious.money
POSTMARK_FROM_NAME=Audacious Money
```

## 6. Install Package

In your backend:

```bash
cd audacious_money_backend
bun add postmark
```

## 7. Test Email Service

In your backend, create a test route:

```typescript
// In src/routes/test.ts
import { sendTestEmail } from '../services/email.service';

app.get('/test/email', async (c) => {
  await sendTestEmail('your-email@example.com');
  return c.json({ message: 'Test email sent!' });
});
```

Then:
```bash
# Start your backend
bun run dev

# In another terminal
curl http://localhost:3000/test/email
```

Check your inbox - you should receive a test email!

## 8. Monitoring

Postmark provides:
- Activity dashboard (see all sent emails)
- Bounce tracking (automatic)
- Spam complaint tracking
- Open/click tracking (optional)

## Pricing

- **Free:** 100 emails/month
- **Tier 1:** $15/month for 10,000 emails
- **Tier 2:** $50/month for 50,000 emails

No surprises, no hidden fees.

## Support

Postmark has excellent documentation at:
https://postmarkapp.com/developer

If you get stuck, their support is very responsive.

## Troubleshooting

**DNS not verifying?**
- Wait 10-15 minutes for DNS propagation
- Make sure Cloudflare proxy is OFF (grey cloud)
- Check DNS with: `dig TXT 20240320._domainkey.audacious.money`

**Emails not sending?**
- Check your Server API token is correct
- Make sure you're sending from verified domain/signature
- Check Postmark Activity dashboard for error details

**Rate limits?**
- Free tier: 100 emails/month
- If you hit the limit, upgrade to paid plan
- Postmark will queue (not drop) emails if you exceed temporarily
