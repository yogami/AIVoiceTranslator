(function initRTCExperiment(global) {
  if (!global || global.RTC_EXPERIMENT !== '1') {
    return; // Disabled by default; enable by setting window.RTC_EXPERIMENT='1'
  }

  const state = {
    pc: null,
    dc: null,
    sessionId: null,
  };

  function getSocket() {
    try {
      // teacher.js stores appState on the closure; expose ws via global if needed
      if (global.appState && global.appState.ws && global.appState.ws.readyState === WebSocket.OPEN) return global.appState.ws;
    } catch (_) {}
    return null;
  }

  function send(msg) {
    const ws = getSocket();
    if (!ws) return;
    try { ws.send(JSON.stringify(msg)); } catch (_) {}
  }

  async function startOffer(sessionId) {
    if (!('RTCPeerConnection' in global)) {
      console.warn('[RTCExperiment] RTCPeerConnection not available in this browser');
      return;
    }
    state.sessionId = sessionId || (global.appState && global.appState.sessionId) || null;
    if (!state.sessionId) {
      console.warn('[RTCExperiment] No sessionId available for signaling');
      return;
    }
    if (state.pc) { try { state.pc.close(); } catch(_){} }
    const pc = new RTCPeerConnection({ iceServers: [] });
    state.pc = pc;
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        send({ type: 'webrtc_ice_candidate', sessionId: state.sessionId, candidate: ev.candidate });
      }
    };
    const dc = pc.createDataChannel('data');
    state.dc = dc;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'webrtc_offer', sessionId: state.sessionId, sdp: offer.sdp });
      console.log('[RTCExperiment] Offer sent');
    } catch (e) {
      console.error('[RTCExperiment] Failed to create/send offer', e);
    }
  }

  async function applyServerAnswer(answer) {
    if (!state.pc || !answer) return;
    try {
      const desc = typeof answer === 'string' ? { type: 'answer', sdp: answer } : answer;
      await state.pc.setRemoteDescription(new RTCSessionDescription(desc));
      console.log('[RTCExperiment] Applied server answer');
    } catch (e) {
      console.error('[RTCExperiment] Failed to apply server answer', e);
    }
  }

  async function addServerIce(candidate) {
    if (!state.pc || !candidate) return;
    try {
      await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('[RTCExperiment] addIceCandidate failed', e);
    }
  }

  global.RTCExperiment = {
    startOffer,
    applyServerAnswer,
    addServerIce,
    getState: () => ({ ...state }),
  };
})(typeof window !== 'undefined' ? window : this);


