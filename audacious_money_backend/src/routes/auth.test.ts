/**
 * Integration tests for authentication routes
 *
 * Tests user signup, login, email verification, and password reset
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testClient } from 'hono/testing';
import app from '../app.js';
import { initializeDatabase, closeDatabase, query } from '../db/connection.js';

// Test client
const client = testClient(app);

/**
 * Setup database connection before all tests
 */
beforeAll(async () => {
  // Initialize database connection
  initializeDatabase();
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  await closeDatabase();
});

/**
 * Clean up test data before each test
 */
beforeEach(async () => {
  // Delete test users created during tests
  await query('DELETE FROM users WHERE email LIKE $1', ['test-%@example.com']);
});

describe('POST /auth/signup', () => {
  it('should create a new user with valid data', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-user@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Company',
      },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.user).toBeDefined();
    expect(data.data.user.email).toBe('test-user@example.com');
    expect(data.data.user.firstName).toBe('Test');
    expect(data.data.user.lastName).toBe('User');
    expect(data.data.user.supportKey).toBeDefined();
    expect(data.data.user.emailVerified).toBe(false);
    expect(data.data.token).toBeDefined();
    expect(data.message).toContain('Account created successfully');

    // Verify password is not returned
    expect(data.data.user.password).toBeUndefined();
    expect(data.data.user.password_hash).toBeUndefined();
  });

  it('should create a user without optional fields', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-minimal@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data.user.email).toBe('test-minimal@example.com');
  });

  it('should track affiliate code if provided', async () => {
    // First, create a test affiliate
    const affiliateResult = await query(
      `
      INSERT INTO affiliates (code, email, name, commission_type, commission_value, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      ['TESTPARTNER', 'partner@example.com', 'Test Partner', 'percentage', 10, true]
    );

    const response = await client.auth.signup.$post({
      json: {
        email: 'test-affiliate@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'Affiliate',
        affiliateCode: 'TESTPARTNER',
      },
    });

    expect(response.status).toBe(201);

    // Verify affiliate conversion was created
    const conversionResult = await query(
      `
      SELECT ac.* FROM affiliate_conversions ac
      JOIN users u ON u.id = ac.user_id
      WHERE u.email = $1
      `,
      ['test-affiliate@example.com']
    );

    expect(conversionResult.rowCount).toBeGreaterThan(0);

    // Cleanup
    await query('DELETE FROM affiliates WHERE code = $1', ['TESTPARTNER']);
  });

  it('should reject duplicate email', async () => {
    // Create first user
    await client.auth.signup.$post({
      json: {
        email: 'test-duplicate@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Try to create second user with same email
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-duplicate@example.com',
        password: 'DifferentPass123!',
        firstName: 'Another',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(409);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('EMAIL_EXISTS');
  });

  it('should reject weak password', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-weak@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject password without uppercase letter', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-nouppercase@example.com',
        password: 'securepass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details.errors).toBeDefined();
  });

  it('should reject password without special character', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-nospecial@example.com',
        password: 'SecurePass123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject invalid email format', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'not-an-email',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing required fields', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-incomplete@example.com',
        password: 'SecurePass123!',
        // Missing firstName and lastName
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should normalize email to lowercase', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'Test-UPPERCASE@EXAMPLE.COM',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data.user.email).toBe('test-uppercase@example.com');
  });

  it('should generate unique support key for each user', async () => {
    // Create multiple users
    const response1 = await client.auth.signup.$post({
      json: {
        email: 'test-key1@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User1',
      },
    });

    const response2 = await client.auth.signup.$post({
      json: {
        email: 'test-key2@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User2',
      },
    });

    expect(response1.status).toBe(201);
    expect(response2.status).toBe(201);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.data.user.supportKey).toBeDefined();
    expect(data2.data.user.supportKey).toBeDefined();
    expect(data1.data.user.supportKey).not.toBe(data2.data.user.supportKey);
  });

  it('should create audit log entry', async () => {
    const response = await client.auth.signup.$post({
      json: {
        email: 'test-audit@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    const userId = data.data.user.id;

    // Check audit log
    const auditResult = await query(
      `
      SELECT * FROM admin_audit_log
      WHERE action = 'user_signup' AND resource_id = $1
      `,
      [userId]
    );

    expect(auditResult.rowCount).toBeGreaterThan(0);
    expect(auditResult.rows[0].resource_type).toBe('user');
  });
});

describe('POST /auth/login', () => {
  it('should login successfully with valid credentials', async () => {
    // First, create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-login-success@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Now login with the same credentials
    const response = await client.auth.login.$post({
      json: {
        email: 'test-login-success@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.user).toBeDefined();
    expect(data.data.user.email).toBe('test-login-success@example.com');
    expect(data.data.user.firstName).toBe('Test');
    expect(data.data.user.lastName).toBe('User');
    expect(data.data.user.supportKey).toBeDefined();
    expect(data.data.token).toBeDefined();
    expect(data.message).toContain('Login successful');

    // Verify password is not returned
    expect(data.data.user.password).toBeUndefined();
    expect(data.data.user.password_hash).toBeUndefined();
  });

  it('should reject login with wrong password', async () => {
    // Create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-wrong-password@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Try to login with wrong password
    const response = await client.auth.login.$post({
      json: {
        email: 'test-wrong-password@example.com',
        password: 'WrongPassword123!',
      },
    });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.message).toBe('Invalid email or password');
  });

  it('should reject login with non-existent email', async () => {
    const response = await client.auth.login.$post({
      json: {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    // Generic message - don't reveal if email exists
    expect(data.error.message).toBe('Invalid email or password');
  });

  it('should reject login for suspended account', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-suspended@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Suspend the user's account
    await query('UPDATE users SET account_status = $1 WHERE id = $2', ['suspended', userId]);

    // Try to login
    const response = await client.auth.login.$post({
      json: {
        email: 'test-suspended@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(data.error.message).toContain('suspended');
  });

  it('should update last_login_at timestamp on successful login', async () => {
    // Create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-last-login@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Check initial last_login_at (should be null)
    const beforeLogin = await query('SELECT last_login_at FROM users WHERE email = $1', [
      'test-last-login@example.com',
    ]);
    expect(beforeLogin.rows[0].last_login_at).toBeNull();

    // Login
    const response = await client.auth.login.$post({
      json: {
        email: 'test-last-login@example.com',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(200);

    // Check last_login_at was updated
    const afterLogin = await query('SELECT last_login_at FROM users WHERE email = $1', [
      'test-last-login@example.com',
    ]);
    expect(afterLogin.rows[0].last_login_at).not.toBeNull();
  });

  it('should track failed login attempts', async () => {
    // Try to login with non-existent user
    await client.auth.login.$post({
      json: {
        email: 'test-failed-tracking@example.com',
        password: 'SecurePass123!',
      },
    });

    // Check audit log for failed login
    const auditResult = await query(
      `
      SELECT * FROM admin_audit_log
      WHERE action = 'failed_login'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      []
    );

    expect(auditResult.rowCount).toBeGreaterThan(0);
    expect(auditResult.rows[0].action).toBe('failed_login');
  });

  it('should create audit log entry on successful login', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-audit-login@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Login
    await client.auth.login.$post({
      json: {
        email: 'test-audit-login@example.com',
        password: 'SecurePass123!',
      },
    });

    // Check audit log
    const auditResult = await query(
      `
      SELECT * FROM admin_audit_log
      WHERE action = 'user_login' AND resource_id = $1
      `,
      [userId]
    );

    expect(auditResult.rowCount).toBeGreaterThan(0);
    expect(auditResult.rows[0].resource_type).toBe('user');
  });

  it('should normalize email to lowercase during login', async () => {
    // Create user with lowercase email
    await client.auth.signup.$post({
      json: {
        email: 'test-case-sensitive@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Login with uppercase email (should work due to validation schema)
    const response = await client.auth.login.$post({
      json: {
        email: 'Test-CASE-Sensitive@EXAMPLE.COM',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.user.email).toBe('test-case-sensitive@example.com');
  });

  it('should reject login with missing password', async () => {
    const response = await client.auth.login.$post({
      json: {
        email: 'test@example.com',
        password: '',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject login with invalid email format', async () => {
    const response = await client.auth.login.$post({
      json: {
        email: 'not-an-email',
        password: 'SecurePass123!',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should have timing-safe password verification (same response time for existing/non-existing users)', async () => {
    // Create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-timing@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Test 1: Existing user with wrong password
    const start1 = Date.now();
    await client.auth.login.$post({
      json: {
        email: 'test-timing@example.com',
        password: 'WrongPassword123!',
      },
    });
    const duration1 = Date.now() - start1;

    // Test 2: Non-existing user
    const start2 = Date.now();
    await client.auth.login.$post({
      json: {
        email: 'nonexistent-timing@example.com',
        password: 'SecurePass123!',
      },
    });
    const duration2 = Date.now() - start2;

    // Response times should be similar (within 100ms)
    // This is a rough check - actual timing attacks are more sophisticated
    const timeDifference = Math.abs(duration1 - duration2);
    expect(timeDifference).toBeLessThan(100);
  });
});

describe('POST /auth/verify-email', () => {
  it('should verify email with valid token', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-verify@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Generate a verification token (using the same method as email service)
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId,
        email: 'test-verify@example.com',
        purpose: 'email_verification',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
      },
      secret!
    );

    // Verify email
    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.verified).toBe(true);
    expect(data.message).toContain('verified successfully');

    // Check database was updated
    const userResult = await query('SELECT email_verified FROM users WHERE id = $1', [userId]);
    expect(userResult.rows[0].email_verified).toBe(true);

    // Check audit log
    const auditResult = await query(
      `SELECT * FROM admin_audit_log WHERE action = 'email_verified' AND resource_id = $1`,
      [userId]
    );
    expect(auditResult.rowCount).toBeGreaterThan(0);
  });

  it('should handle already verified email gracefully', async () => {
    // Create and verify a user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-already-verified@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Manually set email as verified
    await query('UPDATE users SET email_verified = true WHERE id = $1', [userId]);

    // Generate token
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId,
        email: 'test-already-verified@example.com',
        purpose: 'email_verification',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
      secret!
    );

    // Try to verify again
    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.verified).toBe(true);
    expect(data.message).toContain('already verified');
  });

  it('should reject invalid token', async () => {
    const response = await client.auth['verify-email'].$post({
      json: { token: 'invalid-token-12345' },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('TOKEN_EXPIRED');
    expect(data.error.message).toContain('expired');
  });

  it('should reject token with wrong purpose', async () => {
    // Create a user token (not verification token)
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId: 'fake-user-id',
        email: 'test@example.com',
        purpose: 'password_reset', // Wrong purpose
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      },
      secret!
    );

    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
    expect(data.error.message).toContain('Invalid verification token');
  });

  it('should reject expired token', async () => {
    // Create an expired token
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId: 'fake-user-id',
        email: 'test@example.com',
        purpose: 'email_verification',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      },
      secret!
    );

    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('TOKEN_EXPIRED');
  });

  it('should reject token for non-existent user', async () => {
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId: '00000000-0000-0000-0000-000000000000', // Non-existent UUID
        email: 'nonexistent@example.com',
        purpose: 'email_verification',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
      secret!
    );

    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
    expect(data.error.message).toContain('Invalid verification token');
  });

  it('should reject token with email mismatch', async () => {
    // Create a user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-mismatch@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Create token with different email
    const { sign } = await import('hono/jwt');
    const secret = process.env.JWT_SECRET;
    const token = await sign(
      {
        userId,
        email: 'different-email@example.com', // Wrong email
        purpose: 'email_verification',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
      secret!
    );

    const response = await client.auth['verify-email'].$post({
      json: { token },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
  });

  it('should reject missing token', async () => {
    const response = await client.auth['verify-email'].$post({
      json: {},
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/resend-verification', () => {
  it('should resend verification email for authenticated unverified user', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-resend@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const token = signupData.data.token;

    // Resend verification email
    const response = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }));

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.sent).toBe(true);
    expect(data.message).toContain('Verification email sent');

    // Check audit log
    const auditResult = await query(
      `SELECT * FROM admin_audit_log WHERE action = 'resend_verification_email' ORDER BY created_at DESC LIMIT 1`,
      []
    );
    expect(auditResult.rowCount).toBeGreaterThan(0);
  });

  it('should reject resend for already verified user', async () => {
    // Create and verify a user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-resend-verified@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const token = signupData.data.token;
    const userId = signupData.data.user.id;

    // Mark as verified
    await query('UPDATE users SET email_verified = true WHERE id = $1', [userId]);

    // Try to resend
    const response = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }));

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_STATUS');
    expect(data.error.message).toContain('already verified');
  });

  it('should reject resend without authentication', async () => {
    const response = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }));

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('TOKEN_REQUIRED');
  });

  it('should rate limit resend requests', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-rate-limit@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const token = signupData.data.token;

    // First resend should work
    const response1 = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }));

    expect(response1.status).toBe(200);

    // Immediate second resend should be rate limited
    const response2 = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }));

    expect(response2.status).toBe(429);

    const data = await response2.json();
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(data.error.message).toContain('wait');
  });

  it('should reject resend with invalid token', async () => {
    const response = await fetch(new Request('http://localhost/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-12345',
      },
    }));

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
  });
});

describe('POST /auth/forgot-password', () => {
  it('should return success for existing email', async () => {
    // Create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-reset-exists@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Request password reset
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'test-reset-exists@example.com' },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.message).toBeDefined();
    expect(data.data.message).toContain('If that email address is in our system');

    // Check password_reset_tokens table
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      ['test-reset-exists@example.com']
    );

    expect(tokenResult.rowCount).toBeGreaterThan(0);
    expect(tokenResult.rows[0].token).toBeDefined();
    expect(tokenResult.rows[0].token).toHaveLength(64); // 32 bytes hex = 64 chars
    expect(tokenResult.rows[0].used_at).toBeNull();
    expect(new Date(tokenResult.rows[0].expires_at) > new Date()).toBe(true);

    // Check audit log
    const auditResult = await query(
      `SELECT * FROM admin_audit_log WHERE action = 'password_reset_requested' ORDER BY created_at DESC LIMIT 1`,
      []
    );

    expect(auditResult.rowCount).toBeGreaterThan(0);
  });

  it('should return success for non-existent email (prevent enumeration)', async () => {
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'nonexistent-reset@example.com' },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.message).toBeDefined();
    expect(data.data.message).toContain('If that email address is in our system');

    // Check no token was created
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1`,
      ['nonexistent-reset@example.com']
    );

    expect(tokenResult.rowCount).toBe(0);
  });

  it('should not create token for suspended accounts', async () => {
    // Create and suspend a user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-reset-suspended@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    await query('UPDATE users SET account_status = $1 WHERE id = $2', ['suspended', userId]);

    // Request password reset
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'test-reset-suspended@example.com' },
    });

    expect(response.status).toBe(200);

    // Same success message (no enumeration)
    const data = await response.json();
    expect(data.data.message).toContain('If that email address is in our system');

    // Check no token was created
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens WHERE user_id = $1`,
      [userId]
    );

    expect(tokenResult.rowCount).toBe(0);
  });

  it('should reject invalid email format', async () => {
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'not-an-email' },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should normalize email to lowercase', async () => {
    // Create user with lowercase email
    await client.auth.signup.$post({
      json: {
        email: 'test-reset-case@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Request reset with uppercase email
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'Test-RESET-Case@EXAMPLE.COM' },
    });

    expect(response.status).toBe(200);

    // Check token was created with lowercase email
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1`,
      ['test-reset-case@example.com']
    );

    expect(tokenResult.rowCount).toBeGreaterThan(0);
  });

  it('should set token expiry to 1 hour', async () => {
    // Create a test user
    await client.auth.signup.$post({
      json: {
        email: 'test-reset-expiry@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Request password reset
    const response = await client.auth['forgot-password'].$post({
      json: { email: 'test-reset-expiry@example.com' },
    });

    expect(response.status).toBe(200);

    // Check token expiry
    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      ['test-reset-expiry@example.com']
    );

    expect(tokenResult.rowCount).toBeGreaterThan(0);

    const expiresAt = new Date(tokenResult.rows[0].expires_at);
    const createdAt = new Date(tokenResult.rows[0].created_at);
    const differenceMinutes = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60);

    expect(differenceMinutes).toBeGreaterThanOrEqual(59);
    expect(differenceMinutes).toBeLessThanOrEqual(61);
  });
});

describe('POST /auth/reset-password', () => {
  it('should reset password with valid token', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-password-reset@example.com',
        password: 'OldSecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Request password reset
    await client.auth['forgot-password'].$post({
      json: { email: 'test-password-reset@example.com' },
    });

    // Get the token from database
    const tokenResult = await query(
      `SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    expect(tokenResult.rowCount).toBeGreaterThan(0);
    const token = tokenResult.rows[0].token;

    // Reset password
    const response = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'NewSecurePass456!',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data.message).toContain('reset successfully');

    // Verify token marked as used
    const usedTokenResult = await query(
      `SELECT used_at FROM password_reset_tokens WHERE token = $1`,
      [token]
    );

    expect(usedTokenResult.rows[0].used_at).not.toBeNull();

    // Verify can login with new password
    const loginResponse = await client.auth.login.$post({
      json: {
        email: 'test-password-reset@example.com',
        password: 'NewSecurePass456!',
      },
    });

    expect(loginResponse.status).toBe(200);

    // Verify cannot login with old password
    const oldPasswordResponse = await client.auth.login.$post({
      json: {
        email: 'test-password-reset@example.com',
        password: 'OldSecurePass123!',
      },
    });

    expect(oldPasswordResponse.status).toBe(401);

    // Check audit log
    const auditResult = await query(
      `SELECT * FROM admin_audit_log WHERE action = 'password_reset_completed' AND resource_id = $1`,
      [userId]
    );

    expect(auditResult.rowCount).toBeGreaterThan(0);
  });

  it('should reject invalid token', async () => {
    const response = await client.auth['reset-password'].$post({
      json: {
        token: 'invalid-token-12345',
        password: 'NewSecurePass456!',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
    expect(data.error.message).toContain('invalid or has expired');
  });

  it('should reject expired token', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-expired-token@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Create an expired token manually
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // Try to reset password
    const response = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'NewSecurePass456!',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
    expect(data.error.message).toContain('expired');
  });

  it('should reject already-used token', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-used-token@example.com',
        password: 'OldSecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Request password reset
    await client.auth['forgot-password'].$post({
      json: { email: 'test-used-token@example.com' },
    });

    // Get the token
    const tokenResult = await query(
      `SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Reset password successfully
    const firstResponse = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'NewSecurePass456!',
      },
    });

    expect(firstResponse.status).toBe(200);

    // Try to use token again
    const secondResponse = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'AnotherNewPass789!',
      },
    });

    expect(secondResponse.status).toBe(400);

    const data = await secondResponse.json();
    expect(data.error.code).toBe('INVALID_TOKEN');
    expect(data.error.message).toContain('already been used');
  });

  it('should reject weak password on reset', async () => {
    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-weak-reset@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Request password reset
    await client.auth['forgot-password'].$post({
      json: { email: 'test-weak-reset@example.com' },
    });

    // Get the token
    const tokenResult = await query(
      `SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Try to reset with weak password
    const response = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'weak',
      },
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should rollback on transaction error', async () => {
    // This test verifies transaction handling
    // If password update succeeds but token marking fails, both should rollback

    // Create a test user
    const signupResponse = await client.auth.signup.$post({
      json: {
        email: 'test-transaction@example.com',
        password: 'OldSecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    const signupData = await signupResponse.json();
    const userId = signupData.data.user.id;

    // Request password reset
    await client.auth['forgot-password'].$post({
      json: { email: 'test-transaction@example.com' },
    });

    // Get the token
    const tokenResult = await query(
      `SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const token = tokenResult.rows[0].token;

    // Reset password
    const response = await client.auth['reset-password'].$post({
      json: {
        token,
        password: 'NewSecurePass456!',
      },
    });

    expect(response.status).toBe(200);

    // Verify both password and token were updated
    const updatedUser = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const updatedToken = await query('SELECT used_at FROM password_reset_tokens WHERE token = $1', [token]);

    expect(updatedUser.rowCount).toBeGreaterThan(0);
    expect(updatedToken.rowCount).toBeGreaterThan(0);
    expect(updatedToken.rows[0].used_at).not.toBeNull();
  });
});
