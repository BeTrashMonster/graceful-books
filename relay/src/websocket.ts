/**
 * WebSocket support for real-time sync notifications
 *
 * Uses Cloudflare Durable Objects for WebSocket coordination.
 * Notifies connected clients when new changes are available.
 *
 * Requirements:
 * - H8: Sync Relay - Hosted [MVP]
 * - Real-time sync notifications
 * - Multi-device coordination
 */

import type { Env } from './types';

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: 'ping' | 'pong' | 'sync_available' | 'subscribe' | 'unsubscribe';
  timestamp: number;
  data?: unknown;
}

/**
 * Durable Object for managing WebSocket sessions
 *
 * Each user gets their own Durable Object instance that coordinates
 * all connected devices for that user.
 */
export class SyncSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, WebSocket>;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  /**
   * Handle HTTP requests (upgrade to WebSocket)
   */
  async fetch(request: Request): Promise<Response> {
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // Extract device ID from URL
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('device_id');

    if (!deviceId) {
      return new Response('Missing device_id parameter', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.handleSession(server, deviceId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle WebSocket session
   */
  private async handleSession(websocket: WebSocket, deviceId: string) {
    // Accept the connection
    websocket.accept();

    // Store session
    this.sessions.set(deviceId, websocket);

    // Start ping interval if not already running
    if (!this.pingInterval) {
      this.startPingInterval();
    }

    // Send welcome message
    this.send(websocket, {
      type: 'subscribe',
      timestamp: Date.now(),
      data: {
        message: 'Connected to sync relay',
        device_id: deviceId,
        session_count: this.sessions.size,
      },
    });

    // Handle messages
    websocket.addEventListener('message', event => {
      try {
        const message: WSMessage = JSON.parse(event.data as string);
        this.handleMessage(websocket, deviceId, message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    // Handle close
    websocket.addEventListener('close', () => {
      this.sessions.delete(deviceId);

      // Stop ping interval if no sessions
      if (this.sessions.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    });

    // Handle errors
    websocket.addEventListener('error', error => {
      console.error('WebSocket error:', error);
      this.sessions.delete(deviceId);
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(
    websocket: WebSocket,
    deviceId: string,
    message: WSMessage
  ) {
    switch (message.type) {
      case 'ping':
        // Respond with pong
        this.send(websocket, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'pong':
        // Client responded to our ping
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send message to WebSocket
   */
  private send(websocket: WebSocket, message: WSMessage) {
    try {
      websocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Broadcast message to all connected devices except sender
   */
  private broadcast(excludeDeviceId: string, message: WSMessage) {
    for (const [deviceId, websocket] of this.sessions) {
      if (deviceId !== excludeDeviceId) {
        this.send(websocket, message);
      }
    }
  }

  /**
   * Notify all devices that sync is available
   */
  notifySyncAvailable(sourceDeviceId: string) {
    this.broadcast(sourceDeviceId, {
      type: 'sync_available',
      timestamp: Date.now(),
      data: {
        source_device: sourceDeviceId,
      },
    });
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval() {
    const interval = parseInt(
      this.env.WS_PING_INTERVAL_MS || '30000',
      10
    );

    this.pingInterval = setInterval(() => {
      for (const [deviceId, websocket] of this.sessions) {
        try {
          this.send(websocket, {
            type: 'ping',
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`Failed to ping device ${deviceId}:`, error);
          this.sessions.delete(deviceId);
        }
      }
    }, interval);
  }

  /**
   * Get session statistics
   */
  getStats(): {
    connected_devices: number;
    device_ids: string[];
  } {
    return {
      connected_devices: this.sessions.size,
      device_ids: Array.from(this.sessions.keys()),
    };
  }
}

/**
 * Get Durable Object ID for user
 */
export function getSyncSessionId(env: Env, userId: string): DurableObjectId {
  return env.SYNC_SESSIONS.idFromName(userId);
}

/**
 * Get Durable Object stub for user
 */
export function getSyncSessionStub(
  env: Env,
  userId: string
): DurableObjectStub {
  const id = getSyncSessionId(env, userId);
  return env.SYNC_SESSIONS.get(id);
}

/**
 * Notify user's devices that sync is available
 */
export async function notifyDevices(
  env: Env,
  userId: string,
  sourceDeviceId: string
): Promise<void> {
  try {
    const stub = getSyncSessionStub(env, userId);
    await stub.fetch('http://internal/notify', {
      method: 'POST',
      body: JSON.stringify({
        source_device_id: sourceDeviceId,
      }),
    });
  } catch (error) {
    console.error('Failed to notify devices:', error);
    // Don't throw - notification is best-effort
  }
}
