/**
 * Interface for Scan History service
 * Part of Infrastructure Layer - defines contract for scan history storage
 */

export interface ScanData {
  id: string;
  timestamp: number;
  qrData: string;
  url: string;
  safetyStatus: 'safe' | 'unsafe' | 'unknown';
  virusTotalResult?: any;
  communityRating?: any;
  userRating?: 'safe' | 'unsafe';
  scanDuration?: number;
}

export interface IScanHistoryService {
  /**
   * Save a scan to history
   * @param scan - The scan data to save
   * @returns Promise that resolves when save is complete
   */
  saveScan(scan: ScanData): Promise<void>;

  /**
   * Get all scans from history
   * @returns Promise with array of scan data
   */
  getScanHistory(): Promise<ScanData[]>;

  /**
   * Check if a QR code already exists in history
   * @param qrData - The QR code data to check
   * @returns Promise with boolean indicating if duplicate exists
   */
  isDuplicate(qrData: string): Promise<boolean>;
}
