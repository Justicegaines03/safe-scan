import axios from 'axios';

const VIRUSTOTAL_API_BASE = 'https://www.virustotal.com/vtapi/v2';
const VIRUSTOTAL_API_KEY = '1c705c95f2e7749aee927ec35e95a1c20b0e41351ba6981da083951e7c80466f';

export interface VirusTotalResult {
  isSecure: boolean;
  positives: number;
  total: number;
  scanDate?: string;
  permalink?: string;
  message?: string;
}

export class VirusTotalService {
  private static async scanUrl(url: string): Promise<VirusTotalResult> {
    try {
      // Submit URL for scanning
      const submitResponse = await axios.post(
        `${VIRUSTOTAL_API_BASE}/url/scan`,
        new URLSearchParams({
          apikey: VIRUSTOTAL_API_KEY,
          url: url,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (submitResponse.data.response_code === 1) {
        // Wait a moment for the scan to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the scan report
        const reportResponse = await axios.get(
          `${VIRUSTOTAL_API_BASE}/url/report`,
          {
            params: {
              apikey: VIRUSTOTAL_API_KEY,
              resource: url,
            },
          }
        );

        const data = reportResponse.data;
        
        if (data.response_code === 1) {
          return {
            isSecure: data.positives === 0,
            positives: data.positives || 0,
            total: data.total || 0,
            scanDate: data.scan_date,
            permalink: data.permalink,
            message: data.positives > 0 
              ? `⚠️ WARNING: ${data.positives}/${data.total} security vendors flagged this URL as malicious!`
              : `✅ SAFE: No security threats detected by ${data.total} vendors.`
          };
        } else if (data.response_code === 0) {
          // URL not found in database, submit for scanning
          return {
            isSecure: true, // Assume safe if not in database
            positives: 0,
            total: 0,
            message: "⏳ URL not found in VirusTotal database. Proceeding with caution..."
          };
        }
      }
      
      return {
        isSecure: false,
        positives: 0,
        total: 0,
        message: "❌ Unable to scan URL. Please verify manually."
      };
    } catch (error) {
      console.error('VirusTotal API error:', error);
      return {
        isSecure: false,
        positives: 0,
        total: 0,
        message: "❌ Error connecting to VirusTotal. Please check your internet connection."
      };
    }
  }

  public static async validateQRCode(qrData: string): Promise<VirusTotalResult> {
    // Check if QR code contains a URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = qrData.match(urlRegex);
    
    if (urls && urls.length > 0) {
      // Scan the first URL found
      return await this.scanUrl(urls[0]);
    } else {
      // QR code doesn't contain a URL - assume it's safe (could be text, WiFi, etc.)
      return {
        isSecure: true,
        positives: 0,
        total: 0,
        message: "✅ QR code contains non-URL data (text, WiFi, etc.). No security scan needed."
      };
    }
  }
}
