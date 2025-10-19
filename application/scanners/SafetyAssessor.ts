/**
 * Safety Assessor
 * Application Layer - Business Logic
 *
 * Platform-agnostic safety assessment logic
 * Combines VirusTotal and Community data to calculate safety
 */

import { VirusTotalResult } from '../interfaces/IVirusTotalAPI';
import { CommunityRating } from '../interfaces/ICommunityService';

export interface SafetyAssessment {
  virusTotal?: VirusTotalResult;
  community?: CommunityRating;
  safety: 'safe' | 'unsafe' | 'unknown';
  confidence: number;
  warning?: string;
}

export class SafetyAssessor {
  /**
   * Calculate comprehensive safety assessment
   * Combines VirusTotal and Community data using weighted algorithm
   *
   * @param virusTotalResult - Optional VirusTotal scan results
   * @param communityRating - Optional community rating data
   * @param skipVirusTotal - Whether VirusTotal was skipped (non-HTTP URLs)
   * @returns Safety assessment with confidence score
   */
  calculateSafety(
    virusTotalResult?: VirusTotalResult | null,
    communityRating?: CommunityRating | null,
    skipVirusTotal: boolean = false
  ): SafetyAssessment {
    let isSafe = false;
    let confidence = 0.5;
    let warning: string | undefined;

    console.log('Safety Assessment Calculation:');
    console.log('- Skipped VirusTotal:', skipVirusTotal);
    console.log('- VirusTotal available:', !!virusTotalResult);
    console.log('- Community data available:', !!communityRating);

    if (virusTotalResult) {
      console.log('- VirusTotal positives:', virusTotalResult.positives);
      console.log('- VirusTotal total:', virusTotalResult.total);
      console.log('- VirusTotal secure:', virusTotalResult.isSecure);
    }

    if (communityRating) {
      console.log('- Community safe votes:', communityRating.safeVotes);
      console.log('- Community total votes:', communityRating.totalVotes);
      console.log('- Community confidence:', communityRating.communityConfidence);
    }

    // Handle different data availability scenarios
    if (!virusTotalResult && !communityRating) {
      // No data from either source
      if (skipVirusTotal) {
        warning = 'Non-web content detected - no security data available';
      } else {
        warning = 'No security data available from VirusTotal or community - status unknown';
      }
      confidence = 0;
      isSafe = false;
    } else if (!virusTotalResult && communityRating) {
      // Only community data available
      if (skipVirusTotal) {
        warning = 'Non-web content - relying on community assessment only';
      } else {
        warning = 'VirusTotal scan unavailable - relying on community data only';
      }
      confidence = communityRating.communityConfidence * 0.6; // Reduced confidence without VirusTotal
      isSafe = confidence > 0.7;
    } else if (virusTotalResult && !communityRating) {
      // Only VirusTotal data available
      if (virusTotalResult.positives === -1) {
        // VirusTotal scan is pending/unknown
        warning = 'VirusTotal scan in progress - status unknown';
        confidence = 0;
        isSafe = false;
      } else {
        // VirusTotal scan completed successfully
        warning = 'No community votes available';
        isSafe = virusTotalResult.isSecure;
        // Calculate confidence based on detection ratio
        const detectionRatio = virusTotalResult.total > 0 ? virusTotalResult.positives / virusTotalResult.total : 0;
        if (virusTotalResult.isSecure) {
          confidence = Math.max(0.7, 0.95 - (detectionRatio * 2)); // High confidence for clean scans
        } else {
          confidence = Math.min(0.3, detectionRatio); // Low confidence for detected threats
        }
      }
    } else if (virusTotalResult && communityRating) {
      // Both data sources available
      if (virusTotalResult.positives === -1) {
        // VirusTotal scan is pending, rely more on community
        warning = 'VirusTotal scan in progress - relying on community data';
        confidence = communityRating.communityConfidence * 0.8;
        isSafe = confidence > 0.7;
      } else {
        // Both sources have valid data
        let vtConfidence = 0.5;
        isSafe = virusTotalResult.isSecure;
        // Calculate confidence based on detection ratio
        const detectionRatio = virusTotalResult.total > 0 ? virusTotalResult.positives / virusTotalResult.total : 0;
        if (virusTotalResult.isSecure) {
          vtConfidence = Math.max(0.7, 0.95 - (detectionRatio * 2)); // High confidence for clean scans
        } else {
          vtConfidence = Math.min(0.3, detectionRatio); // Low confidence for detected threats
        }
        confidence = vtConfidence;

        // Only modify VirusTotal result if there's significant community data
        if (communityRating.totalVotes >= 3) {
          const communityConfidence = communityRating.communityConfidence;
          // Combine when there's actual community input (≥3 votes)
          const vtWeight = 0.75;
          const communityWeight = 0.25;
          confidence = (confidence * vtWeight) + (communityConfidence * communityWeight);
          isSafe = confidence > 0.85;
          // If community strongly disagrees with VirusTotal, add warning
          if (Math.abs(confidence - communityConfidence) > 0.4) {
            warning = 'Community opinion differs from VirusTotal scan - use caution';
          }
        }
      }
    }

    // Add warnings based on confidence levels
    if (confidence < 0.3) {
      warning = 'High risk detected - strongly recommend avoiding this link';
    } else if (confidence < 0.6) {
      warning = warning || 'Moderate risk detected - proceed with caution';
    } else if (confidence < 0.8 && !warning) {
      warning = 'Some uncertainty in safety assessment';
    }

    // Determine final safety status
    let finalSafetyStatus: 'safe' | 'unsafe' | 'unknown';
    if (confidence === 0 || (!virusTotalResult && !communityRating)) {
      finalSafetyStatus = 'unknown';
    } else {
      finalSafetyStatus = isSafe ? 'safe' : 'unsafe';
    }

    console.log(`Final Safety Assessment: ${finalSafetyStatus.toUpperCase()}`);

    return {
      virusTotal: virusTotalResult || undefined,
      community: communityRating || undefined,
      safety: finalSafetyStatus,
      confidence,
      warning
    };
  }

  /**
   * Calculate app security assessment based on VirusTotal and community data
   * Simplified version for quick status checks
   */
  calculateQuickSafety(
    virusTotalResult?: VirusTotalResult,
    communityRating?: CommunityRating
  ): 'safe' | 'unsafe' | 'unknown' {
    // Handle different data availability scenarios
    if (!virusTotalResult && !communityRating) {
      return 'unknown';
    } else if (!virusTotalResult && communityRating) {
      const confidence = communityRating.communityConfidence || 0;
      return confidence > 0.7 ? 'safe' : (confidence < 0.3 ? 'unsafe' : 'unknown');
    } else if (virusTotalResult && !communityRating) {
      if (virusTotalResult.positives === -1) {
        return 'unknown';
      } else {
        return virusTotalResult.isSecure ? 'safe' : 'unsafe';
      }
    } else if (virusTotalResult && communityRating) {
      if (virusTotalResult.positives === -1) {
        const confidence = communityRating.communityConfidence || 0;
        return confidence > 0.7 ? 'safe' : (confidence < 0.3 ? 'unsafe' : 'unknown');
      } else {
        let isSafe = virusTotalResult.isSecure;

        // Only modify VirusTotal result if there's significant community data
        if (communityRating.safeVotes + (communityRating.totalVotes - communityRating.safeVotes) >= 3) {
          const communityConfidence = communityRating.communityConfidence || 0;
          const vtConfidence = virusTotalResult.isSecure ? 0.9 : 0.1;

          // Combine when there's actual community input (≥3 votes)
          const vtWeight = 0.75;
          const communityWeight = 0.25;
          const combinedConfidence = (vtConfidence * vtWeight) + (communityConfidence * communityWeight);
          isSafe = combinedConfidence > 0.85;
        }

        return isSafe ? 'safe' : 'unsafe';
      }
    }

    return 'unknown';
  }
}
