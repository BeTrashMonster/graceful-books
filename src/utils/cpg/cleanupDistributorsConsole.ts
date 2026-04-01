/**
 * Console utility to cleanup distributors
 * Run `window.cleanupDistributors()` in browser console
 */

import { cleanupDistributors } from './cleanupDistributors';
import { DEMO_CONFIG } from '../../config/demoConfig';

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).cleanupDistributors = async () => {
    // Get companyId from current session instead of hardcoding
    let companyId = DEMO_CONFIG.COMPANY_ID; // Default fallback

    try {
      const session = sessionStorage.getItem('graceful_books_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.user?.id) {
          companyId = parsed.user.id;
          console.log(`📍 Using company ID from session: ${companyId}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not read session, using default company ID:', companyId);
    }

    console.log('🚨 WARNING: This will delete ALL distributors and calculations!');
    console.log(`🎯 Target company ID: ${companyId}`);
    console.log('Running cleanup in 3 seconds... Press Ctrl+C to cancel');

    await new Promise(resolve => setTimeout(resolve, 3000));

    await cleanupDistributors(companyId);

    console.log('✅ Cleanup complete! Reload the page to see changes.');
    console.log('💡 You can now create distributors with the new flexible fee structure.');
  };

  console.log('💡 Dev utility loaded: window.cleanupDistributors()');
}
