/**
 * VirusTotal API Service
 * Infrastructure Layer - External API Integration
 *
 * Implements IVirusTotalAPI interface
 * Handles all VirusTotal API v3 calls
 */

import Constants from 'expo-constants';
import { IVirusTotalAPI, VirusTotalResult } from '@/application/interfaces/IVirusTotalAPI';
import { URLValidator } from '@/application/scanners/URLValidator';

export class VirusTotalAPI implements IVirusTotalAPI {
  private urlValidator: URLValidator;

  constructor() {
    this.urlValidator = new URLValidator();
  }

  /**
   * Validate a URL using VirusTotal API v3
   * @param url - The URL to validate
   * @returns Promise with scan results or null if unavailable
   */
  async validateURL(url: string): Promise<VirusTotalResult | null> {
    const apiKey = Constants.expoConfig?.extra?.VIRUSTOTAL_API_KEY;

    // Check if API key is available
    if (!apiKey) {
      console.error('VirusTotal API key not configured');
      return null;
    }

    console.log('VirusTotal API key configured');

    // Create URL ID for VirusTotal API v3
    const urlId = this.urlValidator.createUrlId(url);
    console.log('VirusTotal URL ID:', urlId, 'for URL:', url);

    try {
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

      if (!reportResponse.ok) {
        if (reportResponse.status === 403) {
          console.warn('VirusTotal API: Access forbidden. Check API key permissions.');
        } else if (reportResponse.status === 429) {
          console.warn('VirusTotal API: Rate limit exceeded.');
        } else {
          console.warn(`VirusTotal report failed: ${reportResponse.status}`);
        }
        return null;
      }

      const reportData = await reportResponse.json();
      console.log('VirusTotal response:', reportData);

      // Extract scan results from the response
      const attributes = reportData.data?.attributes;
      if (!attributes) {
        console.warn('No attributes found in VirusTotal response');
        return null;
      }

      const stats = attributes.last_analysis_stats;
      if (!stats) {
        console.warn('No analysis stats found in VirusTotal response');
        return null;
      }

      // Calculate positives and total
      const positives = stats.malicious + stats.suspicious;
      const total = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;
      const isSecure = positives / total < 0.02;

      console.log(`VirusTotal Results - Positives: ${positives}, Total: ${total}, Secure: ${isSecure}`);

      return {
        positives: positives,
        total: total,
        isSecure: isSecure,
        scanId: reportData.data?.id || '',
        permalink: `https://www.virustotal.com/gui/url/${urlId}` || ''
      };
    } catch (error) {
      console.error('VirusTotal API error:', error);
      return null;
    }
  }
}
