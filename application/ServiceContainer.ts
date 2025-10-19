/**
 * Service Container
 * Application Layer - Dependency Injection
 *
 * Centralized container for all service dependencies
 * Configures and provides instances of all services
 */

import { QRScanner } from './scanners/QRScanner';
import { CommunityVoting } from './voting/CommunityVoting';

// Infrastructure layer imports
import {
  VirusTotalAPI,
  FirebaseCommunityAdapter,
  FirebaseScanHistoryAdapter,
  UserIdentityAdapter
} from '@/infrastructure/adapters';

// Interface imports
import { IVirusTotalAPI } from './interfaces/IVirusTotalAPI';
import { ICommunityService } from './interfaces/ICommunityService';
import { IScanHistoryService } from './interfaces/IScanHistoryService';
import { IUserIdentityService } from './interfaces/IUserIdentityService';

/**
 * Service Container
 * Singleton that manages all service instances and dependencies
 *
 * Benefits:
 * - Single place to configure all dependencies
 * - Easy to swap implementations (e.g., mock services for testing)
 * - Clear dependency graph
 * - Supports testability through interface-based design
 */
export class ServiceContainer {
  private static instance: ServiceContainer;

  // Infrastructure services (implementing interfaces)
  public readonly virusTotalAPI: IVirusTotalAPI;
  public readonly communityService: ICommunityService;
  public readonly scanHistoryService: IScanHistoryService;
  public readonly userIdentityService: IUserIdentityService;

  // Application services (business logic)
  public readonly qrScanner: QRScanner;
  public readonly communityVoting: CommunityVoting;

  private constructor() {
    console.log('ServiceContainer: Initializing services...');

    // Initialize infrastructure services
    // These are the "real" implementations that talk to Firebase, VirusTotal, etc.
    this.virusTotalAPI = new VirusTotalAPI();
    this.communityService = new FirebaseCommunityAdapter();
    this.scanHistoryService = new FirebaseScanHistoryAdapter();
    this.userIdentityService = new UserIdentityAdapter();

    console.log('ServiceContainer: Infrastructure services initialized');

    // Initialize application services with injected dependencies
    this.qrScanner = new QRScanner(
      this.virusTotalAPI,
      this.communityService,
      this.scanHistoryService,
      this.userIdentityService
    );

    this.communityVoting = new CommunityVoting(
      this.communityService,
      this.userIdentityService
    );

    console.log('ServiceContainer: Application services initialized');
  }

  /**
   * Get the singleton instance of the service container
   * @returns ServiceContainer instance
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    ServiceContainer.instance = null as any;
  }
}

// Export singleton instance for convenience
export const serviceContainer = ServiceContainer.getInstance();
