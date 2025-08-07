// Test script to verify URL canonicalization fix for VirusTotal
async function testUrlCanonicalization() {
  try {
    console.log('🔧 Testing URL canonicalization fix for VirusTotal...\n');
    
    // Test configuration
    const apiKey = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      console.error('❌ Please set a valid API key in the script');
      return;
    }
    
    // Test various URL formats that might cause canonicalization issues
    const testUrls = [
      'https://google.com',           // Normal URL
      'http://example.com',           // HTTP (should work)
      'google.com',                   // Missing protocol
      '  https://google.com  ',       // With whitespace
      'https://www.google.com/',      // With trailing slash
      'https://google.com/search?q=test', // With query parameters
      'HTTPS://GOOGLE.COM',           // Uppercase
      'https://sub.domain.com/path',  // With subdomain and path
      'https://192.168.1.1',          // IP address
      'ftp://example.com',            // Non-HTTP protocol (should fail)
      'not-a-url',                    // Invalid URL
      '',                             // Empty string
      'https://example.com with spaces', // URL with spaces (should fail)
    ];
    
    console.log('🧪 Testing URL validation and processing...\n');
    
    for (const testUrl of testUrls) {
      console.log(`Testing: "${testUrl}"`);
      
      // Step 1: URL Processing (similar to validateUrl function)
      let processedUrl = testUrl.trim();
      processedUrl = processedUrl.replace(/[\s\n\r\t]/g, '');
      
      // Check if URL already has a protocol (including non-HTTP protocols)
      const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(processedUrl);
      
      if (!hasProtocol) {
        processedUrl = 'https://' + processedUrl;
      } else if (!processedUrl.match(/^https?:\/\//i)) {
        console.log(`  ❌ Non-HTTP protocol detected: ${processedUrl}`);
        continue;
      }
      
      // Step 2: URL Validation
      let isValid = false;
      let canonicalUrl = '';
      
      try {
        const urlObj = new URL(processedUrl);
        
        // Only allow HTTP/HTTPS protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          console.log(`  ❌ Unsupported protocol: ${urlObj.protocol}`);
          continue;
        }
        
        canonicalUrl = urlObj.toString();
        isValid = true;
        console.log(`  ✓ Valid: "${canonicalUrl}"`);
      } catch (urlError) {
        console.log(`  ❌ Invalid: ${urlError.message}`);
        continue;
      }
      
      // Step 3: Test VirusTotal submission (only for valid URLs)
      if (isValid && canonicalUrl) {
        try {
          console.log(`  📤 Testing submission to VirusTotal...`);
          
          const submitResponse = await fetch('https://www.virustotal.com/api/v3/urls', {
            method: 'POST',
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `url=${encodeURIComponent(canonicalUrl)}`,
          });
          
          if (submitResponse.ok) {
            console.log(`  ✅ Submission successful: ${submitResponse.status}`);
          } else {
            console.log(`  ⚠️  Submission failed: ${submitResponse.status}`);
            
            try {
              const errorText = await submitResponse.text();
              const errorData = JSON.parse(errorText);
              if (errorData.error && errorData.error.code === 'InvalidArgumentError') {
                console.log(`  🚫 Canonicalization error: ${errorData.error.message}`);
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        } catch (submitError) {
          console.log(`  ❌ Network error: ${submitError.message}`);
        }
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('🎯 URL Processing Rules:');
    console.log('• Remove all whitespace characters (spaces, tabs, newlines)');
    console.log('• Detect existing protocols using comprehensive regex');
    console.log('• Add https:// prefix only if no protocol exists');
    console.log('• Reject non-HTTP/HTTPS protocols before URL construction');
    console.log('• Validate using URL constructor');
    console.log('• Double-check protocol after URL parsing');
    console.log('• Rebuild URL to ensure proper formatting');
    console.log('• Only submit canonicalized URLs to VirusTotal');

    console.log('\n✅ URL canonicalization test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testUrlCanonicalization();
