# Preview Deployments Guide

This document explains how preview deployments work for Graceful Books pull requests.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Using Preview Deployments](#using-preview-deployments)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Cleanup](#cleanup)
- [Troubleshooting](#troubleshooting)

## Overview

Preview deployments allow you to test and share changes before merging to the main branch. Every pull request automatically gets its own isolated preview environment.

### Benefits

- **Test Before Merge:** See your changes in a production-like environment
- **Share with Stakeholders:** Get feedback from non-technical team members
- **Isolated Testing:** Each PR has its own environment, no conflicts
- **Automatic Updates:** Preview updates on every push to the PR
- **Easy Cleanup:** Preview is automatically removed when PR closes

### Architecture

```
PR Created/Updated → GitHub Actions → Vercel Preview → Unique URL
PR Closed → GitHub Actions → Cleanup → Environment Removed
```

## How It Works

### Automatic Preview Creation

When you create or update a pull request:

1. **Trigger:** GitHub Actions detects PR event (opened, synchronize, reopened)
2. **Checkout:** PR branch code is checked out
3. **Build:** Application is built with preview environment variables
4. **Deploy:** Built app is deployed to Vercel preview environment
5. **Comment:** Preview URL is posted as a PR comment
6. **Status:** Deployment status is added to PR checks

### Preview Environment Details

Each preview deployment:
- Has a unique URL: `https://graceful-books-[hash].vercel.app`
- Is isolated from staging and production
- Uses preview-specific environment variables
- Runs full application functionality
- Is accessible to anyone with the URL (for sharing)

### Automatic Cleanup

When a pull request is closed (merged or abandoned):

1. **Trigger:** GitHub Actions detects PR closure
2. **Cleanup:** Vercel automatically garbage collects the preview
3. **Comment Update:** PR comment is updated with cleanup status
4. **Environment:** GitHub environment is marked as inactive

## Using Preview Deployments

### For PR Authors

**1. Create Your Pull Request**

```bash
git checkout -b feature/my-feature
# Make your changes
git add .
git commit -m "Add new feature"
git push origin feature/my-feature
# Create PR on GitHub
```

**2. Wait for Preview Deployment**

- GitHub Actions will automatically deploy your preview
- Watch the "Preview Deployment" check in your PR
- Preview typically ready in 2-5 minutes

**3. Access Your Preview**

- Look for the bot comment in your PR with the preview URL
- Click the URL to view your changes
- Share the URL with stakeholders for feedback

**4. Update Your Preview**

```bash
# Make additional changes
git add .
git commit -m "Address feedback"
git push origin feature/my-feature
# Preview automatically updates in 2-5 minutes
```

**5. Test Your Changes**

Use the preview to:
- Test new features in a production-like environment
- Verify UI/UX changes
- Test with different browsers and devices
- Share with designers, product managers, or clients
- Ensure nothing breaks in production-like conditions

### For Reviewers

**1. Find the Preview URL**

- Look for the "Preview Deployment Ready!" comment in the PR
- Or click the "View deployment" button in the PR checks

**2. Review the Changes**

- Test all functionality mentioned in the PR description
- Verify UI changes match designs
- Check for any console errors or warnings
- Test on different screen sizes (mobile, tablet, desktop)

**3. Provide Feedback**

- Comment on the PR with your findings
- Request changes if needed
- Approve when satisfied

### For Stakeholders

**1. Access the Preview**

- Developer will share the preview URL with you
- No login or special access required
- Works on any device with a web browser

**2. Test the Changes**

- Follow any testing instructions provided
- Try different scenarios and edge cases
- Note anything that doesn't work as expected

**3. Provide Feedback**

- Share your feedback in the PR comments or via your team's communication channel
- Be specific about what works and what needs improvement

## Configuration

### GitHub Secrets Required

The following secrets must be configured in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret | Description | How to Get |
|--------|-------------|------------|
| `VERCEL_TOKEN` | Vercel authentication token | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Your Vercel organization ID | Run `vercel link` or check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Run `vercel link` or check `.vercel/project.json` |

### GitHub Permissions

The workflow requires these permissions:
- `contents: read` - To check out code
- `pull-requests: write` - To post comments
- `deployments: write` - To create deployment records

These are configured in `.github/workflows/preview-deploy.yml`.

### Vercel Project Settings

In your Vercel project dashboard:

1. **Enable Preview Deployments**
   - Project Settings → Git → Production Branch: `main`
   - Preview Deployments: Enabled

2. **Configure Preview Environment Variables**
   - Project Settings → Environment Variables
   - Add preview-specific variables (see Environment Variables section)
   - Select "Preview" environment

## Environment Variables

### Preview-Specific Variables

Preview deployments use these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `preview` | Node environment identifier |
| `VITE_APP_ENV` | `preview` | Application environment |
| `VITE_DB_NAME` | `graceful-books-preview-pr-{number}` | Isolated database per PR |
| `VITE_PR_NUMBER` | `{number}` | PR number for tracking |

### Adding Preview Variables

**Via Vercel Dashboard:**

1. Go to Project Settings → Environment Variables
2. Add variable name and value
3. Select **Preview** environment
4. Save changes
5. Redeploy preview to apply changes

**Via Vercel CLI:**

```bash
vercel env add VITE_NEW_VARIABLE preview
```

### Variable Priority

Variables are loaded in this order (later ones override earlier):
1. Default values in code
2. `.env` file (not recommended for deployments)
3. Vercel environment variables
4. Workflow environment variables (in preview-deploy.yml)

## Cleanup

### Automatic Cleanup

Preview deployments are automatically cleaned up when:
- PR is merged
- PR is closed without merging
- PR is converted to draft (deployment disabled, cleaned up later)

### Cleanup Process

1. **Vercel Cleanup:** Vercel automatically garbage collects inactive preview deployments after 90 days, but typically removes them when PR closes
2. **GitHub Environment:** Environment is marked as inactive
3. **PR Comment:** Comment is updated to show cleanup status

### Manual Cleanup

If you need to manually clean up a preview:

**Via Vercel Dashboard:**

1. Go to Deployments
2. Find the preview deployment
3. Click "..." → Delete Deployment

**Via Vercel CLI:**

```bash
# List deployments
vercel ls

# Remove specific deployment
vercel rm [deployment-url]
```

### Cleanup Verification

To verify cleanup:
1. Check PR comment shows "Preview Deployment Cleaned Up"
2. Preview URL returns 404 (deployment removed)
3. Vercel dashboard shows deployment as deleted

## Troubleshooting

### Preview Deployment Fails

**Symptoms:** "Preview Deployment" check fails, no preview URL

**Solutions:**

1. **Check GitHub Actions Logs:**
   - Go to PR → Checks → Preview Deployment → View logs
   - Look for error messages

2. **Common Issues:**
   - TypeScript errors: Run `npm run type-check` locally
   - Build errors: Run `npm run build` locally
   - Missing secrets: Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   - Rate limits: Wait a few minutes and re-run workflow

3. **Re-run Workflow:**
   - Go to PR → Checks → Preview Deployment
   - Click "Re-run jobs"

### Preview URL Not Accessible

**Symptoms:** Deployment succeeds but URL returns 404 or error

**Solutions:**

1. **Wait a moment:** Vercel may still be propagating the deployment
2. **Check Vercel Logs:** Go to Vercel Dashboard → Deployments → Click deployment → View logs
3. **Verify Build:** Check that build completed successfully in logs
4. **Check DNS:** Ensure Vercel DNS is working (check Vercel status page)

### Preview Not Updating

**Symptoms:** Push to PR but preview shows old code

**Solutions:**

1. **Wait for Deployment:** Check PR for new "Preview Deployment" workflow run
2. **Force Refresh:** Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. **Clear Cache:** Clear browser cache and cookies for preview URL
4. **Check Workflow:** Verify workflow completed successfully

### Environment Variables Not Working

**Symptoms:** App behaves incorrectly in preview

**Solutions:**

1. **Verify Variables:** Check Vercel Dashboard → Project Settings → Environment Variables
2. **Check Environment:** Ensure variables are set for "Preview" environment
3. **Redeploy:** Trigger new deployment (push commit or re-run workflow)
4. **Check Prefix:** Vite variables must start with `VITE_`

### PR Comment Not Posted

**Symptoms:** Preview deploys but no comment appears

**Solutions:**

1. **Check Permissions:** Verify GitHub Actions has `pull-requests: write` permission
2. **Check Token:** Ensure GitHub token has necessary permissions
3. **Check Logs:** Look for errors in "Create or Update Preview Comment" step
4. **Manual Access:** Get URL from workflow logs even if comment fails

### Multiple Preview Comments

**Symptoms:** Multiple bot comments in PR

**Solutions:**

This shouldn't happen as the workflow updates existing comments. If it does:
1. Check workflow logic in `.github/workflows/preview-deploy.yml`
2. Manually delete duplicate comments
3. Report issue to maintainer

### Cleanup Not Running

**Symptoms:** PR closed but preview still accessible

**Solutions:**

1. **Wait:** Vercel may take a few minutes to cleanup
2. **Manual Cleanup:** Delete deployment manually (see Cleanup section)
3. **Check Workflow:** Verify "cleanup-preview" job ran successfully

### Preview URL Shared Publicly

**Symptoms:** Accidentally shared preview with unauthorized users

**Solutions:**

1. **Delete Deployment:** Immediately delete preview in Vercel Dashboard
2. **Close PR:** Closing PR triggers automatic cleanup
3. **Note:** Preview URLs are public by design for stakeholder sharing
4. **Future:** Don't share preview URLs externally, consider authentication if needed

## Best Practices

### For Development

1. **Test Locally First:** Ensure changes work locally before pushing
2. **Small PRs:** Keep PRs focused for easier preview testing
3. **Clear Descriptions:** Document what to test in PR description
4. **Test Checklist:** Provide testing checklist for reviewers

### For Review

1. **Check Preview URL:** Always test changes in preview before approving
2. **Multiple Devices:** Test on mobile and desktop
3. **Browser Testing:** Test in different browsers if UI changes
4. **Accessibility:** Check keyboard navigation and screen reader compatibility

### For Sharing

1. **Context:** Provide context when sharing preview URLs
2. **Instructions:** Include testing instructions
3. **Timeline:** Mention that preview will be removed when PR closes
4. **Feedback:** Specify how to provide feedback

### Security

1. **No Secrets in Code:** Never commit secrets, use environment variables
2. **Preview Data:** Don't use real user data in previews
3. **Test Data:** Use test/mock data for preview testing
4. **Access:** Remember preview URLs are publicly accessible

## Advanced Usage

### Custom Preview Variables

Add PR-specific variables to workflow:

```yaml
- name: Build Project Artifacts
  run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
  env:
    NODE_ENV: preview
    VITE_APP_ENV: preview
    VITE_PR_NUMBER: ${{ github.event.pull_request.number }}
    VITE_CUSTOM_VARIABLE: custom-value
```

### Custom Preview Domains

Configure custom preview domains in Vercel:
1. Project Settings → Domains
2. Add preview domain pattern
3. Configure DNS

### Preview with Feature Flags

Use PR number for feature flagging:

```typescript
const isPreview = import.meta.env.VITE_APP_ENV === 'preview';
const prNumber = import.meta.env.VITE_PR_NUMBER;

if (isPreview && prNumber === '123') {
  // Enable experimental feature for this PR only
}
```

## Support

For preview deployment issues:

1. **Check This Guide:** Review troubleshooting section
2. **Check Workflow Logs:** GitHub Actions logs provide detailed errors
3. **Check Vercel Logs:** Vercel Dashboard → Deployments → Logs
4. **Vercel Status:** https://www.vercel-status.com/
5. **Team Support:** Contact DevOps or engineering team

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Staging and production deployments
- [Staging Setup](./STAGING_SETUP.md) - Staging environment configuration
- [GitHub Actions Workflows](../.github/workflows/) - Workflow files

---

**Last Updated:** 2026-01-17
**Maintained by:** Engineering Team
