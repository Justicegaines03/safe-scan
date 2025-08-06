// Test script to verify VirusTotal API v3 integration fix
async function testVirusTotalFix() {
  try {
    console.log('🔧 Testing VirusTotal API v3 fix...\n');
    
    // Test configuration - replace with your actual API key
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    const testUrl = 'https://google.com';
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      console.error('❌ Please set a valid API key in the script');
      return;
    }
    
    console.log('✓ API Key:', apiKey ? `Present (${apiKey.length} chars)` : 'Missing');
    console.log('✓ Test URL:', testUrl);
    console.log('');

    // Test URL encoding (React Native compatible)
    let urlId;
    try {
      // Try using btoa if available
      urlId = btoa(testUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      console.log('✓ Using btoa for base64 encoding');
    } catch (error) {
      // Fallback implementation
      const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      const bytes = new TextEncoder().encode(testUrl);
      
      while (i < bytes.length) {
        const a = bytes[i++];
        const b = i < bytes.length ? bytes[i++] : 0;
        const c = i < bytes.length ? bytes[i++] : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += base64Chars.charAt((bitmap >> 18) & 63);
        result += base64Chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < bytes.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < bytes.length ? base64Chars.charAt(bitmap & 63) : '=';
      }
      
      urlId = result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      console.log('✓ Using fallback base64 encoding');
    }
    
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
      console.log('✅ Analysis found in database');
      
      if (data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
        const stats = data.data.attributes.last_analysis_stats;
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const clean = stats.clean || 0;
        const undetected = stats.undetected || 0;
        const harmless = stats.harmless || 0;
        const timeout = stats.timeout || 0;
        
        console.log(`• Malicious: ${malicious}`);
        console.log(`• Suspicious: ${suspicious}`);
        console.log(`• Clean: ${clean}`);
        console.log(`• Undetected: ${undetected}`);
        console.log(`• Harmless: ${harmless}`);
        console.log(`• Timeout: ${timeout}`);
        console.log(`• Total: ${malicious + suspicious + clean + undetected + harmless + timeout}`);
        console.log(`• Positives: ${malicious + suspicious}`);
      }
    } else if (reportResponse.status === 404) {
      console.log('• URL not in database, testing submission...');
      
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
        console.log('✅ URL submitted successfully');
        console.log(`• Analysis ID: ${submitData.data?.id || 'N/A'}`);
      } else {
        console.error('❌ Submission failed');
        try {
          const errorText = await submitResponse.text();
          console.error('• Error details:', errorText);
        } catch (e) {
          console.error('• Could not read error response');
        }
      }
    } else if (reportResponse.status === 403) {
      console.log('❌ 403 Forbidden - API key may be invalid or lacks permissions');
    } else if (reportResponse.status === 429) {
      console.log('⏳ 429 Rate Limited - Too many requests');
    } else {
      console.log(`❌ Unexpected status: ${reportResponse.status}`);
      try {
        const errorText = await reportResponse.text();
        console.error('• Error details:', errorText);
      } catch (e) {
        console.error('• Could not read error response');
      }
    }

    console.log('\n🎯 Key fixes implemented:');
    console.log('• Fixed base64 encoding for React Native compatibility');
    console.log('• Added proper error handling for 400 status codes');
    console.log('• Added debug logging for URL encoding');
    console.log('• Improved error message details');

    console.log('\n✅ VirusTotal fix test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testVirusTotalFix();
