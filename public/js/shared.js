// Alien Bridge Wrapper and Shared Utilities

const AlienBridge = {
  async getIdentity() {
    if (window.alien && window.alien.getIdentity) {
      return await window.alien.getIdentity();
    }
    // Fallback to mock for local dev
    const script = document.createElement('script');
    script.src = '/alien-mock.js';
    document.head.appendChild(script);
    await new Promise(r => setTimeout(r, 100));
    return await window.alien.getIdentity();
  },
  
  async requestPayment(params) {
    if (window.alien && window.alien.requestPayment) {
      return await window.alien.requestPayment(params);
    }
    // Fallback mock
    return { success: true, txId: 'mock_tx_' + Date.now() };
  }
};

// WebSocket with auto-reconnect
function createWebSocket(roomId, alienId, role, onMessage, onConnectionChange) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  let ws = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;
  
  const connect = () => {
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        onConnectionChange && onConnectionChange('connected');
        
        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          roomId,
          alienId,
          role
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage && onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        onConnectionChange && onConnectionChange('disconnected');
        
        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 10000);
          reconnectAttempts++;
          
          onConnectionChange && onConnectionChange('reconnecting');
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          
          reconnectTimeout = setTimeout(connect, delay);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onConnectionChange && onConnectionChange('disconnected');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      onConnectionChange && onConnectionChange('disconnected');
    }
  };
  
  // Initial connection
  connect();
  
  // Return control object
  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        console.warn('WebSocket not ready, message not sent:', data);
      }
    },
    
    close: () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    },
    
    getState: () => {
      return ws ? ws.readyState : WebSocket.CLOSED;
    }
  };
}

// Throttle utility
function throttle(func, ms) {
  let timeout = null;
  let lastExec = 0;
  
  return function (...args) {
    const context = this;
    const now = Date.now();
    
    if (now - lastExec > ms) {
      func.apply(context, args);
      lastExec = now;
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
        lastExec = Date.now();
      }, ms - (now - lastExec));
    }
  };
}

// Toast notification
function showToast(message, duration = 3000) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
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
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Get URL parameter
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Sentiment to emoji
function sentimentToEmoji(value) {
  if (value < 0.2) return '🧊';
  if (value < 0.4) return '😐';
  if (value < 0.6) return '🙂';
  if (value < 0.8) return '😊';
  return '🔥';
}

// Sentiment to color
function sentimentToColor(value) {
  const r = Math.round(255 * value);
  const b = Math.round(255 * (1 - value));
  return `rgb(${r}, 100, ${b})`;
}
