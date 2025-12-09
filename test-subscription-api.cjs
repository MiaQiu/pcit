const fetch = require('node-fetch');

async function testSubscriptionAPI() {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      console.log('Login failed:', loginData);
      return;
    }

    console.log('Login successful');
    console.log('Access token:', loginData.accessToken.substring(0, 20) + '...');

    // Get user profile
    const meResponse = await fetch('http://localhost:3001/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${loginData.accessToken}`
      }
    });

    const meData = await meResponse.json();

    if (!meResponse.ok) {
      console.log('Get user failed:', meData);
      return;
    }

    console.log('\nUser profile:');
    console.log(JSON.stringify(meData.user, null, 2));

    console.log('\nSubscription fields:');
    console.log('- subscriptionPlan:', meData.user.subscriptionPlan);
    console.log('- subscriptionStatus:', meData.user.subscriptionStatus);
    console.log('- trialStartDate:', meData.user.trialStartDate);
    console.log('- trialEndDate:', meData.user.trialEndDate);
    console.log('- Type of trialEndDate:', typeof meData.user.trialEndDate);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSubscriptionAPI();
