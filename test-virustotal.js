// Test VirusTotal API integration
const testVirusTotalAPI = async () => {
  try {
    // Mock the environment variable for testing
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    const testUrl = 'https://google.com';

    console.log('Testing VirusTotal API integration...');
    console.log('API Key:', apiKey ? 'Present' : 'Missing');
    console.log('Test URL:', testUrl);

    // Create FormData for URL submission
    const { FormData } = await import('formdata-polyfill/esm');
    const formData = new FormData();
    formData.append('url', testUrl);

    console.log('\n1. Submitting URL for scanning...');
    
    // Submit URL for scanning
    const submitResponse = await fetch('https://www.virustotal.com/vtapi/v2/url/scan', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
      },
      body: formData,
    });

    if (!submitResponse.ok) {
      console.warn(`VirusTotal submission failed: ${submitResponse.status}`);
      return null;
    }

    const submitData = await submitResponse.json();
    console.log('Submission response:', submitData);

    // Check for API errors in response
    if (submitData.response_code === 0) {
      console.warn('VirusTotal API error: Invalid request');
      return null;
    }

    console.log('\n2. Waiting 2 seconds for scan to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n3. Getting scan report...');
    
    // Get scan report
    const reportResponse = await fetch(
      `https://www.virustotal.com/vtapi/v2/url/report?apikey=${apiKey}&resource=${encodeURIComponent(testUrl)}&scan=1`,
      {
        method: 'GET',
      }
    );

    if (!reportResponse.ok) {
      console.warn(`VirusTotal report failed: ${reportResponse.status}`);
      return null;
    }

    const reportData = await reportResponse.json();
    console.log('Report data:', reportData);

    // Handle case where scan is still in progress
    if (reportData.response_code === -2) {
      console.log('✅ Scan in progress - returning pending status');
      return {
        isSecure: false, // Conservative approach
        positives: -1, // Use -1 to indicate unknown/pending
        total: 0,
        scanId: submitData.scan_id || `pending-${Date.now()}`,
        permalink: submitData.permalink || `https://www.virustotal.com/gui/url/${btoa(testUrl)}/detection`
      };
    }

    // Handle case where URL was not found in VirusTotal database
    if (reportData.response_code === 0) {
      console.warn('URL not found in VirusTotal database');
      return null;
    }

    // Parse the result
    const positives = reportData.positives || 0;
    const total = reportData.total || 70;
    const isSecure = positives === 0 || (positives / total) < 0.1;

    const result = {
      isSecure,
      positives,
      total,
      scanId: reportData.scan_id || submitData.scan_id || 'test',
      permalink: reportData.permalink || submitData.permalink || `https://www.virustotal.com/gui/url/${btoa(testUrl)}/detection`
    };

    console.log('\n✅ Final result:');
    console.log(JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('❌ VirusTotal API test failed:', error);
    return null;
  }
};

// Only run if this file is executed directly
if (require.main === module) {
  testVirusTotalAPI();
}

module.exports = { testVirusTotalAPI };
