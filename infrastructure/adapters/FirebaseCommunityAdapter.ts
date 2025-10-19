/**
 * Firebase Community Adapter
 * Infrastructure Layer - Firebase Integration
 *
 * Implements ICommunityService interface
 * Adapts Firebase Firestore to Application layer interface
 */

import {
  ICommunityService,
  CommunityRating,
  Vote,
  VoteResult
} from '@/application/interfaces/ICommunityService';
import { firebaseCommunityService } from '../FirebaseCommunityService';

export class FirebaseCommunityAdapter implements ICommunityService {
  /**
   * Get community rating for a QR code
   * @param qrHash - Hash of the QR code URL
   * @returns Promise with community rating or null if unavailable
   */
  async getCommunityRating(qrHash: string): Promise<CommunityRating | null> {
    try {
      const rating = await firebaseCommunityService.getCommunityRating(qrHash);

      if (!rating) {
        return null;
      }

      const communityConfidence = rating.totalVotes > 0
        ? rating.safeVotes / rating.totalVotes
        : 0;

      return {
        safeVotes: rating.safeVotes,
        totalVotes: rating.totalVotes,
        communityConfidence: communityConfidence
      };
    } catch (error) {
      console.error('Error getting community rating from Firebase:', error);
      return null;
    }
  }

  /**
   * Submit a community vote
   * @param vote - The vote to submit
   * @returns Promise with updated community rating
   */
  async submitVote(vote: Vote): Promise<VoteResult> {
    try {
      const result = await firebaseCommunityService.submitVote(vote);

      if (result.success && result.data) {
        const communityConfidence = result.data.totalVotes > 0
          ? result.data.safeVotes / result.data.totalVotes
          : 0;

        return {
          success: true,
          data: {
            safeVotes: result.data.safeVotes,
            totalVotes: result.data.totalVotes,
            communityConfidence: communityConfidence
          },
          timestamp: result.timestamp
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to submit vote',
        timestamp: result.timestamp
      };
    } catch (error) {
      console.error('Error submitting vote to Firebase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Retract a previously submitted vote
   * @param userId - ID of the user retracting the vote
   * @param qrHash - Hash of the QR code URL
   * @returns Promise with updated community rating
   */
  async retractVote(userId: string, qrHash: string): Promise<VoteResult> {
    try {
      const result = await firebaseCommunityService.retractVote(userId, qrHash);

      if (result.success && result.data) {
        const communityConfidence = result.data.totalVotes > 0
          ? result.data.safeVotes / result.data.totalVotes
          : 0;

        return {
          success: true,
          data: {
            safeVotes: result.data.safeVotes,
            totalVotes: result.data.totalVotes,
            communityConfidence: communityConfidence
          },
          timestamp: result.timestamp
        };
      }

      return {
        success: false,
        error: result.error || 'Failed to retract vote',
        timestamp: result.timestamp
      };
    } catch (error) {
      console.error('Error retracting vote from Firebase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }
}
