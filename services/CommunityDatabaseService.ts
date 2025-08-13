/**
 * Community Database Service
 * Handles community rating aggregation and voting
 */

import { CommunityRating, Vote, DatabaseResponse } from './types';

const COMMUNITY_CONFIG = {
  VOTE_DECAY_DAYS: 7,
  MIN_VOTES_FOR_CONFIDENCE: 3,
  SPAM_VOTE_THRESHOLD: 10, // votes per minute
  RATE_LIMIT_WINDOW: 5 * 60 * 1000, // 5 minutes
  MAX_VOTES_PER_WINDOW: 3,
  CONFIDENCE_THRESHOLD: 0.7,
} as const;

export class CommunityDatabaseService {
  private static instance: CommunityDatabaseService;
  private ratingsCache = new Map<string, CommunityRating>();
  private userVoteHistory = new Map<string, Vote[]>();
  private spamDetection = new Map<string, number[]>();

  static getInstance(): CommunityDatabaseService {
    if (!CommunityDatabaseService.instance) {
      CommunityDatabaseService.instance = new CommunityDatabaseService();
    }
    return CommunityDatabaseService.instance;
  }

  /**
   * Calculate community confidence correctly
   */
  calculateCommunityConfidence(rating: CommunityRating): number {
    if (rating.totalVotes < COMMUNITY_CONFIG.MIN_VOTES_FOR_CONFIDENCE) {
      return 0.5; // Neutral confidence for insufficient data
    }

    const confidence = rating.safeVotes / rating.totalVotes;
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Weight recent votes more heavily with time decay
   */
  calculateVoteWeight(timestamp: number): number {
    const now = Date.now();
    const age = now - timestamp;
    const maxAge = COMMUNITY_CONFIG.VOTE_DECAY_DAYS * 24 * 60 * 60 * 1000;
    
    // Linear decay over 7 days, minimum weight of 0.1
    const weight = Math.max(0.1, 1 - (age / maxAge));
    return weight;
  }

  /**
   * Add a new vote with spam and abuse detection
   * Allows users to update their existing vote
   */
  async addVote(vote: Vote): Promise<DatabaseResponse<CommunityRating>> {
    try {
      // Check if user is updating an existing vote
      const existingVote = this.getExistingUserVote(vote.userId, vote.qrHash);
      
      if (existingVote) {
        // Allow vote update - remove the old vote first
        console.log('=== UPDATING EXISTING VOTE ===');
        console.log('Old vote:', existingVote.vote);
        console.log('New vote:', vote.vote);
        console.log('==============================');
        
        this.removeUserVote(vote.userId, vote.qrHash);
        // Continue to add the new vote
      }

      // Check for spam patterns (but allow vote updates)
      if (!existingVote && this.isSpamVoting(vote.userId, vote.timestamp)) {
        return {
          success: false,
          error: 'Spam voting detected',
          timestamp: Date.now()
        };
      }

      // Check rate limiting (but allow vote updates)
      if (!existingVote && !this.checkRateLimit(vote.userId, vote.timestamp)) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          timestamp: Date.now()
        };
      }

      // Record the vote
      this.recordUserVote(vote);

      // Update community rating
      const updatedRating = await this.updateCommunityRating(vote, existingVote);

      return {
        success: true,
        data: updatedRating,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vote failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Check if user has already voted on this QR code
   */
  private hasDuplicateVote(userId: string, qrHash: string): boolean {
    const userVotes = this.userVoteHistory.get(userId) || [];
    const hasDuplicate = userVotes.some(vote => vote.qrHash === qrHash);
    
    console.log('=== DUPLICATE VOTE CHECK ===');
    console.log('User ID:', userId);
    console.log('QR Hash:', qrHash);
    console.log('User vote history length:', userVotes.length);
    console.log('Previous votes for this QR:', userVotes.filter(vote => vote.qrHash === qrHash).length);
    console.log('Has duplicate:', hasDuplicate);
    console.log('============================');
    
    return hasDuplicate;
  }

  /**
   * Get existing user vote for a specific QR code
   */
  private getExistingUserVote(userId: string, qrHash: string): Vote | null {
    const userVotes = this.userVoteHistory.get(userId) || [];
    return userVotes.find(vote => vote.qrHash === qrHash) || null;
  }

  /**
   * Remove user's previous vote for a QR code
   */
  private removeUserVote(userId: string, qrHash: string): void {
    const userVotes = this.userVoteHistory.get(userId) || [];
    const filteredVotes = userVotes.filter(vote => vote.qrHash !== qrHash);
    this.userVoteHistory.set(userId, filteredVotes);
  }

  /**
   * Handle spam and abuse detection
   */
  private isSpamVoting(userId: string, timestamp: number): boolean {
    const userVotes = this.userVoteHistory.get(userId) || [];
    const recentVotes = userVotes.filter(vote => 
      timestamp - vote.timestamp < 60000 // Last minute
    );

    // Check for rapid voting pattern
    if (recentVotes.length >= COMMUNITY_CONFIG.SPAM_VOTE_THRESHOLD) {
      return true;
    }

    // Check for repetitive voting on same QR codes
    const qrCounts = recentVotes.reduce((counts, vote) => {
      counts[vote.qrHash] = (counts[vote.qrHash] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Flag if voting on same QR code too many times
    return Object.values(qrCounts).some(count => count > 5);
  }

  /**
   * Implement rate limiting for voting
   */
  private checkRateLimit(userId: string, timestamp: number): boolean {
    const userVotes = this.userVoteHistory.get(userId) || [];
    const windowStart = timestamp - COMMUNITY_CONFIG.RATE_LIMIT_WINDOW;
    
    const recentVotes = userVotes.filter(vote => vote.timestamp > windowStart);
    return recentVotes.length < COMMUNITY_CONFIG.MAX_VOTES_PER_WINDOW;
  }

  /**
   * Record user vote in history
   */
  private recordUserVote(vote: Vote): void {
    const userVotes = this.userVoteHistory.get(vote.userId) || [];
    userVotes.push(vote);
    
    // Keep only recent votes to prevent memory bloat
    const cutoffTime = vote.timestamp - (30 * 24 * 60 * 60 * 1000); // 30 days
    const filteredVotes = userVotes.filter(v => v.timestamp > cutoffTime);
    
    this.userVoteHistory.set(vote.userId, filteredVotes);
  }

  /**
   * Update community rating with new vote
   */
  private async updateCommunityRating(vote: Vote, existingVote?: Vote | null): Promise<CommunityRating> {
    const existingRating = this.ratingsCache.get(vote.qrHash) || {
      qrHash: vote.qrHash,
      safeVotes: 0,
      unsafeVotes: 0,
      totalVotes: 0,
      confidence: 0.5,
      lastUpdated: vote.timestamp
    };

    // If updating an existing vote, first subtract the old vote
    if (existingVote) {
      if (existingVote.vote === 'safe') {
        existingRating.safeVotes--;
      } else {
        existingRating.unsafeVotes--;
      }
      existingRating.totalVotes--;
    }

    // Add the new vote
    if (vote.vote === 'safe') {
      existingRating.safeVotes++;
    } else {
      existingRating.unsafeVotes++;
    }
    existingRating.totalVotes++;
    existingRating.lastUpdated = vote.timestamp;

    // Recalculate confidence with weighted votes
    existingRating.confidence = this.calculateWeightedConfidence(vote.qrHash);

    this.ratingsCache.set(vote.qrHash, existingRating);
    return existingRating;
  }

  /**
   * Calculate weighted confidence considering vote age
   */
  private calculateWeightedConfidence(qrHash: string): number {
    const userVotes = Array.from(this.userVoteHistory.values())
      .flat()
      .filter(vote => vote.qrHash === qrHash);

    if (userVotes.length === 0) return 0.5;

    let weightedSafeVotes = 0;
    let totalWeight = 0;

    userVotes.forEach(vote => {
      const weight = this.calculateVoteWeight(vote.timestamp);
      totalWeight += weight;
      
      if (vote.vote === 'safe') {
        weightedSafeVotes += weight;
      }
    });

    return totalWeight > 0 ? weightedSafeVotes / totalWeight : 0.5;
  }

  /**
   * Get community rating for QR hash
   */
  async getCommunityRating(qrHash: string): Promise<CommunityRating | null> {
    return this.ratingsCache.get(qrHash) || null;
  }

  /**
   * Hash sensitive QR data for privacy
   */
  hashQRData(qrData: string): string {
    // Simple hash function for demo (use crypto library in production)
    let hash = 0;
    for (let i = 0; i < qrData.length; i++) {
      const char = qrData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return 'sha256_' + Math.abs(hash).toString(16);
  }

  /**
   * Anonymize user identifiers
   */
  anonymizeUserId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'user_' + Math.abs(hash).toString(36);
  }

  /**
   * Implement data retention policies
   */
  async cleanupOldData(): Promise<{ removed: number }> {
    const retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
    const cutoffDate = Date.now() - retentionPeriod;
    let removedCount = 0;

    // Clean up old ratings
    for (const [qrHash, rating] of this.ratingsCache) {
      if (rating.lastUpdated < cutoffDate) {
        this.ratingsCache.delete(qrHash);
        removedCount++;
      }
    }

    // Clean up old vote history
    for (const [userId, votes] of this.userVoteHistory) {
      const filteredVotes = votes.filter(vote => vote.timestamp > cutoffDate);
      removedCount += votes.length - filteredVotes.length;
      
      if (filteredVotes.length === 0) {
        this.userVoteHistory.delete(userId);
      } else {
        this.userVoteHistory.set(userId, filteredVotes);
      }
    }

    return { removed: removedCount };
  }

  /**
   * Handle high-volume voting efficiently with batch processing
   */
  async processBulkVotes(votes: Vote[]): Promise<DatabaseResponse<{ processed: number }>> {
    try {
      let processedCount = 0;
      const batchSize = 100;

      // Group votes by QR hash for efficient processing
      const groupedVotes = votes.reduce((groups, vote) => {
        if (!groups[vote.qrHash]) groups[vote.qrHash] = [];
        groups[vote.qrHash].push(vote);
        return groups;
      }, {} as Record<string, Vote[]>);

      // Process each group
      for (const [qrHash, qrVotes] of Object.entries(groupedVotes)) {
        for (let i = 0; i < qrVotes.length; i += batchSize) {
          const batch = qrVotes.slice(i, i + batchSize);
          
          for (const vote of batch) {
            const result = await this.addVote(vote);
            if (result.success) processedCount++;
          }
        }
      }

      return {
        success: true,
        data: { processed: processedCount },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk processing failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get statistics for monitoring and analytics
   */
  getStats() {
    const totalRatings = this.ratingsCache.size;
    const totalVotes = Array.from(this.userVoteHistory.values())
      .flat()
      .length;
    
    const safeRatings = Array.from(this.ratingsCache.values())
      .filter(rating => rating.confidence > COMMUNITY_CONFIG.CONFIDENCE_THRESHOLD)
      .length;

    return {
      totalRatings,
      totalVotes,
      safeRatings,
      unsafeRatings: totalRatings - safeRatings,
      activeUsers: this.userVoteHistory.size
    };
  }
}
