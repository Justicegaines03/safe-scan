/**
 * Interface for Community Rating service
 * Part of Infrastructure Layer - defines contract for community voting
 */

export interface CommunityRating {
  safeVotes: number;
  totalVotes: number;
  communityConfidence: number;
}

export interface Vote {
  userId: string;
  qrHash: string;
  vote: 'safe' | 'unsafe';
  timestamp: number;
}

export interface VoteResult {
  success: boolean;
  data?: CommunityRating;
  error?: string;
  timestamp: number;
}

export interface ICommunityService {
  /**
   * Get community rating for a QR code
   * @param qrHash - Hash of the QR code URL
   * @returns Promise with community rating or null if unavailable
   */
  getCommunityRating(qrHash: string): Promise<CommunityRating | null>;

  /**
   * Submit a community vote
   * @param vote - The vote to submit
   * @returns Promise with updated community rating
   */
  submitVote(vote: Vote): Promise<VoteResult>;

  /**
   * Retract a previously submitted vote
   * @param userId - ID of the user retracting the vote
   * @param qrHash - Hash of the QR code URL
   * @returns Promise with updated community rating
   */
  retractVote(userId: string, qrHash: string): Promise<VoteResult>;
}
