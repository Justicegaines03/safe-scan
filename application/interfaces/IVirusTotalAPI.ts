/**
 * Interface for VirusTotal API service
 * Part of Infrastructure Layer - defines contract for URL scanning
 */

export interface VirusTotalResult {
  positives: number;
  total: number;
  isSecure: boolean;
  scanId: string;
  permalink: string;
}

export interface IVirusTotalAPI {
  /**
   * Validate a URL using VirusTotal API
   * @param url - The URL to validate
   * @returns Promise with scan results or null if unavailable
   */
  validateURL(url: string): Promise<VirusTotalResult | null>;
}
