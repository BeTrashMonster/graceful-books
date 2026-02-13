/**
 * Console utility to cleanup distributors
 * Run `window.cleanupDistributors()` in browser console
 */

import { cleanupDistributors } from './cleanupDistributors';

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).cleanupDistributors = async () => {
    const companyId = 'cpg-demo'; // Default company ID

    console.log('🚨 WARNING: This will delete ALL distributors and calculations!');
    console.log('Running cleanup in 3 seconds... Press Ctrl+C to cancel');

    await new Promise(resolve => setTimeout(resolve, 3000));

    await cleanupDistributors(companyId);

    console.log('✅ Cleanup complete! Reload the page to see changes.');
    console.log('💡 You can now create distributors with the new flexible fee structure.');
  };

  console.log('💡 Dev utility loaded: window.cleanupDistributors()');
}
