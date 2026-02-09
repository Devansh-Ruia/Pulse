// WebSocket Auto-reconnect with exponential backoff
function createWebSocket(roomId, alienId, role, onMessage, onConnectionChange) {
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds

  function connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?roomId=${roomId}&alienId=${alienId}&role=${role}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`Connected to room ${roomId} as ${role}`);
        reconnectAttempts = 0;
        onConnectionChange('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        onConnectionChange('disconnected');
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          setTimeout(connect, delay);
          reconnectAttempts++;
        } else {
          console.error('Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onConnectionChange('error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      onConnectionChange('error');
    }
  }

  // Start initial connection
  connect();

  // Return wrapper for sending messages
  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      } else {
        console.warn('WebSocket not ready, message not sent:', data);
      }
    },
    close: () => {
      if (ws) {
        ws.close();
      }
    }
  };
}

// Throttle function to limit how often a function can be called
function throttle(func, delay) {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

// Toast notification system
function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Format time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Get URL parameter
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Import real Alien Bridge
import { send, request, on, isBridgeAvailable, getLaunchParams } from '@alien_org/bridge';

// Make AlienBridge available globally (since attend.js and host.js reference it)
window.AlienBridge = {
  isAlienApp: false,
  authToken: null,
  alienId: null,

  /**
   * Initialize the bridge. Call this on page load.
   * Returns to user's alienId (from JWT) or a mock dev ID.
   */
  async init() {
    if (isBridgeAvailable()) {
      this.isAlienApp = true;
      const params = getLaunchParams();
      
      if (params && params.authToken) {
        this.authToken = params.authToken;
        
        // Decode the JWT to get the alienId (sub claim)
        // JWT is base64url encoded: header.payload.signature
        try {
          const payload = params.authToken.split('.')[1];
          const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          this.alienId = decoded.sub || decoded.alienId || 'alien_user_unknown';
        } catch (e) {
          console.warn('Failed to decode auth token:', e);
          this.alienId = 'alien_user_' + Date.now();
        }
      } else {
        this.alienId = 'alien_user_' + Date.now();
      }

      // Signal to the host app that we're ready
      send('app:ready', {});
      
      return { alienId: this.alienId, verified: true };

    } else {
      // Dev mode — mock
      console.log('[Pulse] Not running in Alien app — using dev mock');
      this.isAlienApp = false;
      this.alienId = 'dev_user_' + Math.random().toString(36).substr(2, 8);
      return { alienId: this.alienId, verified: true };
    }
  },

  /**
   * Get identity — returns cached alienId from init()
   */
  async getIdentity() {
    if (!this.alienId) {
      return await this.init();
    }
    return { alienId: this.alienId, verified: true };
  },

  /**
   * Request a payment via Alien Bridge
   * @param {Object} params - { to: string, amount: number }
   * @returns {Object} - { success: boolean, txId: string|null }
   */
  async requestPayment({ to, amount }) {
    if (!this.isAlienApp) {
      // Dev mode mock
      const confirmed = confirm(`[DEV MODE] Simulate paying $${amount}?`);
      return confirmed
        ? { success: true, txId: 'mock_tx_' + Date.now() }
        : { success: false, txId: null };
    }

    try {
      // Create an invoice ID for this payment
      const invoice = 'tip-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

      // Convert dollar amount to USDC smallest units (6 decimals)
      // $1.00 = "1000000"
      const amountInSmallestUnit = String(Math.round(amount * 1_000_000));

      const response = await request(
        'payment:request',
        {
          recipient: to,
          amount: amountInSmallestUnit,
          token: 'USDC',
          network: 'solana',
          invoice: invoice,
          item: {
            title: `$${amount.toFixed(2)} tip`,
            iconUrl: '',
            quantity: 1,
          }
        },
        'payment:response',
        { timeout: 60000 }  // 60s timeout for user to confirm
      );

      if (response.status === 'paid') {
        return { success: true, txId: response.txHash || invoice };
      } else if (response.status === 'cancelled') {
        return { success: false, txId: null };
      } else {
        // failed
        console.warn('Payment failed:', response.errorCode);
        return { success: false, txId: null };
      }

    } catch (error) {
      console.error('Payment error:', error);
      return { success: false, txId: null };
    }
  }
};
