/**
 * Community Voting
 * Application Layer - Business Logic
 *
 * Platform-agnostic community voting logic
 * Handles vote submission, retraction, and rating updates
 */

import { ICommunityService, Vote, VoteResult } from '../interfaces/ICommunityService';
import { IUserIdentityService } from '../interfaces/IUserIdentityService';
import { URLValidator } from '../scanners/URLValidator';

export class CommunityVoting {
  private urlValidator: URLValidator;

  constructor(
    private communityService: ICommunityService,
    private userIdentityService: IUserIdentityService
  ) {
    this.urlValidator = new URLValidator();
  }

  /**
   * Submit a community vote for a QR code
   * @param url - The URL from the QR code
   * @param rating - User's safety rating
   * @returns Promise with vote result including updated community rating
   */
  async submitVote(url: string, rating: 'safe' | 'unsafe'): Promise<VoteResult> {
    try {
      // Get user ID
      const userId = await this.userIdentityService.getUserId();

      // Create QR hash for the community database
      const qrHash = await this.urlValidator.hashUrl(url);

      console.log('=== VOTE SUBMISSION DEBUG ===');
      console.log('URL:', url);
      console.log('Rating:', rating);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('============================');

      const vote: Vote = {
        userId: userId,
        qrHash: qrHash,
        vote: rating,
        timestamp: Date.now()
      };

      console.log('Submitting community vote:', vote);
      const result = await this.communityService.submitVote(vote);

      if (result.success && result.data) {
        console.log('Community vote submitted successfully!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to submit community vote:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error submitting community vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Retract a previously submitted vote
   * @param url - The URL from the QR code
   * @returns Promise with vote result including updated community rating
   */
  async retractVote(url: string): Promise<VoteResult> {
    try {
      // Get user ID
      const userId = await this.userIdentityService.getUserId();

      // Create QR hash for the community database
      const qrHash = await this.urlValidator.hashUrl(url);

      console.log('=== VOTE RETRACTION DEBUG ===');
      console.log('URL:', url);
      console.log('User ID:', userId);
      console.log('QR Hash:', qrHash);
      console.log('=============================');

      console.log('Retracting community vote');
      const result = await this.communityService.retractVote(userId, qrHash);

      if (result.success && result.data) {
        console.log('Community vote retracted successfully!');
        console.log('Updated community rating:', result.data);
        console.log(`Safe votes: ${result.data.safeVotes}, Total: ${result.data.totalVotes}`);
      } else {
        console.log('Failed to retract community vote:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error retracting community vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get current community rating for a URL
   * @param url - The URL from the QR code
   * @returns Promise with community rating or null
   */
  async getCommunityRating(url: string) {
    try {
      const qrHash = await this.urlValidator.hashUrl(url);
      const rating = await this.communityService.getCommunityRating(qrHash);

      if (!rating) {
        console.log('No community rating found for this URL.');
        return null;
      }

      return rating;
    } catch (error) {
      console.error('Error getting community rating:', error);
      return null;
    }
  }
}
