/**
 * Manual test script for signup endpoint
 *
 * Run with: node test-signup.js
 */

const API_URL = 'http://localhost:3001';

async function testSignup() {
  console.log('🧪 Testing Signup Endpoint\n');
  console.log('='.repeat(60));

  // Test 1: Valid signup
  console.log('\n✅ Test 1: Valid signup with all fields');
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        companyName: 'Test Company',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 201) {
      console.log('✅ PASSED: User created successfully');
    } else {
      console.log('❌ FAILED: Expected 201, got', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 2: Duplicate email
  console.log('\n❌ Test 2: Duplicate email should fail');
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'DifferentPass123!',
        firstName: 'Another',
        lastName: 'User',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 409) {
      console.log('✅ PASSED: Duplicate email rejected');
    } else {
      console.log('❌ FAILED: Expected 409, got', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 3: Weak password
  console.log('\n❌ Test 3: Weak password should fail');
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'weak@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ PASSED: Weak password rejected');
    } else {
      console.log('❌ FAILED: Expected 400, got', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 4: Invalid email
  console.log('\n❌ Test 4: Invalid email should fail');
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ PASSED: Invalid email rejected');
    } else {
      console.log('❌ FAILED: Expected 400, got', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 5: Missing required fields
  console.log('\n❌ Test 5: Missing required fields should fail');
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'incomplete@example.com',
        password: 'SecurePass123!',
        // Missing firstName and lastName
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ PASSED: Missing fields rejected');
    } else {
      console.log('❌ FAILED: Expected 400, got', response.status);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Tests complete!\n');
}

// Run tests
testSignup().catch(console.error);
