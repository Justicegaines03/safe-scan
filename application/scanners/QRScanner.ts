/**
 * QR Scanner
 * Application Layer - Business Logic
 *
 * Main orchestrator for QR code scanning
 * Platform-agnostic, coordinates all scanning operations
 */

import { IVirusTotalAPI, VirusTotalResult } from '../interfaces/IVirusTotalAPI';
import { ICommunityService, CommunityRating } from '../interfaces/ICommunityService';
import { IScanHistoryService, ScanData } from '../interfaces/IScanHistoryService';
import { URLValidator } from './URLValidator';
import { SafetyAssessor, SafetyAssessment } from './SafetyAssessor';
import { CommunityVoting } from '../voting/CommunityVoting';
import { IUserIdentityService } from '../interfaces/IUserIdentityService';

export interface ValidationResult {
  url: string;
  virusTotal?: VirusTotalResult;
  community?: CommunityRating;
  safety: SafetyAssessment;
  isHttpUrl: boolean;
}

export class QRScanner {
  private urlValidator: URLValidator;
  private safetyAssessor: SafetyAssessor;
  private communityVoting: CommunityVoting;

  constructor(
    private virusTotalAPI: IVirusTotalAPI,
    private communityService: ICommunityService,
    private scanHistoryService: IScanHistoryService,
    private userIdentityService: IUserIdentityService
  ) {
    this.urlValidator = new URLValidator();
    this.safetyAssessor = new SafetyAssessor();
    this.communityVoting = new CommunityVoting(communityService, userIdentityService);
  }

  /**
   * Validate a scanned QR code
   * Orchestrates VirusTotal scan, community rating, and safety assessment
   *
   * @param qrData - Raw data from QR code
   * @returns Promise with complete validation result
   */
  async validateQRCode(qrData: string): Promise<ValidationResult> {
    console.log('QR Code scanned:', qrData);

    // Validate if it's HTTP/HTTPS URL
    const validatedUrl = this.urlValidator.validateHTTP(qrData);
    const isHttpUrl = !!validatedUrl;
    const urlForProcessing = validatedUrl || qrData; // Use original data if not HTTP/HTTPS

    console.log('Valid HTTP/HTTPS URL:', isHttpUrl);
    console.log('Processing with URL:', urlForProcessing);

    // Run VirusTotal and Community checks in parallel
    const [virusTotalResult, communityRating] = await Promise.all([
      isHttpUrl ? this.virusTotalAPI.validateURL(urlForProcessing) : Promise.resolve(null),
      this.communityVoting.getCommunityRating(urlForProcessing)
    ]);

    // Calculate safety assessment
    const safetyAssessment = this.safetyAssessor.calculateSafety(
      virusTotalResult,
      communityRating,
      !isHttpUrl // skipVirusTotal flag
    );

    return {
      url: urlForProcessing,
      virusTotal: virusTotalResult || undefined,
      community: communityRating || undefined,
      safety: safetyAssessment,
      isHttpUrl
    };
  }

  /**
   * Save a scan to history
   * @param validationResult - The validation result to save
   * @param scanStartTime - When the scan started (for duration calculation)
   * @param userRating - Optional user rating override
   */
  async saveScanToHistory(
    validationResult: ValidationResult,
    scanStartTime: number,
    userRating?: 'safe' | 'unsafe'
  ): Promise<void> {
    try {
      // Check for duplicates before saving
      const isDuplicate = await this.scanHistoryService.isDuplicate(validationResult.url);

      if (isDuplicate) {
        console.log('Duplicate entry detected, skipping save:', validationResult.url);
        return;
      }

      const scanEndTime = Date.now();
      const scanDuration = scanEndTime - scanStartTime;

      // Determine final safety status (user rating overrides system assessment)
      const finalSafetyStatus = userRating || validationResult.safety.safety;

      const scanData: ScanData = {
        id: this.generateScanId(),
        timestamp: scanEndTime,
        qrData: validationResult.url,
        url: validationResult.url,
        safetyStatus: finalSafetyStatus,
        virusTotalResult: validationResult.virusTotal,
        communityRating: validationResult.community,
        userRating: userRating,
        scanDuration: scanDuration
      };

      await this.scanHistoryService.saveScan(scanData);
      console.log('Saved to History - Safety:', scanData.safetyStatus, 'User Rating:', scanData.userRating);
    } catch (error) {
      console.error('Error saving scan to history:', error);
      throw error;
    }
  }

  /**
   * Check if a QR code has already been scanned
   * @param qrData - The QR code data to check
   * @returns Promise with boolean indicating if duplicate exists
   */
  async isDuplicate(qrData: string): Promise<boolean> {
    try {
      const validatedUrl = this.urlValidator.validateHTTP(qrData);
      const urlForProcessing = validatedUrl || qrData;
      return await this.scanHistoryService.isDuplicate(urlForProcessing);
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return false;
    }
  }

  /**
   * Generate unique scan ID
   * @private
   */
  private generateScanId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
