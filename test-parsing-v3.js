// Test VirusTotal API v3 parsing logic
async function testVirusTotalV3Parsing() {
  try {
    console.log('🔍 Testing VirusTotal API v3 parsing logic...\n');
    
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    const testUrl = 'https://google.com';
    const urlId = Buffer.from(testUrl).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    console.log('✓ Test URL:', testUrl);
    console.log('✓ URL ID:', urlId);
    console.log('');

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

    if (reportResponse.ok) {
      const reportData = await reportResponse.json();
      
      console.log('📊 Parsing v3 API response...');
      
      if (reportData.data && reportData.data.attributes) {
        const stats = reportData.data.attributes.last_analysis_stats;
        
        console.log('Raw stats:', JSON.stringify(stats, null, 2));
        
        const positives = stats.malicious + stats.suspicious;
        const total = stats.malicious + stats.suspicious + (stats.clean || 0) + stats.undetected + stats.harmless + stats.timeout;
        const isSecure = positives === 0 || (positives / total) < 0.1;

        console.log('\n📈 Calculated results:');
        console.log(`• Malicious: ${stats.malicious}`);
        console.log(`• Suspicious: ${stats.suspicious}`);
        console.log(`• Clean: ${stats.clean || 0}`);
        console.log(`• Undetected: ${stats.undetected}`);
        console.log(`• Harmless: ${stats.harmless}`);
        console.log(`• Timeout: ${stats.timeout}`);
        console.log(`• Positives (malicious + suspicious): ${positives}`);
        console.log(`• Total: ${total}`);
        console.log(`• Detection rate: ${((positives / total) * 100).toFixed(1)}%`);
        console.log(`• Is Secure: ${isSecure}`);
        
        const result = {
          isSecure,
          positives,
          total,
          scanId: reportData.data.id || `report-${Date.now()}`,
          permalink: `https://www.virustotal.com/gui/url/${reportData.data.id}/detection`
        };
        
        console.log('\n🎯 Final result object:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n✅ Parsing test completed successfully!');
        console.log('\n📋 Summary:');
        console.log('• Fixed 403 error by upgrading to v3 API');
        console.log('• Uses x-apikey header instead of apikey parameter');
        console.log('• Includes all stats fields (harmless, timeout)');
        console.log('• Proper error handling for different response codes');
        console.log('• URL encoding compatible with v3 API requirements');
        
      } else {
        console.log('❌ Unable to parse response structure');
      }
    } else {
      console.log(`❌ Request failed: ${reportResponse.status} ${reportResponse.statusText}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVirusTotalV3Parsing();
