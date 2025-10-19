/**
 * Firebase Community Service
 * Handles community ratings and voting with Firestore transactions
 */

import { CommunityRating, Vote, DatabaseResponse } from './types';
import { FirestoreService } from './FirestoreService';
import { FirebaseAuthService } from './FirebaseAuthService';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

interface VoteResult {
  rating: CommunityRating;
  userVote: Vote;
  isNewVote: boolean;
  previousVote?: Vote;
}

interface CommunityStats {
  totalQRCodes: number;
  totalVotes: number;
  safePercentage: number;
  activeVoters: number;
}

const COMMUNITY_CONFIG = {
  VOTE_DECAY_DAYS: 7,
  MIN_VOTES_FOR_CONFIDENCE: 3,
  SPAM_VOTE_THRESHOLD: 10,
  RATE_LIMIT_WINDOW: 5 * 60 * 1000, // 5 minutes
  MAX_VOTES_PER_WINDOW: 3,
  CONFIDENCE_THRESHOLD: 0.7,
} as const;

export class FirebaseCommunityService {
  private static instance: FirebaseCommunityService;
  private firestoreService: FirestoreService;
  private authService: FirebaseAuthService;
  private activeSubscriptions = new Map<string, () => void>();
  private rateLimit = new Map<string, number[]>();

  static getInstance(): FirebaseCommunityService {
    if (!FirebaseCommunityService.instance) {
      FirebaseCommunityService.instance = new FirebaseCommunityService();
    }
    return FirebaseCommunityService.instance;
  }

  constructor() {
    this.firestoreService = FirestoreService.getInstance();
    this.authService = FirebaseAuthService.getInstance();
  }

  /**
   * Get collection paths
   */
  private getQRCodePath(qrHash: string): string {
    return `qrCodes/${qrHash}`;
  }

  private getVotesPath(qrHash: string): string {
    return `qrCodes/${qrHash}/votes`;
  }

  private getUserVotePath(qrHash: string, userId: string): string {
    return `qrCodes/${qrHash}/votes/${userId}`;
  }

  /**
   * Calculate vote weight based on timestamp
   */
  private calculateVoteWeight(timestamp: number): number {
    const now = Date.now();
    const age = now - timestamp;
    const maxAge = COMMUNITY_CONFIG.VOTE_DECAY_DAYS * 24 * 60 * 60 * 1000;
    
    return Math.max(0.1, 1 - (age / maxAge));
  }

  /**
   * Calculate community confidence
   */
  private calculateCommunityConfidence(rating: CommunityRating): number {
    if (rating.totalVotes < COMMUNITY_CONFIG.MIN_VOTES_FOR_CONFIDENCE) {
      return 0.5;
    }

    const confidence = rating.safeVotes / rating.totalVotes;
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Check rate limiting for spam prevention
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userVotes = this.rateLimit.get(userId) || [];
    
    // Remove votes outside the window
    const recentVotes = userVotes.filter(
      timestamp => now - timestamp < COMMUNITY_CONFIG.RATE_LIMIT_WINDOW
    );

    this.rateLimit.set(userId, recentVotes);
    
    return recentVotes.length < COMMUNITY_CONFIG.MAX_VOTES_PER_WINDOW;
  }

  /**
   * Record vote timestamp for rate limiting
   */
  private recordVoteTime(userId: string): void {
    const userVotes = this.rateLimit.get(userId) || [];
    userVotes.push(Date.now());
    this.rateLimit.set(userId, userVotes);
  }

  /**
   * Submit or update a community vote with transaction
   */
  async submitVote(vote: Vote): Promise<DatabaseResponse<VoteResult>> {
    try {
      // Ensure user is authenticated
      const authResult = await this.authService.ensureAuthenticated();
      if (!authResult.success || !authResult.data) {
        return {
          success: false,
          error: 'User authentication required',
          timestamp: Date.now()
        };
      }

      const userId = authResult.data.uid;
      
      // Ensure vote has correct userId
      const voteWithUserId = { ...vote, userId };

      // Check rate limiting
      if (!this.checkRateLimit(userId)) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          timestamp: Date.now()
        };
      }

      // Use Firestore transaction for atomic vote update
      const transactionResult = await this.firestoreService.runTransaction(
        async (transaction: FirebaseFirestoreTypes.Transaction) => {
          const qrCodeRef = this.firestoreService['firestore']
            ?.collection('qrCodes')
            .doc(vote.qrHash);
          const userVoteRef = this.firestoreService['firestore']
            ?.collection('qrCodes')
            .doc(vote.qrHash)
            .collection('votes')
            .doc(userId);

          if (!qrCodeRef || !userVoteRef) {
            throw new Error('Failed to create document references');
          }

          // Get current rating and user's existing vote
          const [ratingDoc, userVoteDoc] = await Promise.all([
            transaction.get(qrCodeRef),
            transaction.get(userVoteRef)
          ]);

          const existingRating: CommunityRating = ratingDoc.exists 
            ? ratingDoc.data() as CommunityRating
            : {
                qrHash: vote.qrHash,
                safeVotes: 0,
                unsafeVotes: 0,
                totalVotes: 0,
                confidence: 0.5,
                lastUpdated: Date.now()
              };

          const existingVote: Vote | null = userVoteDoc.exists 
            ? userVoteDoc.data() as Vote 
            : null;

          let newRating = { ...existingRating };
          const isNewVote = !existingVote;

          // Remove old vote if it exists
          if (existingVote) {
            if (existingVote.vote === 'safe') {
              newRating.safeVotes = Math.max(0, newRating.safeVotes - 1);
            } else {
              newRating.unsafeVotes = Math.max(0, newRating.unsafeVotes - 1);
            }
            newRating.totalVotes = Math.max(0, newRating.totalVotes - 1);
          }

          // Add new vote
          if (voteWithUserId.vote === 'safe') {
            newRating.safeVotes += 1;
          } else {
            newRating.unsafeVotes += 1;
          }
          newRating.totalVotes += 1;

          // Recalculate confidence
          newRating.confidence = this.calculateCommunityConfidence(newRating);
          newRating.lastUpdated = Date.now();

          // Update documents in transaction
          const voteWithTimestamp = {
            ...voteWithUserId,
            createdAt: this.firestoreService.getServerTimestamp(),
            updatedAt: this.firestoreService.getServerTimestamp(),
            weight: this.calculateVoteWeight(voteWithUserId.timestamp)
          };

          const ratingWithTimestamp = {
            ...newRating,
            updatedAt: this.firestoreService.getServerTimestamp()
          };

          transaction.set(userVoteRef, voteWithTimestamp);
          transaction.set(qrCodeRef, ratingWithTimestamp, { merge: true });

          return {
            rating: newRating,
            userVote: voteWithUserId,
            isNewVote,
            previousVote: existingVote || undefined
          };
        }
      );

      if (transactionResult.success && transactionResult.data) {
        // Record vote time for rate limiting
        this.recordVoteTime(userId);
        
        console.log('Vote submitted successfully:', vote.qrHash);
        return {
          success: true,
          data: transactionResult.data,
          timestamp: Date.now()
        };
      } else {
        return transactionResult as DatabaseResponse<VoteResult>;
      }
    } catch (error) {
      console.error('Failed to submit vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vote submission failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Retract a user's vote
   */
  async retractVote(userId: string, qrHash: string): Promise<DatabaseResponse<CommunityRating>> {
    try {
      const currentUserId = this.authService.getUserId();
      if (!currentUserId || currentUserId !== userId) {
        return {
          success: false,
          error: 'Unauthorized to retract this vote',
          timestamp: Date.now()
        };
      }

      const transactionResult = await this.firestoreService.runTransaction(
        async (transaction: FirebaseFirestoreTypes.Transaction) => {
          const qrCodeRef = this.firestoreService['firestore']
            ?.collection('qrCodes')
            .doc(qrHash);
          const userVoteRef = this.firestoreService['firestore']
            ?.collection('qrCodes')
            .doc(qrHash)
            .collection('votes')
            .doc(userId);

          if (!qrCodeRef || !userVoteRef) {
            throw new Error('Failed to create document references');
          }

          const [ratingDoc, userVoteDoc] = await Promise.all([
            transaction.get(qrCodeRef),
            transaction.get(userVoteRef)
          ]);

          if (!userVoteDoc.exists) {
            throw new Error('No vote found to retract');
          }

          const existingRating = ratingDoc.exists 
            ? ratingDoc.data() as CommunityRating
            : null;
          const existingVote = userVoteDoc.data() as Vote;

          if (!existingRating) {
            throw new Error('No rating found for this QR code');
          }

          // Remove the vote from rating
          let newRating = { ...existingRating };
          if (existingVote.vote === 'safe') {
            newRating.safeVotes = Math.max(0, newRating.safeVotes - 1);
          } else {
            newRating.unsafeVotes = Math.max(0, newRating.unsafeVotes - 1);
          }
          newRating.totalVotes = Math.max(0, newRating.totalVotes - 1);

          // Recalculate confidence
          newRating.confidence = this.calculateCommunityConfidence(newRating);
          newRating.lastUpdated = Date.now();

          // Update documents
          transaction.delete(userVoteRef);
          
          if (newRating.totalVotes > 0) {
            const ratingWithTimestamp = {
              ...newRating,
              updatedAt: this.firestoreService.getServerTimestamp()
            };
            transaction.set(qrCodeRef, ratingWithTimestamp, { merge: true });
          } else {
            // If no votes left, delete the rating document
            transaction.delete(qrCodeRef);
          }

          return newRating;
        }
      );

      if (transactionResult.success) {
        console.log('Vote retracted successfully:', qrHash);
        return {
          success: true,
          data: transactionResult.data!,
          timestamp: Date.now()
        };
      } else {
        return transactionResult as DatabaseResponse<CommunityRating>;
      }
    } catch (error) {
      console.error('Failed to retract vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vote retraction failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get community rating for a QR code
   */
  async getCommunityRating(qrHash: string): Promise<DatabaseResponse<CommunityRating | null>> {
    try {
      const qrCodePath = this.getQRCodePath(qrHash);
      const result = await this.firestoreService.getDocument<CommunityRating>(
        'qrCodes',
        qrHash
      );

      return result;
    } catch (error) {
      console.error('Failed to get community rating:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get rating',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Subscribe to real-time community rating updates
   */
  subscribeToCommunityRating(
    qrHash: string,
    callback: (rating: CommunityRating | null, error?: string) => void
  ): string | null {
    try {
      const subscriptionId = `rating_${qrHash}_${Date.now()}`;

      const unsubscribe = this.firestoreService.subscribeToDocument<CommunityRating>(
        'qrCodes',
        qrHash,
        (data, error) => {
          if (error) {
            callback(null, error);
          } else {
            callback(data);
          }
        }
      );

      this.activeSubscriptions.set(subscriptionId, unsubscribe);
      return subscriptionId;
    } catch (error) {
      console.error('Failed to subscribe to community rating:', error);
      callback(null, error instanceof Error ? error.message : 'Subscription failed');
      return null;
    }
  }

  /**
   * Get user's vote for a specific QR code
   */
  async getUserVote(qrHash: string): Promise<DatabaseResponse<Vote | null>> {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          timestamp: Date.now()
        };
      }

      const result = await this.firestoreService.getDocument<Vote>(
        this.getVotesPath(qrHash),
        userId
      );

      return result;
    } catch (error) {
      console.error('Failed to get user vote:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user vote',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get all votes for a QR code (admin/debugging)
   */
  async getAllVotes(qrHash: string): Promise<DatabaseResponse<Vote[]>> {
    try {
      const result = await this.firestoreService.queryCollection<Vote>(
        this.getVotesPath(qrHash)
      );

      return result;
    } catch (error) {
      console.error('Failed to get all votes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get votes',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get community statistics
   */
  async getCommunityStats(): Promise<DatabaseResponse<CommunityStats>> {
    try {
      // This is a simplified version - in production you might want aggregation
      const ratingsResult = await this.firestoreService.queryCollection<CommunityRating>(
        'qrCodes'
      );

      if (!ratingsResult.success || !ratingsResult.data) {
        return ratingsResult as DatabaseResponse<CommunityStats>;
      }

      const ratings = ratingsResult.data;
      const totalVotes = ratings.reduce((sum, rating) => sum + rating.totalVotes, 0);
      const totalSafeVotes = ratings.reduce((sum, rating) => sum + rating.safeVotes, 0);
      
      const stats: CommunityStats = {
        totalQRCodes: ratings.length,
        totalVotes,
        safePercentage: totalVotes > 0 ? (totalSafeVotes / totalVotes) * 100 : 0,
        activeVoters: 0 // Would need aggregation query to get unique voter count
      };

      return {
        success: true,
        data: stats,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get community stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string): void {
    const unsubscribe = this.activeSubscriptions.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.activeSubscriptions.delete(subscriptionId);
      console.log('Unsubscribed from community updates:', subscriptionId);
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    this.activeSubscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.activeSubscriptions.clear();
    this.rateLimit.clear();
    console.log('Firebase community service cleaned up');
  }

  /**
   * Check if user can vote (rate limiting check)
   */
  canUserVote(userId?: string): boolean {
    const currentUserId = userId || this.authService.getUserId();
    if (!currentUserId) return false;

    return this.checkRateLimit(currentUserId);
  }

  /**
   * Get recent community activity (latest ratings)
   */
  async getRecentActivity(limit = 10): Promise<DatabaseResponse<CommunityRating[]>> {
    try {
      const result = await this.firestoreService.queryCollection<CommunityRating>(
        'qrCodes',
        [],
        { field: 'lastUpdated', direction: 'desc' },
        limit
      );

      return result;
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent activity',
        timestamp: Date.now()
      };
    }
  }
}

// Export singleton instance
export const firebaseCommunityService = FirebaseCommunityService.getInstance();