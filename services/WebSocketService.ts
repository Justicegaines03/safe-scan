/**
 * WebSocket Service for Real-time Updates
 * Handles live rating updates and real-time communication
 */

import { WebSocketMessage, CommunityRating } from './types';

const WEBSOCKET_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_DELAY: 1000,
  MAX_DELAY: 30000,
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  MESSAGE_QUEUE_LIMIT: 100,
  UPDATE_THROTTLE_MS: 1000, // 1 second
} as const;

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private messageQueue: WebSocketMessage[] = [];
  private subscribers = new Map<string, Set<(data: any) => void>>();
  private lastUpdateTime = new Map<string, number>();
  private heartbeatInterval: any = null;
  private isConnected = false;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Establish WebSocket connection for real-time updates
   */
  async connect(url: string = 'wss://api.safescan.com/updates'): Promise<boolean> {
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        
        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.handleOpen();
          resolve(true);
        };
      });
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      return false;
    }
  }

  /**
   * Handle WebSocket connection open
   */
  private handleOpen(): void {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.processMessageQueue();
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.processIncomingMessage(message);
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket connection close
   */
  private handleClose(): void {
    console.log('WebSocket disconnected');
    this.isConnected = false;
    this.stopHeartbeat();
    this.attemptReconnection();
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.isConnected = false;
  }

  /**
   * Handle connection failures and reconnection with exponential backoff
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts >= WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      WEBSOCKET_CONFIG.MAX_DELAY,
      WEBSOCKET_CONFIG.BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1)
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message with queuing during disconnection
   */
  sendMessage(message: WebSocketMessage): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.queueMessage(message);
      }
    } else {
      this.queueMessage(message);
    }
  }

  /**
   * Queue message for later when connection is restored
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= WEBSOCKET_CONFIG.MESSAGE_QUEUE_LIMIT) {
      // Remove oldest message to make room
      this.messageQueue.shift();
    }
    
    this.messageQueue.push(message);
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Process incoming messages and notify subscribers
   */
  private processIncomingMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'rating_update':
        this.handleRatingUpdate(message);
        break;
      case 'vote':
        this.handleVoteUpdate(message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle real-time rating updates with throttling
   */
  private handleRatingUpdate(message: WebSocketMessage): void {
    if (!message.qrHash) return;

    // Implement update throttling to prevent spam
    const lastUpdate = this.lastUpdateTime.get(message.qrHash) || 0;
    const now = Date.now();
    
    if (now - lastUpdate < WEBSOCKET_CONFIG.UPDATE_THROTTLE_MS) {
      return; // Throttle rapid updates
    }

    this.lastUpdateTime.set(message.qrHash, now);
    this.notifySubscribers('rating_update', message);
  }

  /**
   * Handle vote updates
   */
  private handleVoteUpdate(message: WebSocketMessage): void {
    this.notifySubscribers('vote', message);
  }

  /**
   * Handle heartbeat messages
   */
  private handleHeartbeat(message: WebSocketMessage): void {
    // Respond to heartbeat to keep connection alive
    this.sendMessage({
      type: 'heartbeat',
      timestamp: Date.now(),
      clientId: this.getClientId()
    });
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(messageType)) {
      this.subscribers.set(messageType, new Set());
    }
    
    this.subscribers.get(messageType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(messageType)?.delete(callback);
    };
  }

  /**
   * Notify all subscribers of a message type
   */
  private notifySubscribers(messageType: string, data: any): void {
    const callbacks = this.subscribers.get(messageType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastRatingUpdate(qrHash: string, newRating: CommunityRating): void {
    const message: WebSocketMessage = {
      type: 'rating_update',
      qrHash,
      data: { newRating },
      timestamp: Date.now(),
      clientId: this.getClientId()
    };

    this.sendMessage(message);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now(),
          clientId: this.getClientId()
        });
      }
    }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get unique client identifier
   */
  private getClientId(): string {
    // Generate or retrieve client ID
    if (typeof window !== 'undefined') {
      let clientId = localStorage.getItem('safe_scan_client_id');
      if (!clientId) {
        clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('safe_scan_client_id', clientId);
      }
      return clientId;
    }
    return 'client_' + Date.now();
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    queuedMessages: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }

  /**
   * Handle concurrent vote conflicts with last-write-wins strategy
   */
  resolveVoteConflict(votes: Array<{ userId: string; vote: string; timestamp: number }>): any {
    return votes.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  /**
   * Mock WebSocket for testing environments
   */
  static createMockWebSocket(): {
    readyState: number;
    url: string;
    onmessage: ((event: MessageEvent) => void) | null;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    send: (data: string) => void;
    close: () => void;
  } {
    return {
      readyState: 1, // OPEN
      url: 'wss://api.safescan.com/updates',
      onmessage: null,
      onopen: null,
      onclose: null,
      onerror: null,
      send: (data: string) => {
        console.log('Mock WebSocket send:', data);
      },
      close: () => {
        console.log('Mock WebSocket close');
      }
    };
  }
}
