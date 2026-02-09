(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/emittery/maps.js
  var anyMap = /* @__PURE__ */ new WeakMap();
  var eventsMap = /* @__PURE__ */ new WeakMap();
  var producersMap = /* @__PURE__ */ new WeakMap();

  // node_modules/emittery/index.js
  var anyProducer = /* @__PURE__ */ Symbol("anyProducer");
  var resolvedPromise = Promise.resolve();
  var listenerAdded = /* @__PURE__ */ Symbol("listenerAdded");
  var listenerRemoved = /* @__PURE__ */ Symbol("listenerRemoved");
  var canEmitMetaEvents = false;
  var isGlobalDebugEnabled = false;
  var isEventKeyType = (key) => typeof key === "string" || typeof key === "symbol" || typeof key === "number";
  function assertEventName(eventName) {
    if (!isEventKeyType(eventName)) {
      throw new TypeError("`eventName` must be a string, symbol, or number");
    }
  }
  function assertListener(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("listener must be a function");
    }
  }
  function getListeners(instance, eventName) {
    const events = eventsMap.get(instance);
    if (!events.has(eventName)) {
      return;
    }
    return events.get(eventName);
  }
  function getEventProducers(instance, eventName) {
    const key = isEventKeyType(eventName) ? eventName : anyProducer;
    const producers = producersMap.get(instance);
    if (!producers.has(key)) {
      return;
    }
    return producers.get(key);
  }
  function enqueueProducers(instance, eventName, eventData) {
    const producers = producersMap.get(instance);
    if (producers.has(eventName)) {
      for (const producer of producers.get(eventName)) {
        producer.enqueue(eventData);
      }
    }
    if (producers.has(anyProducer)) {
      const item = Promise.all([eventName, eventData]);
      for (const producer of producers.get(anyProducer)) {
        producer.enqueue(item);
      }
    }
  }
  function iterator(instance, eventNames) {
    eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
    let isFinished = false;
    let flush = () => {
    };
    let queue = [];
    const producer = {
      enqueue(item) {
        queue.push(item);
        flush();
      },
      finish() {
        isFinished = true;
        flush();
      }
    };
    for (const eventName of eventNames) {
      let set = getEventProducers(instance, eventName);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        const producers = producersMap.get(instance);
        producers.set(eventName, set);
      }
      set.add(producer);
    }
    return {
      async next() {
        if (!queue) {
          return { done: true };
        }
        if (queue.length === 0) {
          if (isFinished) {
            queue = void 0;
            return this.next();
          }
          await new Promise((resolve) => {
            flush = resolve;
          });
          return this.next();
        }
        return {
          done: false,
          value: await queue.shift()
        };
      },
      async return(value) {
        queue = void 0;
        for (const eventName of eventNames) {
          const set = getEventProducers(instance, eventName);
          if (set) {
            set.delete(producer);
            if (set.size === 0) {
              const producers = producersMap.get(instance);
              producers.delete(eventName);
            }
          }
        }
        flush();
        return arguments.length > 0 ? { done: true, value: await value } : { done: true };
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
  function defaultMethodNamesOrAssert(methodNames) {
    if (methodNames === void 0) {
      return allEmitteryMethods;
    }
    if (!Array.isArray(methodNames)) {
      throw new TypeError("`methodNames` must be an array of strings");
    }
    for (const methodName of methodNames) {
      if (!allEmitteryMethods.includes(methodName)) {
        if (typeof methodName !== "string") {
          throw new TypeError("`methodNames` element must be a string");
        }
        throw new Error(`${methodName} is not Emittery method`);
      }
    }
    return methodNames;
  }
  var isMetaEvent = (eventName) => eventName === listenerAdded || eventName === listenerRemoved;
  function emitMetaEvent(emitter2, eventName, eventData) {
    if (!isMetaEvent(eventName)) {
      return;
    }
    try {
      canEmitMetaEvents = true;
      emitter2.emit(eventName, eventData);
    } finally {
      canEmitMetaEvents = false;
    }
  }
  var Emittery = class _Emittery {
    static mixin(emitteryPropertyName, methodNames) {
      methodNames = defaultMethodNamesOrAssert(methodNames);
      return (target) => {
        if (typeof target !== "function") {
          throw new TypeError("`target` must be function");
        }
        for (const methodName of methodNames) {
          if (target.prototype[methodName] !== void 0) {
            throw new Error(`The property \`${methodName}\` already exists on \`target\``);
          }
        }
        function getEmitteryProperty() {
          Object.defineProperty(this, emitteryPropertyName, {
            enumerable: false,
            value: new _Emittery()
          });
          return this[emitteryPropertyName];
        }
        Object.defineProperty(target.prototype, emitteryPropertyName, {
          enumerable: false,
          get: getEmitteryProperty
        });
        const emitteryMethodCaller = (methodName) => function(...args) {
          return this[emitteryPropertyName][methodName](...args);
        };
        for (const methodName of methodNames) {
          Object.defineProperty(target.prototype, methodName, {
            enumerable: false,
            value: emitteryMethodCaller(methodName)
          });
        }
        return target;
      };
    }
    static get isDebugEnabled() {
      if (typeof globalThis.process?.env !== "object") {
        return isGlobalDebugEnabled;
      }
      const { env } = globalThis.process ?? { env: {} };
      return env.DEBUG === "emittery" || env.DEBUG === "*" || isGlobalDebugEnabled;
    }
    static set isDebugEnabled(newValue) {
      isGlobalDebugEnabled = newValue;
    }
    constructor(options = {}) {
      anyMap.set(this, /* @__PURE__ */ new Set());
      eventsMap.set(this, /* @__PURE__ */ new Map());
      producersMap.set(this, /* @__PURE__ */ new Map());
      producersMap.get(this).set(anyProducer, /* @__PURE__ */ new Set());
      this.debug = options.debug ?? {};
      if (this.debug.enabled === void 0) {
        this.debug.enabled = false;
      }
      if (!this.debug.logger) {
        this.debug.logger = (type, debugName, eventName, eventData) => {
          try {
            eventData = JSON.stringify(eventData);
          } catch {
            eventData = `Object with the following keys failed to stringify: ${Object.keys(eventData).join(",")}`;
          }
          if (typeof eventName === "symbol" || typeof eventName === "number") {
            eventName = eventName.toString();
          }
          const currentTime = /* @__PURE__ */ new Date();
          const logTime = `${currentTime.getHours()}:${currentTime.getMinutes()}:${currentTime.getSeconds()}.${currentTime.getMilliseconds()}`;
          console.log(`[${logTime}][emittery:${type}][${debugName}] Event Name: ${eventName}
	data: ${eventData}`);
        };
      }
    }
    logIfDebugEnabled(type, eventName, eventData) {
      if (_Emittery.isDebugEnabled || this.debug.enabled) {
        this.debug.logger(type, this.debug.name, eventName, eventData);
      }
    }
    on(eventNames, listener, { signal } = {}) {
      assertListener(listener);
      eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
      for (const eventName of eventNames) {
        assertEventName(eventName);
        let set = getListeners(this, eventName);
        if (!set) {
          set = /* @__PURE__ */ new Set();
          const events = eventsMap.get(this);
          events.set(eventName, set);
        }
        set.add(listener);
        this.logIfDebugEnabled("subscribe", eventName, void 0);
        if (!isMetaEvent(eventName)) {
          emitMetaEvent(this, listenerAdded, { eventName, listener });
        }
      }
      const off2 = () => {
        this.off(eventNames, listener);
        signal?.removeEventListener("abort", off2);
      };
      signal?.addEventListener("abort", off2, { once: true });
      if (signal?.aborted) {
        off2();
      }
      return off2;
    }
    off(eventNames, listener) {
      assertListener(listener);
      eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
      for (const eventName of eventNames) {
        assertEventName(eventName);
        const set = getListeners(this, eventName);
        if (set) {
          set.delete(listener);
          if (set.size === 0) {
            const events = eventsMap.get(this);
            events.delete(eventName);
          }
        }
        this.logIfDebugEnabled("unsubscribe", eventName, void 0);
        if (!isMetaEvent(eventName)) {
          emitMetaEvent(this, listenerRemoved, { eventName, listener });
        }
      }
    }
    once(eventNames, predicate) {
      if (predicate !== void 0 && typeof predicate !== "function") {
        throw new TypeError("predicate must be a function");
      }
      let off_;
      const promise = new Promise((resolve) => {
        off_ = this.on(eventNames, (data) => {
          if (predicate && !predicate(data)) {
            return;
          }
          off_();
          resolve(data);
        });
      });
      promise.off = off_;
      return promise;
    }
    events(eventNames) {
      eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
      for (const eventName of eventNames) {
        assertEventName(eventName);
      }
      return iterator(this, eventNames);
    }
    async emit(eventName, eventData) {
      assertEventName(eventName);
      if (isMetaEvent(eventName) && !canEmitMetaEvents) {
        throw new TypeError("`eventName` cannot be meta event `listenerAdded` or `listenerRemoved`");
      }
      this.logIfDebugEnabled("emit", eventName, eventData);
      enqueueProducers(this, eventName, eventData);
      const listeners = getListeners(this, eventName) ?? /* @__PURE__ */ new Set();
      const anyListeners = anyMap.get(this);
      const staticListeners = [...listeners];
      const staticAnyListeners = isMetaEvent(eventName) ? [] : [...anyListeners];
      await resolvedPromise;
      await Promise.all([
        ...staticListeners.map(async (listener) => {
          if (listeners.has(listener)) {
            return listener(eventData);
          }
        }),
        ...staticAnyListeners.map(async (listener) => {
          if (anyListeners.has(listener)) {
            return listener(eventName, eventData);
          }
        })
      ]);
    }
    async emitSerial(eventName, eventData) {
      assertEventName(eventName);
      if (isMetaEvent(eventName) && !canEmitMetaEvents) {
        throw new TypeError("`eventName` cannot be meta event `listenerAdded` or `listenerRemoved`");
      }
      this.logIfDebugEnabled("emitSerial", eventName, eventData);
      const listeners = getListeners(this, eventName) ?? /* @__PURE__ */ new Set();
      const anyListeners = anyMap.get(this);
      const staticListeners = [...listeners];
      const staticAnyListeners = [...anyListeners];
      await resolvedPromise;
      for (const listener of staticListeners) {
        if (listeners.has(listener)) {
          await listener(eventData);
        }
      }
      for (const listener of staticAnyListeners) {
        if (anyListeners.has(listener)) {
          await listener(eventName, eventData);
        }
      }
    }
    onAny(listener, { signal } = {}) {
      assertListener(listener);
      this.logIfDebugEnabled("subscribeAny", void 0, void 0);
      anyMap.get(this).add(listener);
      emitMetaEvent(this, listenerAdded, { listener });
      const offAny = () => {
        this.offAny(listener);
        signal?.removeEventListener("abort", offAny);
      };
      signal?.addEventListener("abort", offAny, { once: true });
      if (signal?.aborted) {
        offAny();
      }
      return offAny;
    }
    anyEvent() {
      return iterator(this);
    }
    offAny(listener) {
      assertListener(listener);
      this.logIfDebugEnabled("unsubscribeAny", void 0, void 0);
      emitMetaEvent(this, listenerRemoved, { listener });
      anyMap.get(this).delete(listener);
    }
    clearListeners(eventNames) {
      eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
      for (const eventName of eventNames) {
        this.logIfDebugEnabled("clear", eventName, void 0);
        if (isEventKeyType(eventName)) {
          const set = getListeners(this, eventName);
          if (set) {
            set.clear();
          }
          const producers = getEventProducers(this, eventName);
          if (producers) {
            for (const producer of producers) {
              producer.finish();
            }
            producers.clear();
          }
        } else {
          anyMap.get(this).clear();
          for (const [eventName2, listeners] of eventsMap.get(this).entries()) {
            listeners.clear();
            eventsMap.get(this).delete(eventName2);
          }
          for (const [eventName2, producers] of producersMap.get(this).entries()) {
            for (const producer of producers) {
              producer.finish();
            }
            producers.clear();
            producersMap.get(this).delete(eventName2);
          }
        }
      }
    }
    listenerCount(eventNames) {
      eventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
      let count = 0;
      for (const eventName of eventNames) {
        if (isEventKeyType(eventName)) {
          count += anyMap.get(this).size + (getListeners(this, eventName)?.size ?? 0) + (getEventProducers(this, eventName)?.size ?? 0) + (getEventProducers(this)?.size ?? 0);
          continue;
        }
        if (eventName !== void 0) {
          assertEventName(eventName);
        }
        count += anyMap.get(this).size;
        for (const value of eventsMap.get(this).values()) {
          count += value.size;
        }
        for (const value of producersMap.get(this).values()) {
          count += value.size;
        }
      }
      return count;
    }
    bindMethods(target, methodNames) {
      if (typeof target !== "object" || target === null) {
        throw new TypeError("`target` must be an object");
      }
      methodNames = defaultMethodNamesOrAssert(methodNames);
      for (const methodName of methodNames) {
        if (target[methodName] !== void 0) {
          throw new Error(`The property \`${methodName}\` already exists on \`target\``);
        }
        Object.defineProperty(target, methodName, {
          enumerable: false,
          value: this[methodName].bind(this)
        });
      }
    }
  };
  var allEmitteryMethods = Object.getOwnPropertyNames(Emittery.prototype).filter((v) => v !== "constructor");
  Object.defineProperty(Emittery, "listenerAdded", {
    value: listenerAdded,
    writable: false,
    enumerable: true,
    configurable: false
  });
  Object.defineProperty(Emittery, "listenerRemoved", {
    value: listenerRemoved,
    writable: false,
    enumerable: true,
    configurable: false
  });

  // node_modules/@alien_org/contract/dist/index.mjs
  var PLATFORMS = ["ios", "android"];

  // node_modules/@alien_org/bridge/dist/index.mjs
  var BridgeError = class BridgeError2 extends Error {
    constructor(message) {
      super(message);
      this.name = "BridgeError";
      if (Error.captureStackTrace) Error.captureStackTrace(this, BridgeError2);
    }
  };
  var BridgeUnavailableError = class extends BridgeError {
    constructor() {
      super("Bridge is not available. This SDK requires Alien App environment.");
      this.name = "BridgeUnavailableError";
    }
  };
  var BridgeTimeoutError = class extends BridgeError {
    constructor(method, timeout) {
      super(`Request timeout: ${method} (${timeout}ms)`);
      __publicField(this, "method");
      __publicField(this, "timeout");
      this.name = "BridgeTimeoutError";
      this.method = method;
      this.timeout = timeout;
    }
  };
  function getBridge() {
    if (typeof window === "undefined") return;
    const bridge = window.__miniAppsBridge__;
    if (!bridge || typeof bridge.postMessage !== "function") return;
    return bridge;
  }
  function sendMessage(message) {
    const bridge = getBridge();
    if (!bridge) throw new BridgeUnavailableError();
    bridge.postMessage(JSON.stringify(message));
  }
  function isMessage(data) {
    return data !== null && typeof data === "object" && "type" in data && "name" in data && "payload" in data && (data.type === "event" || data.type === "method");
  }
  function setupMessageListener(handler) {
    if (typeof window === "undefined") return () => {
    };
    const messageHandler = (event) => {
      let data = event.data;
      if (typeof data === "string") try {
        data = JSON.parse(data);
      } catch {
        return;
      }
      if (isMessage(data)) handler(data);
    };
    window.addEventListener("message", messageHandler);
    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }
  var BridgeEmitter = class extends Emittery {
    constructor() {
      super();
      setupMessageListener((message) => {
        if (message.type === "event") this.emit(message.name, message.payload);
      });
    }
  };
  var emitter = new BridgeEmitter();
  function on(name, listener) {
    emitter.on(name, listener);
    return () => {
      emitter.off(name, listener);
    };
  }
  function off(name, listener) {
    emitter.off(name, listener);
  }
  var SESSION_STORAGE_KEY = "alien/launchParams";
  var LaunchParamsError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "LaunchParamsError";
    }
  };
  function validateVersion(value) {
    if (!value) return void 0;
    return /^\d+\.\d+\.\d+$/.test(value) ? value : void 0;
  }
  function validatePlatform(value) {
    if (!value) return void 0;
    return PLATFORMS.includes(value) ? value : void 0;
  }
  function validateSafeAreaInsets(value) {
    if (!value || typeof value !== "object") return void 0;
    const v = value;
    if (typeof v.top !== "number" || typeof v.right !== "number" || typeof v.bottom !== "number" || typeof v.left !== "number") return void 0;
    return {
      top: v.top,
      right: v.right,
      bottom: v.bottom,
      left: v.left
    };
  }
  function retrieveFromWindow() {
    if (typeof window === "undefined") return null;
    if (window.__ALIEN_AUTH_TOKEN__ === void 0) return null;
    return {
      authToken: window.__ALIEN_AUTH_TOKEN__,
      contractVersion: validateVersion(window.__ALIEN_CONTRACT_VERSION__),
      hostAppVersion: window.__ALIEN_HOST_VERSION__,
      platform: validatePlatform(window.__ALIEN_PLATFORM__),
      safeAreaInsets: validateSafeAreaInsets(window.__ALIEN_SAFE_AREA_INSETS__),
      startParam: window.__ALIEN_START_PARAM__
    };
  }
  function retrieveFromSessionStorage() {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return parseLaunchParams(raw);
    } catch {
      return null;
    }
  }
  function persistToSessionStorage(params) {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(params));
    } catch {
    }
  }
  function parseLaunchParams(raw) {
    const parsed = JSON.parse(raw);
    return {
      authToken: parsed.authToken,
      contractVersion: validateVersion(parsed.contractVersion),
      hostAppVersion: parsed.hostAppVersion,
      platform: validatePlatform(parsed.platform),
      safeAreaInsets: validateSafeAreaInsets(parsed.safeAreaInsets),
      startParam: parsed.startParam
    };
  }
  function retrieveLaunchParams() {
    const fromWindow = retrieveFromWindow();
    if (fromWindow) {
      persistToSessionStorage(fromWindow);
      return fromWindow;
    }
    const fromStorage = retrieveFromSessionStorage();
    if (fromStorage) return fromStorage;
    throw new LaunchParamsError("Launch params not available. Running outside Alien App? Use mockLaunchParamsForDev() for development.");
  }
  function getLaunchParams() {
    try {
      return retrieveLaunchParams();
    } catch {
      return;
    }
  }
  function send(method, payload) {
    sendMessage({
      type: "method",
      name: method,
      payload
    });
  }
  function isBridgeAvailable() {
    return getBridge() !== void 0;
  }
  var DEFAULT_TIMEOUT = 3e4;
  function generateReqId() {
    return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  }
  async function request(method, params, responseEvent, options = {}) {
    const reqId = options.reqId || generateReqId();
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const payload = {
      ...params,
      reqId
    };
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new BridgeTimeoutError(String(method), timeout));
      }, timeout);
      const cleanup = () => {
        clearTimeout(timeoutId);
        off(responseEvent, handleResponse);
      };
      const handleResponse = (payload$1) => {
        if (payload$1.reqId === reqId) {
          cleanup();
          resolve(payload$1);
        }
      };
      on(responseEvent, handleResponse);
      sendMessage({
        type: "method",
        name: method,
        payload
      });
    });
  }

  // src/shared.js
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
          try {
            const payload = params.authToken.split(".")[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
            this.alienId = decoded.sub || decoded.alienId || "alien_user_unknown";
          } catch (e) {
            console.warn("Failed to decode auth token:", e);
            this.alienId = "alien_user_" + Date.now();
          }
        } else {
          this.alienId = "alien_user_" + Date.now();
        }
        send("app:ready", {});
        return { alienId: this.alienId, verified: true };
      } else {
        console.log("[Pulse] Not running in Alien app — using dev mock");
        this.isAlienApp = false;
        this.alienId = "dev_user_" + Math.random().toString(36).substr(2, 8);
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
        const confirmed = confirm(`[DEV MODE] Simulate paying $${amount}?`);
        return confirmed ? { success: true, txId: "mock_tx_" + Date.now() } : { success: false, txId: null };
      }
      try {
        const invoice = "tip-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
        const amountInSmallestUnit = String(Math.round(amount * 1e6));
        const response = await request(
          "payment:request",
          {
            recipient: to,
            amount: amountInSmallestUnit,
            token: "USDC",
            network: "solana",
            invoice,
            item: {
              title: `$${amount.toFixed(2)} tip`,
              iconUrl: "",
              quantity: 1
            }
          },
          "payment:response",
          { timeout: 6e4 }
          // 60s timeout for user to confirm
        );
        if (response.status === "paid") {
          return { success: true, txId: response.txHash || invoice };
        } else if (response.status === "cancelled") {
          return { success: false, txId: null };
        } else {
          console.warn("Payment failed:", response.errorCode);
          return { success: false, txId: null };
        }
      } catch (error) {
        console.error("Payment error:", error);
        return { success: false, txId: null };
      }
    }
  };

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
    return '$' + parseFloat(amount).toFixed(2);
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

  // Alien Bridge - checks for real bridge at runtime
  const AlienBridge = {
    isAlienApp: false,
    alienId: null,

    /**
     * Initialize the bridge. Call this on page load.
     * Returns to user's alienId (from JWT) or a mock dev ID.
     */
    async init() {
      // The Alien app injects bridge globals into window at runtime
      // Check if we're inside Alien WebView
      if (typeof window.__alien_bridge__ !== 'undefined' || 
          typeof window.alien !== 'undefined' ||
          typeof window.AlienMiniApp !== 'undefined') {
        
        this.isAlienApp = true;
        console.log('[Pulse] Running inside Alien app');

        // Try to get auth token from various possible locations
        let authToken = null;
        try {
          const urlParams = new URLSearchParams(window.location.search);
          authToken = urlParams.get('authToken') || 
                          (window.__alien_launch_params__ && window.__alien_launch_params__.authToken) ||
                          null;
        } catch (e) {
          console.warn('[Pulse] Failed to get auth token from URL params:', e);
        }
        
        if (authToken) {
          // Decode JWT to get alienId (sub claim)
          // JWT is base64url encoded: header.payload.signature
          try {
            const payload = authToken.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            this.alienId = decoded.sub || decoded.alienId || 'alien_user_unknown';
          } catch (e) {
            console.warn('[Pulse] Failed to decode auth token:', e);
            this.alienId = 'alien_user_' + Date.now();
          }
        } else {
          // Fallback: use a unique ID from the bridge or generate one
          this.alienId = 'alien_user_' + Date.now();
        }

        // Signal to the host app that we're ready
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(JSON.stringify({ type: 'app:ready', payload: {} }), '*');
          }
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.alienBridge) {
            window.webkit.messageHandlers.alienBridge.postMessage(JSON.stringify({ type: 'app:ready', payload: {} }));
          }
          if (window.AlienBridgeNative) {
            window.AlienBridgeNative.postMessage(JSON.stringify({ type: 'app:ready', payload: {} }));
          }
        } catch (e) {
          // Ignore - best effort
        }

        return { alienId: this.alienId, verified: true };

      } else {
        // Dev mode — mock
        console.log('[Pulse] Not in Alien app — using dev mock');
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

      // Real Alien payment via bridge
      try {
        // Create an invoice ID for this payment
        const invoice = 'tip-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

        // Convert dollar amount to USDC smallest units (6 decimals)
        // $1.00 = "1000000"
        const amountInSmallestUnit = String(Math.round(amount * 1_000_000));

        const paymentRequest = {
          type: 'payment:request',
          payload: {
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
          }
        };

        // Send payment request through whatever bridge mechanism is available
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Payment timeout'));
          }, 60000);

          const handler = (event) => {
            try {
              const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              if (data.type === 'payment:response') {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                resolve(data.payload || data);
              }
            } catch (e) { /* ignore non-JSON messages */ }
          };

          window.addEventListener('message', handler);

          // Try all possible bridge communication channels
          const msg = JSON.stringify(paymentRequest);
          
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.alienBridge) {
            window.webkit.messageHandlers.alienBridge.postMessage(msg);
          } else if (window.AlienBridgeNative) {
            window.AlienBridgeNative.postMessage(msg);
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(msg, '*');
          }
        });

        if (result.status === 'paid') {
          return { success: true, txId: result.txHash || invoice };
        } else if (result.status === 'cancelled') {
          return { success: false, txId: null };
        } else {
          // failed
          console.warn('Payment failed:', result.errorCode);
          return { success: false, txId: null };
        }

      } catch (error) {
        console.error('[Pulse] Payment error:', error);
        // Fallback to mock if bridge communication fails
        const confirmed = confirm('Payment bridge unavailable. Simulate paying $' + amount + '?');
        return confirmed
          ? { success: true, txId: 'fallback_tx_' + Date.now() }
          : { success: false, txId: null };
      }
    }
  };
})();
//# sourceMappingURL=shared.js.map
// =====================
// WebSocket Helper
// =====================
function createWebSocket(roomId, alienId, role, onMessage, onStatus) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = protocol + '//' + window.location.host;
  let ws = null;
  let reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = function() {
      reconnectDelay = 1000;
      if (onStatus) onStatus('connected');
      ws.send(JSON.stringify({ type: 'join', roomId: roomId, alienId: alienId, role: role }));
    };

    ws.onmessage = function(event) {
      try {
        var data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = function() {
      if (onStatus) onStatus('reconnecting');
      setTimeout(function() {
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        connect();
      }, reconnectDelay);
    };

    ws.onerror = function() {
      if (onStatus) onStatus('disconnected');
      ws.close();
    };
  }

  connect();
  return ws;
}

// =====================
// Toast Notification
// =====================
function showToast(message) {
  var toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#393939;color:#f4f4f4;padding:12px 24px;font-size:14px;font-family:IBM Plex Sans,sans-serif;border-left:4px solid #ff8389;z-index:9999;';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// =====================
// Formatting Helpers
// =====================
function formatCurrency(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

function formatTime(ts) {
  var d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
