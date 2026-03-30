/**
 * Setup CPG Demo Session
 *
 * Run this in your browser console on localhost:3006 to set up a demo session
 * with CPG demo data access.
 *
 * Usage:
 * 1. Open http://localhost:3006 in your browser
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 * 5. Refresh the page
 */

const demoSession = {
  token: 'demo-token-cpg-' + Date.now(),
  user: {
    id: 'demo-user-cpg',
    email: 'demo@cpgdemo.com',
    name: 'CPG Demo User',
    companyId: 'demo-company-cpg',
    companyName: 'Demo CPG Company',
    deviceId: 'demo-device-cpg',
    role: 'OWNER'
  },
  products: [
    {
      id: 'cpg-product',
      name: 'CPU & CPG Calculator',
      slug: 'cpu-cpg-calculator',
      active: true
    }
  ],
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

// Set session
sessionStorage.setItem('graceful_books_session', JSON.stringify(demoSession));

// Trigger auth reload
window.dispatchEvent(new Event('graceful_books_login'));

console.log('✅ CPG Demo session created!');
console.log('📋 Company ID:', demoSession.user.companyId);
console.log('📋 User ID:', demoSession.user.id);
console.log('📋 Device ID:', demoSession.user.deviceId);
console.log('\n🔄 Please refresh the page (F5) to activate the session');
console.log('🚀 Then navigate to /cpg to access the CPG dashboard');
