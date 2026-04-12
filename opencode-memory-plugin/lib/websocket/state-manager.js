/**
 * WebSocket State Manager
 * Manages connection state transitions for ReliableWebSocketClient
 */

export const WebSocketState = {
  CLOSED: 'closed',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

export class StateManager {
  constructor() {
    this.state = WebSocketState.CLOSED;
    this.stateChangeHandlers = new Map();
    this.stateHistory = [];
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if in specific state
   */
  is(state) {
    return this.state === state;
  }

  /**
   * Transition to new state
   */
  transition(newState, reason = '') {
    const oldState = this.state;

    if (oldState === newState) {
      return false;
    }

    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`[StateManager] Invalid transition: ${oldState} -> ${newState}`);
      return false;
    }

    this.state = newState;

    // Record history
    this.stateHistory.push({
      from: oldState,
      to: newState,
      reason,
      timestamp: Date.now(),
    });

    // Trim history
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }

    // Trigger handlers
    this.triggerHandlers(oldState, newState, reason);

    console.log(`[StateManager] ${oldState} -> ${newState}${reason ? ` (${reason})` : ''}`);

    return true;
  }

  /**
   * Validate state transition
   */
  isValidTransition(from, to) {
    const validTransitions = {
      [WebSocketState.CLOSED]: [WebSocketState.CONNECTING],
      [WebSocketState.CONNECTING]: [
        WebSocketState.CONNECTED,
        WebSocketState.CLOSED,
        WebSocketState.RECONNECTING,
      ],
      [WebSocketState.CONNECTED]: [WebSocketState.CLOSED, WebSocketState.RECONNECTING],
      [WebSocketState.RECONNECTING]: [WebSocketState.CONNECTING, WebSocketState.CLOSED],
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Register state change handler
   */
  onStateChange(handler) {
    const id = Math.random().toString(36).substring(7);
    this.stateChangeHandlers.set(id, handler);
    return id;
  }

  /**
   * Remove state change handler
   */
  offStateChange(id) {
    this.stateChangeHandlers.delete(id);
  }

  /**
   * Trigger all handlers
   */
  triggerHandlers(oldState, newState, reason) {
    for (const handler of this.stateChangeHandlers.values()) {
      try {
        handler(oldState, newState, reason);
      } catch (error) {
        console.error('[StateManager] Handler error:', error);
      }
    }
  }

  /**
   * Get state history
   */
  getHistory() {
    return [...this.stateHistory];
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.state = WebSocketState.CLOSED;
    this.stateHistory = [];
  }
}

export default { StateManager, WebSocketState };
