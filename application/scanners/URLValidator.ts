/**
 * URL Validator
 * Application Layer - Business Logic
 *
 * Platform-agnostic URL validation logic
 * No dependencies on React Native or UI frameworks
 */

export class URLValidator {
  /**
   * Validate if a string is a proper HTTP/HTTPS URL
   * @param url - The URL string to validate
   * @returns The validated URL or null if not HTTP/HTTPS
   */
  validateHTTP(url: string): string | null {
    // Trim URL
    let trimmedUrl = url.trim();

    // Remove any surrounding whitespace and invalid characters
    trimmedUrl = trimmedUrl.replace(/[\s\n\r\t]/g, '');

    if (trimmedUrl.match(/^https:\/\//)) {
      console.log('HTTPS URL detected:', trimmedUrl);
      return trimmedUrl;
    } else if (trimmedUrl.match(/^http:\/\//)) {
      console.log('HTTP URL detected:', trimmedUrl);
      return trimmedUrl;
    } else {
      // If it's not HTTP/HTTPS, it's not suitable for VirusTotal
      console.warn('Non-HTTP/HTTPS protocol detected:', trimmedUrl);
      return null;
    }
  }

  /**
   * Create a simple hash of a URL for database keys
   * Platform-agnostic hashing function
   * @param url - The URL to hash
   * @returns Promise with hash string
   */
  async hashUrl(url: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create URL ID for VirusTotal API (base64 encoded without padding)
   * @param url - The URL to encode
   * @returns Base64 encoded URL ID
   */
  createUrlId(url: string): string {
    const base64Url = btoa(url).replace(/=/g, '');
    return base64Url;
  }
}
