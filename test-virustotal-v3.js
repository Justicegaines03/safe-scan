// Test VirusTotal API v3 integration
async function testVirusTotalV3API() {
  try {
    console.log('🔍 Testing VirusTotal API v3 integration...\n');
    
    // Test configuration
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    const testUrl = 'https://google.com';
    
    console.log('✓ API Key:', apiKey ? `Present (${apiKey.length} chars)` : 'Missing');
    console.log('✓ Test URL:', testUrl);
    console.log('');

    // Test URL encoding for v3 API
    const urlId = Buffer.from(testUrl).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    console.log('✓ URL ID for v3:', urlId);
    console.log('');

    // Test API endpoint accessibility
    console.log('📡 Testing API endpoints...');
    
    // Try to get existing analysis
    const reportResponse = await fetch(
      `https://www.virustotal.com/api/v3/urls/${urlId}`,
      {
        method: 'GET',
        headers: {
          'x-apikey': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`• GET /urls/${urlId}: ${reportResponse.status} ${reportResponse.statusText}`);

    if (reportResponse.ok) {
      const data = await reportResponse.json();
      console.log('✓ Analysis found in database');
      
      if (data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
        const stats = data.data.attributes.last_analysis_stats;
        console.log(`• Malicious: ${stats.malicious}`);
        console.log(`• Suspicious: ${stats.suspicious}`);
        console.log(`• Clean: ${stats.clean}`);
        console.log(`• Undetected: ${stats.undetected}`);
        console.log(`• Total: ${stats.malicious + stats.suspicious + stats.clean + stats.undetected}`);
      }
    } else if (reportResponse.status === 404) {
      console.log('• URL not in database, would trigger submission');
      
      // Test submission endpoint
      console.log('\n📤 Testing submission endpoint...');
      const submitResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(testUrl)}`,
      });

      console.log(`• POST /urls: ${submitResponse.status} ${submitResponse.statusText}`);
      
      if (submitResponse.ok) {
        const submitData = await submitResponse.json();
        console.log('✓ URL submitted successfully');
        console.log(`• Analysis ID: ${submitData.data?.id || 'N/A'}`);
      }
    } else if (reportResponse.status === 403) {
      console.log('❌ 403 Forbidden - API key may be invalid or lacks permissions');
    } else if (reportResponse.status === 429) {
      console.log('⏳ 429 Rate Limited - Too many requests');
    }

    console.log('\n🎯 API v3 Features:');
    console.log('• Uses x-apikey header instead of apikey parameter');
    console.log('• URL encoding with base64 and URL-safe characters');
    console.log('• Detailed analysis stats in structured format');
    console.log('• Better error handling and status codes');
    console.log('• More reliable rate limiting');

    console.log('\n✅ VirusTotal v3 API test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVirusTotalV3API();
