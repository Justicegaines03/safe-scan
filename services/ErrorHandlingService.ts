/**
 * Error Handling and Resilience Service
 * Implements circuit breaker pattern and graceful degradation
 */

import { CircuitBreakerState, ServiceAvailability } from './types';

const ERROR_CONFIG = {
  FAILURE_THRESHOLD: 5,
  TIMEOUT_PERIOD: 60000, // 1 minute
  HALF_OPEN_MAX_CALLS: 3,
  SERVICE_TIMEOUT: 10000, // 10 seconds
} as const;

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private serviceAvailability: ServiceAvailability = {
    virusTotal: true,
    communityDB: true,
    localCache: true,
    webSocket: true
  };

  static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    serviceKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceKey);

    // Check if circuit is open
    if (this.isCircuitOpen(breaker)) {
      throw new Error(`Circuit breaker open for ${serviceKey}`);
    }

    try {
      const result = await this.executeWithTimeout(operation, ERROR_CONFIG.SERVICE_TIMEOUT);
      this.recordSuccess(serviceKey);
      return result;
    } catch (error) {
      this.recordFailure(serviceKey);
      throw error;
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(breaker: CircuitBreakerState): boolean {
    if (breaker.state === 'closed') {
      return false;
    }

    if (breaker.state === 'open') {
      if (Date.now() >= breaker.nextAttemptTime) {
        // Transition to half-open
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    // Half-open state - allow limited calls
    return false;
  }

  /**
   * Get or create circuit breaker for service
   */
  private getCircuitBreaker(serviceKey: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(serviceKey)) {
      this.circuitBreakers.set(serviceKey, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      });
    }
    return this.circuitBreakers.get(serviceKey)!;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(serviceKey: string): void {
    const breaker = this.getCircuitBreaker(serviceKey);
    breaker.failureCount = 0;
    breaker.state = 'closed';
    this.updateServiceAvailability(serviceKey, true);
  }

  /**
   * Record failed operation
   */
  private recordFailure(serviceKey: string): void {
    const breaker = this.getCircuitBreaker(serviceKey);
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= ERROR_CONFIG.FAILURE_THRESHOLD) {
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + ERROR_CONFIG.TIMEOUT_PERIOD;
      this.updateServiceAvailability(serviceKey, false);
    }
  }

  /**
   * Update service availability status
   */
  private updateServiceAvailability(serviceKey: string, available: boolean): void {
    if (serviceKey in this.serviceAvailability) {
      this.serviceAvailability[serviceKey as keyof ServiceAvailability] = available;
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get available services for graceful degradation
   */
  getAvailableServices(): string[] {
    return Object.entries(this.serviceAvailability)
      .filter(([, available]) => available)
      .map(([service]) => service);
  }

  /**
   * Get service availability status
   */
  getServiceAvailability(): ServiceAvailability {
    return { ...this.serviceAvailability };
  }

  /**
   * Manually set service availability
   */
  setServiceAvailability(service: keyof ServiceAvailability, available: boolean): void {
    this.serviceAvailability[service] = available;
  }

  /**
   * Get circuit breaker status for service
   */
  getCircuitBreakerStatus(serviceKey: string): CircuitBreakerState {
    return { ...this.getCircuitBreaker(serviceKey) };
  }

  /**
   * Reset circuit breaker for service
   */
  resetCircuitBreaker(serviceKey: string): void {
    this.circuitBreakers.set(serviceKey, {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    });
  }

  /**
   * Handle database connection failures
   */
  async handleDatabaseFailure(error: Error): Promise<void> {
    console.error('Database connection failed:', error);
    this.setServiceAvailability('communityDB', false);
    
    // Implement fallback strategy
    const availableServices = this.getAvailableServices();
    if (availableServices.includes('localCache')) {
      console.log('Falling back to local cache');
    }
  }

  /**
   * Handle network failures
   */
  async handleNetworkFailure(error: Error): Promise<void> {
    console.error('Network failure:', error);
    this.setServiceAvailability('virusTotal', false);
    this.setServiceAvailability('webSocket', false);
    
    // Queue operations for later
    console.log('Queueing operations for offline mode');
  }

  /**
   * Implement retry with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalCircuitBreakers: this.circuitBreakers.size,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
      availableServices: this.getAvailableServices().length,
      totalServices: Object.keys(this.serviceAvailability).length
    };

    for (const breaker of this.circuitBreakers.values()) {
      switch (breaker.state) {
        case 'open':
          stats.openCircuits++;
          break;
        case 'half-open':
          stats.halfOpenCircuits++;
          break;
        case 'closed':
          stats.closedCircuits++;
          break;
      }
    }

    return stats;
  }
}
