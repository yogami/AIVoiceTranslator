# WebRTC Experiment - Current Status and How to Run

## Status

- Signaling messages implemented over existing realtime transport (WebSocket):
  - `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `webrtc_sync`
- In-memory signaling store to persist/relay SDP and ICE per session
- Experimental server-side `PeerManager` (node `wrtc`) that can auto-answer offers when `REALTIME_WEBRTC_ALLOW_EXPERIMENT=1`
- Protocol-agnostic `RealtimeApp` wires signaling handler; guarded by `REALTIME_APP_ENABLED=1`
- Client-side `rtcExperiment.js` to initiate offer and process server answer/ICE
- Teacher UI can enable experiment via `?rtc=1` URL flag. When enabled, it auto-starts an offer after register

## How to run

1. Set environment flags when starting the server:
   - `REALTIME_APP_ENABLED=1` (enable protocol-agnostic dispatcher)
   - `REALTIME_WEBRTC_ALLOW_EXPERIMENT=1` (enable `PeerManager` and server auto-answer)
2. Ensure `wrtc` is installed if you want server auto-answer locally. If not installed, server will log a warning and skip DataChannel setup; signaling relay still works.
3. Open Teacher UI with experiment enabled: `/teacher?rtc=1`
4. After register succeeds, the page will automatically send a `webrtc_offer`. On success, the console will show that an answer was applied and ICE candidates exchanged.

## Next steps

- Implement full `WebRTCTransportAdapter` to route app messages over RTCDataChannel
- Add session/connection indexing for RTC peers and broadcast-to-session routing
- Wire student UI to participate in P2P offer/answer flow instead of server auto-answer
- Add tests for end-to-end RTC signaling and DataChannel messaging


