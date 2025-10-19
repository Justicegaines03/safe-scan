/**
 * Firebase Authentication Service
 * Handles anonymous authentication and user identity management
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { DatabaseResponse } from './types';

interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  createdAt: number;
  lastSignIn: number;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private authStateCallbacks: Array<(state: AuthState) => void> = [];
  private currentAuthState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true
  };

  static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  constructor() {
    this.initializeAuthListener();
  }

  /**
   * Initialize Firebase Auth state listener
   */
  private initializeAuthListener(): void {
    auth().onAuthStateChanged((user) => {
      console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
      
      this.currentAuthState = {
        user: user ? this.mapFirebaseUser(user) : null,
        isAuthenticated: !!user,
        isLoading: false
      };

      this.notifyAuthStateChange();
    });
  }

  /**
   * Map Firebase user to our AuthUser interface
   */
  private mapFirebaseUser(firebaseUser: FirebaseAuthTypes.User): AuthUser {
    return {
      uid: firebaseUser.uid,
      isAnonymous: firebaseUser.isAnonymous,
      createdAt: firebaseUser.metadata.creationTime 
        ? new Date(firebaseUser.metadata.creationTime).getTime() 
        : Date.now(),
      lastSignIn: firebaseUser.metadata.lastSignInTime 
        ? new Date(firebaseUser.metadata.lastSignInTime).getTime() 
        : Date.now()
    };
  }

  /**
   * Notify all subscribers of auth state changes
   */
  private notifyAuthStateChange(): void {
    this.authStateCallbacks.forEach(callback => {
      try {
        callback(this.currentAuthState);
      } catch (error) {
        console.error('Auth state callback error:', error);
      }
    });
  }

  /**
   * Sign in anonymously - creates a temporary user account
   */
  async signInAnonymously(): Promise<DatabaseResponse<AuthUser>> {
    try {
      console.log('Attempting anonymous sign in...');
      const userCredential = await auth().signInAnonymously();
      
      if (userCredential.user) {
        const authUser = this.mapFirebaseUser(userCredential.user);
        console.log('Anonymous sign in successful:', authUser.uid);
        
        return {
          success: true,
          data: authUser,
          timestamp: Date.now()
        };
      } else {
        throw new Error('Failed to create anonymous user');
      }
    } catch (error) {
      console.error('Anonymous sign in failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Anonymous sign in failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<DatabaseResponse<void>> {
    try {
      await auth().signOut();
      console.log('User signed out successfully');
      
      return {
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Sign out failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentAuthState.user;
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.currentAuthState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated;
  }

  /**
   * Check if user is anonymous
   */
  isAnonymous(): boolean {
    return this.currentAuthState.user?.isAnonymous ?? false;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (state: AuthState) => void): () => void {
    this.authStateCallbacks.push(callback);
    
    // Immediately call with current state
    callback(this.currentAuthState);

    // Return unsubscribe function
    return () => {
      const index = this.authStateCallbacks.indexOf(callback);
      if (index > -1) {
        this.authStateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Ensure user is authenticated (sign in anonymously if needed)
   */
  async ensureAuthenticated(): Promise<DatabaseResponse<AuthUser>> {
    try {
      // If already authenticated, return current user
      if (this.isAuthenticated() && this.currentAuthState.user) {
        return {
          success: true,
          data: this.currentAuthState.user,
          timestamp: Date.now()
        };
      }

      // Wait for auth state to initialize if loading
      if (this.currentAuthState.isLoading) {
        await this.waitForAuthInit();
      }

      // Check again after waiting
      if (this.isAuthenticated() && this.currentAuthState.user) {
        return {
          success: true,
          data: this.currentAuthState.user,
          timestamp: Date.now()
        };
      }

      // Sign in anonymously if not authenticated
      return await this.signInAnonymously();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Wait for auth initialization to complete
   */
  private async waitForAuthInit(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentAuthState.isLoading) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Auth initialization timeout'));
      }, timeout);

      const unsubscribe = this.onAuthStateChanged((state) => {
        if (!state.isLoading) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  /**
   * Delete current user account (anonymous users only)
   */
  async deleteAccount(): Promise<DatabaseResponse<void>> {
    try {
      const currentUser = auth().currentUser;
      
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      if (!currentUser.isAnonymous) {
        throw new Error('Can only delete anonymous accounts');
      }

      await currentUser.delete();
      console.log('Anonymous account deleted successfully');

      return {
        success: true,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Account deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account deletion failed',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get user ID for database operations
   */
  getUserId(): string | null {
    return this.currentAuthState.user?.uid ?? null;
  }

  /**
   * Check if Firebase Auth is available
   */
  async checkAuthAvailability(): Promise<boolean> {
    try {
      // Try to access auth instance
      const authInstance = auth();
      return !!authInstance;
    } catch {
      return false;
    }
  }

  /**
   * Get auth token for API calls (if needed)
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return null;

      return await currentUser.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return null;
    }
  }

  /**
   * Reload current user data
   */
  async reloadUser(): Promise<DatabaseResponse<AuthUser | null>> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        return {
          success: true,
          data: null,
          timestamp: Date.now()
        };
      }

      await currentUser.reload();
      const authUser = this.mapFirebaseUser(currentUser);

      return {
        success: true,
        data: authUser,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User reload failed',
        timestamp: Date.now()
      };
    }
  }
}

// Export singleton instance
export const firebaseAuthService = FirebaseAuthService.getInstance();