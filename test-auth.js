/**
 * Authentication Test Script
 * Tests the authentication endpoints to verify they work correctly
 */

const API_BASE = 'http://localhost:3000/api/v1';

async function testAuth() {
  console.log('🧪 Testing Authentication Endpoints...\n');

  // Test 1: Register new user
  console.log('1. Testing user registration...');
  try {
    const testUser = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'testpassword123'
    };

    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const registerData = await registerResponse.json();
    
    if (registerResponse.ok) {
      console.log('✅ Registration successful');
      console.log('   User registered:', testUser.email);
      console.log('   Access token received:', !!registerData.accessToken);
    } else {
      console.log('❌ Registration failed:', registerData.error);
    }
  } catch (error) {
    console.log('❌ Registration error:', error.message);
  }

  console.log('\n2. Testing duplicate email registration...');
  try {
    const duplicateUser = {
      name: 'Duplicate User',
      email: `test${Date.now() - 1000}@example.com`, // Use same email as above
      password: 'testpassword123'
    };

    const duplicateResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(duplicateUser),
    });

    const duplicateData = await duplicateResponse.json();
    
    if (duplicateResponse.status === 409) {
      console.log('✅ Duplicate email correctly rejected');
      console.log('   Error message:', duplicateData.error);
      console.log('   Error code:', duplicateData.code);
    } else {
      console.log('❌ Duplicate email should be rejected');
    }
  } catch (error) {
    console.log('❌ Duplicate registration test error:', error.message);
  }

  console.log('\n3. Testing login with valid credentials...');
  try {
    const loginData = {
      email: `test${Date.now() - 1000}@example.com`,
      password: 'testpassword123'
    };

    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    const loginResult = await loginResponse.json();
    
    if (loginResponse.ok) {
      console.log('✅ Login successful');
      console.log('   Access token received:', !!loginResult.accessToken);
      console.log('   Refresh token received:', !!loginResult.refreshToken);
    } else {
      console.log('❌ Login failed:', loginResult.error);
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
  }

  console.log('\n4. Testing login with invalid credentials...');
  try {
    const invalidLoginData = {
      email: 'nonexistent@example.com',
      password: 'wrongpassword'
    };

    const invalidLoginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidLoginData),
    });

    const invalidLoginResult = await invalidLoginResponse.json();
    
    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid credentials correctly rejected');
      console.log('   Error message:', invalidLoginResult.error);
      console.log('   Error code:', invalidLoginResult.code);
    } else {
      console.log('❌ Invalid credentials should be rejected');
    }
  } catch (error) {
    console.log('❌ Invalid login test error:', error.message);
  }

  console.log('\n🎉 Authentication tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testAuth().catch(console.error);
}

module.exports = { testAuth };
