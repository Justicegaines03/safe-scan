/**
 * Application Layer Index
 * Exports all application layer business logic
 */

// Interfaces (contracts with Infrastructure layer)
export * from './interfaces';

// Scanner logic
export { URLValidator } from './scanners/URLValidator';
export { SafetyAssessor } from './scanners/SafetyAssessor';
export { QRScanner } from './scanners/QRScanner';
export type { ValidationResult } from './scanners/QRScanner';
export type { SafetyAssessment } from './scanners/SafetyAssessor';

// Voting logic
export { CommunityVoting } from './voting/CommunityVoting';
