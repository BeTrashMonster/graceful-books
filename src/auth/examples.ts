/**
 * Authentication System Usage Examples
 *
 * Demonstrates how to use the authentication module in various scenarios.
 */

import {
  // Login
  login,
  createPassphraseTestData,
  storePassphraseTestData,
  validatePassphraseStrength,

  // Session
  getActiveSession,
  updateSessionActivity,
  hasActiveSession,
  renewSession,
  addSessionEventListener,

  // Device tokens
  getDeviceFingerprint,
  isDeviceRemembered,
  revokeDeviceToken,

  // Logout
  logout,
  setupLogoutHandlers,
  logoutWithConfirmation,

  // Types
  type LoginRequest,
  type SessionEvent,
} from './index';

/**
 * Example 1: First-time account setup
 *
 * When a user creates their company for the first time,
 * we need to create the passphrase test data.
 */
export async function exampleAccountCreation(
  passphrase: string,
  companyId: string,
  userEmail: string
): Promise<void> {
  // 1. Validate passphrase strength
  const validation = validatePassphraseStrength(passphrase);
  if (!validation.isValid) {
    console.error('Weak passphrase:', validation.error);
    if (validation.suggestions) {
      console.log('Suggestions:', validation.suggestions);
    }
    return;
  }

  // 2. Create passphrase test data
  const testData = await createPassphraseTestData(passphrase, companyId);

  // 3. Store test data for future logins
  await storePassphraseTestData(testData);

  // 4. Log the user in automatically
  const deviceFingerprint = await getDeviceFingerprint();
  const loginRequest: LoginRequest = {
    passphrase,
    companyId,
    userIdentifier: userEmail,
    rememberDevice: true,
    deviceFingerprint,
  };

  const response = await login(loginRequest);
  if (response.success) {
    console.log('Account created and logged in successfully!');
  }
}

/**
 * Example 2: Standard login flow
 *
 * When a user logs in to their existing account.
 */
export async function exampleLogin(
  passphrase: string,
  companyId: string,
  userEmail: string,
  rememberDevice = false
): Promise<boolean> {
  // 1. Get device fingerprint if needed
  const deviceFingerprint = rememberDevice
    ? await getDeviceFingerprint()
    : undefined;

  // 2. Attempt login
  const response = await login({
    passphrase,
    companyId,
    userIdentifier: userEmail,
    rememberDevice,
    deviceFingerprint,
  });

  // 3. Handle response
  if (response.success) {
    console.log('Login successful!');
    console.log('Session token:', response.token);
    console.log('Expires at:', new Date(response.expiresAt!));

    if (response.deviceToken) {
      console.log('Device will be remembered');
    }

    return true;
  } else {
    console.error('Login failed:', response.error);
    console.error('Error code:', response.errorCode);
    return false;
  }
}

/**
 * Example 3: Checking authentication status
 *
 * Check if user is currently authenticated.
 */
export function exampleCheckAuth(): void {
  if (hasActiveSession()) {
    const session = getActiveSession();
    console.log('User is authenticated');
    console.log('User ID:', session?.userId);
    console.log('Company ID:', session?.companyId);
    console.log('Session expires at:', new Date(session!.expiresAt));
  } else {
    console.log('User is not authenticated');
    // Redirect to login page
  }
}

/**
 * Example 4: Setting up session management
 *
 * Initialize session event listeners and activity tracking.
 */
export function exampleSetupSessionManagement(): void {
  // 1. Listen to session events
  addSessionEventListener((event: SessionEvent) => {
    switch (event.type) {
      case 'login':
        console.log('User logged in:', event.userId);
        break;

      case 'logout':
        console.log('User logged out:', event.userId);
        // Redirect to login page
        window.location.href = '/login';
        break;

      case 'timeout':
        console.log('Session timed out');
        alert('Your session has expired due to inactivity. Please log in again.');
        window.location.href = '/login';
        break;

      case 'renewal':
        console.log('Session renewed');
        break;

      case 'validation_failed':
        console.log('Token validation failed');
        break;
    }
  });

  // 2. Update activity on user interactions
  const updateActivity = () => updateSessionActivity();

  document.addEventListener('click', updateActivity);
  document.addEventListener('keypress', updateActivity);
  document.addEventListener('scroll', updateActivity);
  document.addEventListener('mousemove', updateActivity);

  // 3. Setup automatic logout handlers
  const session = getActiveSession();
  if (session) {
    setupLogoutHandlers(session.companyId);
  }
}

/**
 * Example 5: Manual session renewal
 *
 * Manually renew session before making a critical operation.
 */
export async function exampleRenewSession(): Promise<void> {
  const result = await renewSession();

  if (result.success) {
    console.log('Session renewed');
    console.log('New token:', result.newToken);
    console.log('New expiration:', new Date(result.expiresAt!));
  } else {
    console.error('Session renewal failed:', result.error);
    // Re-authenticate user
  }
}

/**
 * Example 6: Remember device functionality
 *
 * Check if device is remembered and show appropriate UI.
 */
export async function exampleRememberDevice(companyId: string): Promise<void> {
  const isRemembered = await isDeviceRemembered(companyId);

  if (isRemembered) {
    console.log('Welcome back! This device is trusted.');
    // Show simplified login or auto-login
  } else {
    console.log('New or forgotten device');
    // Show full login form
  }
}

/**
 * Example 7: Forget device
 *
 * User wants to remove device token.
 */
export async function exampleForgetDevice(companyId: string): Promise<void> {
  await revokeDeviceToken(companyId);
  console.log('Device forgotten. You will need to log in fully next time.');
}

/**
 * Example 8: Standard logout
 *
 * User clicks logout button.
 */
export async function exampleLogout(): Promise<void> {
  await logout({
    reason: 'user_initiated',
    forgetDevice: false, // Keep device token
  });

  console.log('Logged out successfully');
  window.location.href = '/login';
}

/**
 * Example 9: Logout with confirmation
 *
 * Show confirmation dialog before logout.
 */
export async function exampleLogoutWithConfirmation(): Promise<void> {
  const confirmed = await logoutWithConfirmation({
    reason: 'user_initiated',
    forgetDevice: false,
  });

  if (confirmed) {
    console.log('User logged out');
    window.location.href = '/login';
  } else {
    console.log('Logout cancelled');
  }
}

/**
 * Example 10: Security logout
 *
 * Logout due to security event (e.g., passphrase change).
 */
export async function exampleSecurityLogout(): Promise<void> {
  await logout({
    reason: 'security',
    forgetDevice: true, // Remove device token
    revokeAllSessions: true, // Revoke all sessions
  });

  console.log('Security logout completed');
  alert('For your security, you have been logged out from all devices.');
  window.location.href = '/login';
}

/**
 * Example 11: Protected route guard
 *
 * Function to protect routes that require authentication.
 */
export function exampleRouteGuard(
  navigateToLogin: () => void
): boolean {
  if (!hasActiveSession()) {
    console.log('Authentication required');
    navigateToLogin();
    return false;
  }

  const session = getActiveSession();

  // Check if session is expired
  if (session!.expiresAt < Date.now()) {
    console.log('Session expired');
    logout({ reason: 'timeout' });
    navigateToLogin();
    return false;
  }

  // Update activity
  updateSessionActivity();

  return true;
}

/**
 * Example 12: Complete authentication flow
 *
 * Full example showing login, session management, and logout.
 */
export async function exampleCompleteFlow(): Promise<void> {
  const companyId = 'company-123';
  const userEmail = 'user@example.com';
  const passphrase = 'my-secure-passphrase-with-good-entropy';

  // Step 1: Setup (only needed once per account)
  console.log('=== ACCOUNT SETUP ===');
  const testData = await createPassphraseTestData(passphrase, companyId);
  await storePassphraseTestData(testData);
  console.log('Account setup complete');

  // Step 2: Login
  console.log('\n=== LOGIN ===');
  const loginResponse = await login({
    passphrase,
    companyId,
    userIdentifier: userEmail,
    rememberDevice: true,
    deviceFingerprint: await getDeviceFingerprint(),
  });

  if (!loginResponse.success) {
    console.error('Login failed:', loginResponse.error);
    return;
  }

  console.log('Login successful!');

  // Step 3: Setup session management
  console.log('\n=== SESSION MANAGEMENT ===');
  exampleSetupSessionManagement();
  console.log('Session management active');

  // Step 4: Check authentication status
  console.log('\n=== AUTH STATUS ===');
  exampleCheckAuth();

  // Step 5: Simulate user activity
  console.log('\n=== USER ACTIVITY ===');
  updateSessionActivity();
  console.log('Activity updated');

  // Step 6: Manual renewal (if needed)
  console.log('\n=== SESSION RENEWAL ===');
  await exampleRenewSession();

  // Step 7: Logout
  console.log('\n=== LOGOUT ===');
  await logout({ reason: 'user_initiated' });
  console.log('Logged out');

  // Step 8: Verify logout
  console.log('\n=== VERIFY LOGOUT ===');
  exampleCheckAuth(); // Should show not authenticated
}

/**
 * Example 13: Error handling
 *
 * Proper error handling for authentication operations.
 */
export async function exampleErrorHandling(
  passphrase: string,
  companyId: string,
  userEmail: string
): Promise<void> {
  try {
    const response = await login({
      passphrase,
      companyId,
      userIdentifier: userEmail,
    });

    if (!response.success) {
      // Handle specific error codes
      switch (response.errorCode) {
        case 'INVALID_PASSPHRASE':
          console.error('Incorrect passphrase. Please try again.');
          // Show error message to user
          break;

        case 'RATE_LIMITED':
          console.error('Too many failed attempts.');
          console.error(response.error); // Shows wait time
          // Show lockout message to user
          break;

        case 'ACCOUNT_LOCKED':
          console.error('Account is locked. Please contact support.');
          break;

        case 'UNKNOWN_ERROR':
        default:
          console.error('An unexpected error occurred.');
          console.error(response.error);
          break;
      }

      return;
    }

    console.log('Login successful!');

  } catch (error) {
    // Catch unexpected errors
    console.error('Critical error during login:', error);
    // Log to error tracking service
  }
}
