// Lightweight transport abstraction for frontend (JS-only)
// - Uses native WebSocket under the hood
// - Exposes a minimal API to decouple app code from direct WebSocket usage

(function initRealtimeClientFactory(global) {
  function createRealtimeClient(options) {
    const wsUrl = options && options.wsUrl ? options.wsUrl : null;
    const injectedWebSocket = options && options.wsCtor ? options.wsCtor : (global && global.WebSocket ? global.WebSocket : null);
    if (!injectedWebSocket) {
      throw new Error('WebSocket constructor not available');
    }

    let ws = null;
    let openHandlers = [];
    let messageHandlers = [];
    let closeHandlers = [];
    let errorHandlers = [];

    function callHandlers(handlers, arg) {
      for (const h of handlers) {
        try { h(arg); } catch (_) {}
      }
    }

    function connect(urlOverride) {
      const urlToUse = urlOverride || wsUrl;
      if (!urlToUse) {
        throw new Error('RealtimeClient: wsUrl not provided');
      }
      ws = new injectedWebSocket(urlToUse);
      ws.onopen = () => callHandlers(openHandlers);
      ws.onmessage = (evt) => callHandlers(messageHandlers, evt);
      ws.onclose = (evt) => callHandlers(closeHandlers, evt);
      ws.onerror = (err) => callHandlers(errorHandlers, err);
    }

    function isOpen() {
      return ws && ws.readyState === injectedWebSocket.OPEN;
    }

    function onOpen(cb) { openHandlers.push(cb); return () => { openHandlers = openHandlers.filter(h => h !== cb); }; }
    function onMessage(cb) { messageHandlers.push(cb); return () => { messageHandlers = messageHandlers.filter(h => h !== cb); }; }
    function onClose(cb) { closeHandlers.push(cb); return () => { closeHandlers = closeHandlers.filter(h => h !== cb); }; }
    function onError(cb) { errorHandlers.push(cb); return () => { errorHandlers = errorHandlers.filter(h => h !== cb); }; }

    function sendJSON(obj) {
      if (!isOpen()) return false;
      ws.send(JSON.stringify(obj));
      return true;
    }

    function close(code, reason) {
      if (ws) ws.close(code, reason);
    }

    // Convenience helpers mirroring current app messages
    function registerTeacher(teacherId, languageCode) {
      return sendJSON({ type: 'register', role: 'teacher', languageCode, teacherId });
    }
    function sendTranscription(text) {
      return sendJSON({ type: 'transcription', text, timestamp: Date.now(), isFinal: true });
    }
    function sendPong() {
      return sendJSON({ type: 'pong', timestamp: Date.now() });
    }
    function sendAudioChunk(sessionId, base64Data, isFirstChunk, isFinalChunk, language) {
      return sendJSON({ type: 'audio', sessionId, data: base64Data, isFirstChunk: !!isFirstChunk, isFinalChunk: !!isFinalChunk, language });
    }

    return {
      connect,
      isOpen,
      onOpen,
      onMessage,
      onClose,
      onError,
      sendJSON,
      close,
      registerTeacher,
      sendTranscription,
      sendPong,
      sendAudioChunk,
    };
  }

  const factory = { create: createRealtimeClient };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory;
  }
  if (typeof global !== 'undefined') {
    global.RealtimeClientFactory = factory;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));


