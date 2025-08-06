// Debug VirusTotal API v3 response structure
async function debugVirusTotalV3Response() {
  try {
    console.log('🔍 Debugging VirusTotal API v3 response structure...\n');
    
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    const testUrl = 'https://google.com';
    const urlId = Buffer.from(testUrl).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
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
      const data = await reportResponse.json();
      console.log('📊 Full Response Structure:');
      console.log(JSON.stringify(data, null, 2));
      
      console.log('\n📈 Analysis Stats Structure:');
      if (data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
        const stats = data.data.attributes.last_analysis_stats;
        console.log(JSON.stringify(stats, null, 2));
      }
    } else {
      console.log(`❌ Request failed: ${reportResponse.status} ${reportResponse.statusText}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugVirusTotalV3Response();
