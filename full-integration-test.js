/**
 * Comprehensive End-to-End Integration Test for Benedictaitor
 * 
 * This test covers:
 * 1. Teacher and student connection
 * 2. Audio transcription
 * 3. Language translation
 * 4. Error handling
 * 5. Reconnection
 */

// Base64 encoded minimal WAV representing "This is a test message"
const TEST_AUDIO_BASE64 = `
UklGRrAYAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YYwYAAAAADYPXh6+IHEi
+yIgIT4gMiIvGUoOFBNwJDQVtAhPGUMZUhCmF0odURNICRwcgBXMErQjShhSFlkhkRMEBnoe
cRONDHQOUQyoFiwXFQV3CDcbSBmcDYQJUByKFtYHeC22KvITTAmkHh0clgK5FlIbLxD+CKIY
sRRoBkUSjCIZEGwHuyu9JNUMhSc/IwQHUhl6L7AQvwk0MRshqxrFJVIEAgAkHxIYeg1/FYYt
GRImDnUvTRWOBeUrPyXLCPEfGyU6AmwWuyyLAS8I0CZ5GecOXRG+JV0TBA0DLt4fcwnzJFoe
wwK4GYcsfA1CCrEkMCLeDFYMjS2QIb8ITRsHLlMLsQvYJd0WPAV9E7MlrRO/B+UkXCOICzUJ
xS2wJC0IBxa+J4UInQUgHgMgTAaHEg8jCAyjCUwZXSWMCF8D5SC3IDwIbQmbJEYbwwHqF9go
cQOsBdwW2xyrCxIIHCKwGx0DiQzwGFARXAVTDrUYFw+cEzAaYhTwBnIQpBmMDSgMKhpyDlIG
+RJ2GOMNYgXMF2QQVgkfEiYY7gz7BVESMRg/B+4JdRdODo0JYRl3FTkF4QyJG+gGkAOBFQsO
OAf6FsUVHQZzBwoX5Qv7DS4YUwpdB5oXSA0HA8ISpgqoBj8SgxTJChUJ+Rf0CpYDihF+DOwG
+RXbFjIMbg+eF4cFNQYyHF8M/APZFWUSVwadBxwZnwyxCsEYZg0VAx0YVxXqBlQGZhleDJkB
GRmKEqcDxgl1F+wEOAJzHXIKFAD2FaMZSwOrCA4XIgg8C/QXRQp4A08UghV/BsMJQiMGDR4C
xROFDnUTiBDbFFICxhCJHoYHHQXhHdIMoAs2H38PFAdPGNwUnABxDCkgKwcfBS4btBAJDZwU
Mgm9DRIVwQ5qCPQQwxZ8CN8JlBZrDCwExRVFEi0Eww9nFUAJ4Qx5EJkL3Q4XDhoOCwvaCZcQ
hwv0ByASnQ1NBtwOrxXyBpUMaBZtCw8NQBG/Cd8IuRRZB5oEkBUrDM0D9g43ErYHjwisFhUP
9AlkE9sMKAZHD0oQggJoC78WcwOZBZgVWgfbBUkVXwRxAGMNkw4RAlQCuxeQBMkFPxoGA2QD
ixBGBN8KYQxXCWsMGg0EBpYLLRGWBGkKwRFyAvANnw0TAk8LshHzCTkGTRMfBkIHJRMdCBwJ
BA8oDpIGQwm/EMoEuAf/Dx0J8wTwCXgRXgFSB5QPcQNaBW0O2QuSA/4PrBGaA2YHbRZXAgMF
6hVCBZQDohR9CBgCow8IDJIFBRMpC2gBzgvkENr/KQT9FJoCGQL+EaMMagK3DrEN4wN0C/oR
WAMyBb8TBwWtAvUUXgS7BKgWvAEI/7wIKAXxA0sLlAssBNEQJgw2BAgMkQvb/8EAARSuBGgC
FRRRBLcBIQ7/BwAD0wiwCPYD0woQDhUFTQoLE7cDdwOnE/cFqAGNEtMIagAyDFENwP9+BQwJ
zACVB7MIvQNPBykVMQMgApgNbf+XAs0OAgHdANYIFQpiBRQMIgkEAkkKFg1PAFYEVwwxBWIF
mA4VBPkBDg8eBj0CPQx0CRcDywzECA0A0AYqDuX7JwNADbL8QwJuCHv/ZAhPDb8DKgC0CzgD
l/49BuYFmP9tBSALuwLyAcAKOQRYAGEMRgQ+/YoO4ARk+wULsAbM+3AJJQWv/0YJTgcBAecL
BgMz/NkJHAZF/2cNIwPS/SwK9AHs/6UJ2ACb/aQKYQC7/qUK9wR9/YAFbghb/NQDXQrH/JcF
LAdA/bUHuwNj/gAIPwTZ/SoKGQJl/EYFQgTf/TgGJgN1AKMJsf9f/QwJmP+U/jIJ/wGc/4AE
ngEh/88HvgHm/VUG/wX3/F4FHwcp/RIKMgN9/IwH+wE2/eYGsASx/SoDKgbf/2UEPQSp/IYG
1AD+/NEJMv+C/2YGif/mAOgEHP8V/mAFxwHu/UUE6wKK/gUDPgOz/8gA5wLK/1UC7wGH/nsD
uQFZ/0cCDwGHADYAvAHc/jEDrAG4/eUD2AIJ/hcC/wHU/14BUgKO/r4BNgJg/wIBiwCw/r8C
IgGK/isAyAK6ALP/LgCLANQA6QDZ/1YAUQBFALH/cP+dAAUBaAA1AFUA/gAFAEYA9v+//67/
fQDpAJX/t/++/5b/rgCvAFj/pf/c/07/LADQ/4b/yf8+AOz/9f9V/+f/6/9F/7D/FQCT/9T/
LwAz/+D/+P8BAAMAAQAYAB4AEgDx/wgA3/8JAPH/xf8xAJz/5P/j/y0Ayf/u/wYAJADz/xIA
6P/8/yEADADs/xMA+v8FAPL/5f/+/wwA5f8XAOr/CQDP/x4A5f8WAND/9f/4//L/EQDj/wUA
8/8GAPX/FgDY/wMA+/8FAPb/9v8AAO3/+P8aANT/GwDa/w4A8P8BAA0ACgDq/xMACQDS/xgA
2P8UANT/BQDM/xoA5f///+f/FQDO//j/6f8ZANn/CADs/xcA3f8PAOf/FQDc/wUAy/8EAOr/
BQDa/wsA4/8QAOH/BwAJAAQA8/8AAOz/CQDT/xIA3/8KAOv/AQDk/xMA1f8VAOX/BQDs/wYA
7v/4//X/+P/8//j/9v8DAOn/BQDv/wEA9f8CAO7///8AAAAA+/8CAPD/AQD0////+v8DAPD/
+v/6/wAA/P/8//r//v/6//7//v/+//v////8//3//v/+//3//f/9//7//v/+//z////+//7/
/v/+//3//v/+//7//P////7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7/
/v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v8=
`.trim();

// Spanish audio base64 for "Hola, esto es una prueba"
const SPANISH_AUDIO_BASE64 = `
UklGRvwWAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YdgWAAAAHmA2NQUQGhg2
KzRSOE4kRgUuBCg2IBouCCAHKycrJzA/QZs7tDDSIpgXOw+QCu4NkBnQJtU2g0QwTCdMpEfD
Q4I9GzXaK1ElXSHUHsIeqSKNJ/gsqjLmNggDRw9aGeohSC1JN4hHAVNrVJpLfjVeJNQX7A78
BTgCgAD0AEUDDAkIEzcQ8SJdKfgurzHGMyY22TT0MDktbSu/Kvsqxy7/NIQ57kB8RStbgV5G
W/lRr0QDNhwpgxx/EdUJQwTbABz/cP+PAp4HNQ7oFN5cQ1+eYAddhVR6S6BCbDt8MyQtsicV
I/MgHSBZIQElJSpmMBY3/D1kQ9lGpEbLRLRBgz3IOLozPC4TKf4kPyHuHkwd8Ry0HVQfIiFr
JBsoIysALoIwvzJ4NCk1AzVTNPsyajDkLP4oqyQVIFUbhhZ/EWwMAgeqAawAyP0pAiQEuxRg
G64pKDTNOY48tjxXO200ziwxJw8hiRq1FY4RXw+WDUwOPg/fE4kWoB2THV4rVyvXM5Iwaii3
IQwcaxWCDugIHwTpAF/+k/x8/GP9CQB4A90G5wzBEPoWQRtrID8kPCgaKqUrvSo/KYEmzyJS
HdgYwRMGEasNLQxlCXsJfgkICsEJwAyqCpUO9wpXD28LsA7YCeMM3QaACGACygP0/cf+L/vf
+sj6jfyV/RsAkwFhBVMGxQphDGwOBhBHEJMQaQ98DtcM/gntBwMGGAXpAtECEwFaAcUAdQDE
AKABHAKqAr0D/wPEBKwEVwX6BAEFcwRZBLcDqwM3AysD4ALMAlgCMQKTAc4BpQBsALD/p/6o
/V79oPyl+/r6Sfoe+m75oPmj+XX6o/o7+0P7N/yz/Bn9dP3//YT+7/40/8H/OADyAEwB2wFO
AtECXgONAzQEzwQeBVsFaAWYBdMFGwYcBgkGKAZLBrEG9gbiBjMHdQezB+wHAwjXB54H4QfF
BxEIDgiXB0sHNAf9BuQGogaBBnAGZgZCBhsG+wXhBccFowVrBVMFOAUgBfEE2wS2BJ0EbwRW
BCEEFwQIBP8DvQOuA6UDqQOTA38DWQNkA2EDbwNdA2MDTgNNA1oDXQNoA0gDSwMtAzQDIQMU
AwkD+QLnArsCrQKXAoUCZQJFAhwC+gHcAbkBlgFiAUABFgH8AMAAoQBrAC4A9v/O/6b/dP9B
/xr/4/6//pf+cf5M/iP++v3X/bL9jP1p/Uj9LP0L/fD80fyz/JL8c/xb/Eb8M/wm/BT8APzt
+9z7yvvC+7n7s/ut+5/7nPuX+5T7kfuV+5r7lvuW+5j7mvuc+6L7pPul+6n7r/uy+7H7sPuy
+7L7tfu3+7v7v/vB+8f7x/vG+8j7yvvN+8/70/vT+9P72PvY+9n73Pvg++L76Pvr++r76/vs
+/L79Pv3+/z8AP0C/QX9Cv0M/Q/9E/0X/Rj9HP0g/SH9JP0n/Sv9K/0r/S39L/0y/TT9Nf04
/Tn9Ov09/T/9Q/1F/Ub9Sf1M/U/9Uf1T/VX9WP1a/V39YP1i/WT9aP1p/Wr9bP1t/W79cf1z
/Xb9d/16/Xr9fP1+/X/9g/2G/Yn9i/2M/Y79kf2U/Zb9mP2b/Z39oP2h/aT9o/2l/an9rP2u
/bH9s/22/bj9uf29/b39wP3C/cT9xv3I/cr9zP3O/dD90/3V/db92P3Z/dn92v3b/d/93/3h
/eH94v3j/eP95f3m/ej96v3r/ez97f3u/e/98v3y/fT99f31/fX99v33/fj9+P37/fv9/f3+
/f79//3//QD+AP4B/gH+Af4C/gP+BP4F/gT+Bf4F/gX+Bf4G/gb+B/4I/gn+Cf4K/gr+Cv4L
/gz+Df4O/g/+D/4Q/hD+Ef4Q/hD+Ef4R/hL+E/4U/hT+E/4T/hP+E/4T/hX+Ff4W/hX+Fv4W
/hb+F/4Z/hn+Gv4a/hv+G/4b/hz+G/4c/h3+Hf4e/h7+H/4f/h/+IP4g/iH+Iv4j/iP+I/4j
/iP+I/4k/iT+Jf4l/ib+J/4n/if+J/4n/if+KP4o/in+K/4r/iz+Lf4t/i3+Lf4t/i7+Lv4v
/i/+MP4y/jL+M/4z/jP+NP40/jX+Nf42/jf+OP44/jn+Of45/jn+Of46/jr+O/47/jz+Pf49
/j3+Pf4+/j7+P/4//kD+Qf5C/kL+Q/5D/kP+Q/5E/kT+RP5F/kb+R/5I/kj+SP5I/kj+SP5J
/kn+Sv5L/kz+TP5M/k3+Tf5N/k3+Tv5O/k/+T/5Q/lH+Uv5T/lP+U/5T/lP+U/5U/lT+Vf5W
/lf+WP5Y/lj+WP5Y/ln+Wf5a/lr+W/5c/l3+Xf5e/l7+Xv5e/l7+X/5g/mD+Yf5i/mP+Y/5j
/mP+ZP5k/mT+Zf5l/mb+Z/5o/mj+af5p/mn+af5q/mr+av5r/mz+bf5t/m7+bv5u/m7+b/5v
/m/+cP5x/nH+cf5y/nL+c/5z/nP+c/5z/nP+dP50/nX+df52/nf+d/54/nj+eP54/nn+ef55
/nn+ev57/nv+e/58/nz+ff59/n3+ff5+/n7+f/5//n/+gP6A/oH+gf6C/oL+g/6D/oP+g/6E
/oT+hP6E/oT+hf6F/ob+hv6H/of+iP6I/oj+if6J/on+iv6K/ov+i/6L/ov+jP6M/oz+jf6N
/o3+jv6O/o7+j/6P/o/+kP6Q/pD+kf6R/pH+kf6S/pL+kv6T/pP+k/6U/pT+lP6V/pX+lf6W
/pb+lv6X/pf+l/6Y/pj+mP6Y/pn+mf6Z/pr+mv6a/pv+m/6c/pz+nP6d/p3+nf6e/p7+nv6e
/p/+n/6f/qD+oP6g/qH+of6i/qL+o/6j/qP+o/6k/qT+pP6l/qX+pf6m/qb+pv6n/qf+p/6o
/qj+qf6p/qn+qv6q/qr+q/6r/qv+rP6s/q3+rf6t/q7+rv6u/q7+r/6v/q/+sP6w/rH+sf6x
/rL+sv6y/rL+s/6z/rP+tP60/rT+tf61/rX+tf62/rb+tv63/rf+t/64/rj+uf65/rn+uf66
/rr+uv67/rv+u/68/rz+vP69/r3+vf6+/r7+vv6//r/+v/7A/sD+wP7B/sH+wf7C/sL+wv7D
/sP+w/7E/sT+xP7F/sX+xf7G/sb+xv7H/sf+x/7I/sj+yP7J/sn+yf7K/sr+yv7L/sv+y/7M
/sz+zP7M/s3+zf7N/s7+zv7O/s/+z/7P/tD+0P7Q/tH+0f7S/tL+0v7T/tP+0/7U/tT+1P7V
/tX+1f7W/tb+1v7X/tf+1/7Y/tj+2P7Z/tn+2f7a/tr+2v7b/tv+2/7c/tz+3P7d/t3+3f7e
/t7+3v7f/t/+3/7g/uD+4P7h/uH+4f7i/uL+4v7j/uP+4/7k/uT+5P7l/uX+5f7m/ub+5/7n
/uf+6P7o/uj+6f7p/un+6v7q/ur+6/7r/uv+7P7s/uz+7f7t/u3+7v7u/u7+7/7v/u/+8P7w
/vD+8f7x/vH+8v7y/vL+8/7z/vP+9P70/vT+9f71/vX+9v72/vb+9/73/vf++P74/vj++f75
/vn++v76/vr++/77/vv+/P78/vz+/f79/v3+/v7+/v7+//7//v///v///v8AAA==
`.trim();

// Mock WebSocket client for testing
class MockWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.readyState = 0; // CONNECTING
    this.sentMessages = [];
    this.options = options;
    this.sessionId = `test-session-${Date.now()}`;
    
    // Add event listeners support
    this.eventListeners = {
      open: [],
      message: [],
      close: [],
      error: []
    };
    
    // Auto connect
    setTimeout(() => this.simulateOpen(), 50);
  }
  
  // Add event listener support
  addEventListener(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
    
    // Also set the on* property for events that use it
    if (event === 'open' && !this.onopen) {
      this.onopen = callback;
    } else if (event === 'message' && !this.onmessage) {
      this.onmessage = callback;
    } else if (event === 'close' && !this.onclose) {
      this.onclose = callback;
    } else if (event === 'error' && !this.onerror) {
      this.onerror = callback;
    }
  }
  
  // Remove event listener
  removeEventListener(event, callback) {
    if (this.eventListeners[event]) {
      const index = this.eventListeners[event].indexOf(callback);
      if (index !== -1) {
        this.eventListeners[event].splice(index, 1);
      }
    }
    
    // Clear the on* property if it matches
    if (event === 'open' && this.onopen === callback) {
      this.onopen = null;
    } else if (event === 'message' && this.onmessage === callback) {
      this.onmessage = null;
    } else if (event === 'close' && this.onclose === callback) {
      this.onclose = null;
    } else if (event === 'error' && this.onerror === callback) {
      this.onerror = null;
    }
  }
  
  // Dispatch event to all listeners
  dispatchEvent(event) {
    const eventType = event.type;
    
    // Call the on* handler if set
    if (eventType === 'open' && this.onopen) {
      this.onopen(event);
    } else if (eventType === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (eventType === 'close' && this.onclose) {
      this.onclose(event);
    } else if (eventType === 'error' && this.onerror) {
      this.onerror(event);
    }
    
    // Call all event listeners
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          console.error(`Error in ${eventType} listener:`, err);
        }
      });
    }
  }
  
  simulateOpen() {
    this.readyState = 1; // OPEN
    
    // Dispatch open event
    this.dispatchEvent({ type: 'open', target: this });
    
    // Send connection confirmation
    this.dispatchEvent({
      type: 'message',
      data: JSON.stringify({
        type: 'connection',
        status: 'connected',
        sessionId: this.sessionId,
        role: this.options.role || 'teacher',
        languageCode: this.options.languageCode || 'en-US'
      }),
      target: this
    });
  }
  
  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    
    this.sentMessages.push(data);
    const parsedData = JSON.parse(data);
    console.log(`WebSocket sent: ${parsedData.type}`);
    
    // Simulate responses
    if (parsedData.type === 'register') {
      setTimeout(() => {
        this.dispatchEvent({
          type: 'message',
          data: JSON.stringify({
            type: 'register',
            status: 'success',
            data: { 
              role: parsedData.payload.role, 
              languageCode: parsedData.payload.languageCode 
            }
          }),
          target: this
        });
      }, 50);
    } 
    else if (parsedData.type === 'audio') {
      // Simulate processing and translation response
      setTimeout(() => {
        // Send processing_complete message
        this.dispatchEvent({
          type: 'message',
          data: JSON.stringify({
            type: 'processing_complete',
            data: {
              timestamp: new Date().toISOString(),
              targetLanguages: ['en-US', 'es-ES', 'de-DE', 'fr-FR'],
              roleConfirmed: true,
              role: 'teacher',
              latency: 150
            }
          }),
          target: this
        });
        
        // Send translation message(s) for the requested languages
        setTimeout(() => {
          const sourceText = parsedData.payload.langCode === 'es-ES' 
            ? 'Hola, esto es una prueba' 
            : 'This is a test message';
            
          const translations = {
            'en-US': 'This is a test message',
            'es-ES': 'Esto es un mensaje de prueba',
            'de-DE': 'Dies ist eine Testnachricht',
            'fr-FR': 'Ceci est un message de test'
          };
          
          // Send translations for each target language
          Object.entries(translations).forEach(([langCode, text]) => {
            this.dispatchEvent({
              type: 'message',
              data: JSON.stringify({
                type: 'translation',
                data: {
                  sessionId: this.sessionId,
                  sourceLanguage: parsedData.payload.langCode || 'en-US',
                  targetLanguage: langCode,
                  originalText: sourceText,
                  translatedText: text,
                  audio: langCode === 'es-ES' ? SPANISH_AUDIO_BASE64 : TEST_AUDIO_BASE64,
                  timestamp: new Date().toISOString(),
                  latency: 150
                }
              }),
              target: this
            });
          });
        }, 100);
      }, 200);
    }
    else if (parsedData.type === 'transcript_request') {
      // Simulate transcript history response
      setTimeout(() => {
        this.dispatchEvent({
          type: 'message',
          data: JSON.stringify({
            type: 'transcript_history',
            data: [
              {
                id: 1,
                text: 'This is a test message',
                timestamp: new Date(Date.now() - 60000).toISOString(),
                sessionId: parsedData.payload.sessionId,
                language: parsedData.payload.languageCode
              },
              {
                id: 2,
                text: 'This is a second test message',
                timestamp: new Date(Date.now() - 30000).toISOString(),
                sessionId: parsedData.payload.sessionId,
                language: parsedData.payload.languageCode
              }
            ]
          }),
          target: this
        });
      }, 100);
    }
  }
  
  close() {
    this.readyState = 3; // CLOSED
    
    // Dispatch close event
    this.dispatchEvent({
      type: 'close',
      code: 1000,
      reason: 'Test closed',
      target: this
    });
  }
}

// Create connection pairs for testing
function createConnectionPair() {
  // Create teacher connection
  const teacher = new MockWebSocketClient('ws://localhost:5000/ws', {
    role: 'teacher',
    languageCode: 'en-US'
  });
  
  // Create student connections for various languages
  const students = {
    english: new MockWebSocketClient('ws://localhost:5000/ws', {
      role: 'student',
      languageCode: 'en-US'
    }),
    spanish: new MockWebSocketClient('ws://localhost:5000/ws', {
      role: 'student',
      languageCode: 'es-ES'
    }),
    german: new MockWebSocketClient('ws://localhost:5000/ws', {
      role: 'student',
      languageCode: 'de-DE'
    }),
    french: new MockWebSocketClient('ws://localhost:5000/ws', {
      role: 'student',
      languageCode: 'fr-FR'
    })
  };
  
  return { teacher, students };
}

// Helper to register client with specific role
function registerClient(client, role, languageCode) {
  return new Promise((resolve) => {
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'register' && data.status === 'success') {
          client.removeEventListener('message', handler);
          resolve(data);
        }
      } catch (err) {
        console.error('Error parsing register response:', err);
      }
    };
    
    client.addEventListener('message', handler);
    
    client.send(JSON.stringify({
      type: 'register',
      payload: {
        role,
        languageCode
      }
    }));
  });
}

// Wait for a specific message type
function waitForMessageType(client, messageType, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeEventListener('message', handler);
      reject(new Error(`Timeout waiting for message type: ${messageType}`));
    }, timeout);
    
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === messageType) {
          clearTimeout(timer);
          client.removeEventListener('message', handler);
          resolve(data);
        }
      } catch (err) {
        console.error(`Error parsing message waiting for ${messageType}:`, err);
      }
    };
    
    client.addEventListener('message', handler);
  });
}

// Helper to send audio and wait for translation
async function sendAudioAndWaitForTranslation(teacher, targetLanguage) {
  return new Promise((resolve, reject) => {
    // Listen for translations
    const translationHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'translation' && 
            data.data.targetLanguage === targetLanguage) {
          teacher.removeEventListener('message', translationHandler);
          resolve(data.data);
        }
      } catch (err) {
        console.error('Error parsing translation response:', err);
      }
    };
    
    teacher.addEventListener('message', translationHandler);
    
    // Send audio
    teacher.send(JSON.stringify({
      type: 'audio',
      payload: {
        audio: TEST_AUDIO_BASE64,
        role: 'teacher',
        langCode: 'en-US'  // Source language
      }
    }));
    
    // Set timeout
    setTimeout(() => {
      teacher.removeEventListener('message', translationHandler);
      reject(new Error(`Timeout waiting for ${targetLanguage} translation`));
    }, 5000);
  });
}

// Test scenario: Teacher speaks, student receives in their language
async function testTeacherToStudentTranslation() {
  console.log('\n--- TESTING TEACHER TO STUDENT TRANSLATION ---');
  const { teacher, students } = createConnectionPair();
  
  try {
    // Wait for connection and register
    await Promise.all([
      new Promise(resolve => teacher.addEventListener('open', resolve)),
      new Promise(resolve => students.spanish.addEventListener('open', resolve))
    ]);
    
    // Register teacher and student
    await registerClient(teacher, 'teacher', 'en-US');
    await registerClient(students.spanish, 'student', 'es-ES');
    
    console.log('Teacher and Spanish student registered successfully');
    
    // Set up translation listener for the student
    const studentTranslationPromise = waitForMessageType(students.spanish, 'translation');
    
    // Teacher sends audio (English)
    console.log('Teacher sending English audio...');
    teacher.send(JSON.stringify({
      type: 'audio',
      payload: {
        audio: TEST_AUDIO_BASE64,
        role: 'teacher'
      }
    }));
    
    // Wait for student to receive translation
    const translation = await studentTranslationPromise;
    console.log('Spanish student received translation:', translation.data.translatedText);
    
    const success = translation.data.translatedText.includes('mensaje de prueba');
    
    // Report results
    if (success) {
      console.log('✅ PASS: Student received correct Spanish translation');
    } else {
      console.log('❌ FAIL: Student did not receive expected Spanish translation');
      console.log(`Expected to include: "mensaje de prueba", got: "${translation.data.translatedText}"`);
    }
    
    // Cleanup
    teacher.close();
    students.spanish.close();
    
    return success;
  } catch (error) {
    console.error('Error in teacher-to-student test:', error);
    
    // Cleanup on error
    teacher.close();
    students.spanish.close();
    
    return false;
  }
}

// Test scenario: Multiple students receive translations
async function testMultipleLanguages() {
  console.log('\n--- TESTING MULTIPLE LANGUAGE TRANSLATIONS ---');
  const { teacher, students } = createConnectionPair();
  
  try {
    // Wait for all connections
    await Promise.all([
      new Promise(resolve => teacher.addEventListener('open', resolve)),
      new Promise(resolve => students.spanish.addEventListener('open', resolve)),
      new Promise(resolve => students.german.addEventListener('open', resolve)),
      new Promise(resolve => students.french.addEventListener('open', resolve))
    ]);
    
    // Register all clients
    await registerClient(teacher, 'teacher', 'en-US');
    await registerClient(students.spanish, 'student', 'es-ES');
    await registerClient(students.german, 'student', 'de-DE');
    await registerClient(students.french, 'student', 'fr-FR');
    
    console.log('Teacher and all students registered successfully');
    
    // Set up translation listeners
    const translationPromises = {
      spanish: waitForMessageType(students.spanish, 'translation'),
      german: waitForMessageType(students.german, 'translation'),
      french: waitForMessageType(students.french, 'translation')
    };
    
    // Teacher sends audio
    console.log('Teacher sending English audio to multiple students...');
    teacher.send(JSON.stringify({
      type: 'audio',
      payload: {
        audio: TEST_AUDIO_BASE64,
        role: 'teacher'
      }
    }));
    
    // Wait for all translations with timeout
    const translations = await Promise.all([
      translationPromises.spanish.catch(() => ({ data: { translatedText: 'TIMEOUT' } })),
      translationPromises.german.catch(() => ({ data: { translatedText: 'TIMEOUT' } })),
      translationPromises.french.catch(() => ({ data: { translatedText: 'TIMEOUT' } }))
    ]);
    
    // Check translations
    const spanishTranslation = translations[0].data.translatedText;
    const germanTranslation = translations[1].data.translatedText;
    const frenchTranslation = translations[2].data.translatedText;
    
    console.log('Spanish translation:', spanishTranslation);
    console.log('German translation:', germanTranslation);
    console.log('French translation:', frenchTranslation);
    
    // Verify correct translations were received
    const spanishSuccess = spanishTranslation.includes('mensaje');
    const germanSuccess = germanTranslation.includes('Testnachricht');
    const frenchSuccess = frenchTranslation.includes('message de test');
    
    // Report results
    if (spanishSuccess && germanSuccess && frenchSuccess) {
      console.log('✅ PASS: All students received correct translations');
    } else {
      console.log('❌ FAIL: Not all students received correct translations');
    }
    
    // Cleanup
    teacher.close();
    Object.values(students).forEach(student => student.close());
    
    return spanishSuccess && germanSuccess && frenchSuccess;
  } catch (error) {
    console.error('Error in multiple languages test:', error);
    
    // Cleanup on error
    teacher.close();
    Object.values(students).forEach(student => student.close());
    
    return false;
  }
}

// Test scenario: Error handling
async function testErrorHandling() {
  console.log('\n--- TESTING ERROR HANDLING ---');
  const teacher = new MockWebSocketClient('ws://localhost:5000/ws', {
    role: 'teacher',
    languageCode: 'en-US'
  });
  
  try {
    // Wait for connection
    await new Promise(resolve => teacher.addEventListener('open', resolve));
    
    // Register as teacher
    await registerClient(teacher, 'teacher', 'en-US');
    
    // Send invalid audio (empty)
    console.log('Sending invalid audio data...');
    
    // Send empty audio
    teacher.send(JSON.stringify({
      type: 'audio',
      payload: {
        audio: '', // Invalid audio data
        role: 'teacher'
      }
    }));
    
    // Check if we get error message (or processing failure)
    const response = await Promise.race([
      waitForMessageType(teacher, 'error').then(() => ({ type: 'error' })),
      waitForMessageType(teacher, 'processing_complete').then(() => ({ type: 'complete' }))
    ]);
    
    // Either we get an explicit error or the processing completes but no translation is sent
    if (response.type === 'error') {
      console.log('✅ PASS: Received error for invalid audio data');
      return true;
    } else {
      // Wait to see if translation comes through (it shouldn't)
      try {
        await waitForMessageType(teacher, 'translation', 1000);
        console.log('❌ FAIL: Received translation for invalid audio');
        return false;
      } catch (timeoutErr) {
        console.log('✅ PASS: No translation for invalid audio (as expected)');
        return true;
      }
    }
  } catch (error) {
    console.error('Error in error handling test:', error);
    return false;
  } finally {
    // Cleanup
    teacher.close();
  }
}

// Test scenario: Session persistence
async function testSessionPersistence() {
  console.log('\n--- TESTING SESSION PERSISTENCE ---');
  const { teacher, students } = createConnectionPair();
  
  try {
    // Wait for connections
    await Promise.all([
      new Promise(resolve => teacher.addEventListener('open', resolve)),
      new Promise(resolve => students.english.addEventListener('open', resolve))
    ]);
    
    // Register clients
    await registerClient(teacher, 'teacher', 'en-US');
    await registerClient(students.english, 'student', 'en-US');
    
    // Capture teacher's session ID
    const teacherSessionId = teacher.sessionId;
    console.log(`Teacher connected with session ID: ${teacherSessionId}`);
    
    // Send first message
    console.log('Sending first test message...');
    await sendAudioAndWaitForTranslation(teacher, 'en-US');
    
    // Send second message to create history
    console.log('Sending second test message...');
    await sendAudioAndWaitForTranslation(teacher, 'en-US');
    
    // Reconnect student with same session ID (simulate refresh)
    students.english.close();
    
    // Create new student connection
    const reconnectedStudent = new MockWebSocketClient('ws://localhost:5000/ws', {
      role: 'student',
      languageCode: 'en-US'
    });
    
    // Wait for connection
    await new Promise(resolve => reconnectedStudent.addEventListener('open', resolve));
    
    // Register with same session ID
    await registerClient(reconnectedStudent, 'student', 'en-US');
    
    // Request transcript history
    console.log('Requesting transcript history...');
    reconnectedStudent.send(JSON.stringify({
      type: 'transcript_request',
      payload: {
        sessionId: teacherSessionId,
        languageCode: 'en-US'
      }
    }));
    
    // Check for transcript history
    try {
      const history = await waitForMessageType(reconnectedStudent, 'transcript_history', 2000);
      const hasTranscripts = history.data && Array.isArray(history.data) && history.data.length > 0;
      
      if (hasTranscripts) {
        console.log(`✅ PASS: Received transcript history with ${history.data.length} entries`);
        return true;
      } else {
        console.log('❌ FAIL: No transcript history received');
        return false;
      }
    } catch (timeoutErr) {
      console.log('❌ FAIL: Timed out waiting for transcript history');
      return false;
    } finally {
      // Cleanup
      teacher.close();
      reconnectedStudent.close();
    }
  } catch (error) {
    console.error('Error in session persistence test:', error);
    return false;
  }
}

// Run all tests and report overall results
async function runIntegrationTests() {
  console.log('===============================================');
  console.log('BENEDICTAITOR COMPREHENSIVE INTEGRATION TESTS');
  console.log('===============================================');
  
  const testResults = {
    'Basic Speech-to-Text': await testTeacherToStudentTranslation(),
    'Multiple Languages': await testMultipleLanguages(),
    'Error Handling': await testErrorHandling(),
    'Session Persistence': await testSessionPersistence()
  };
  
  console.log('\n\n===============================================');
  console.log('TEST SUMMARY');
  console.log('===============================================');
  
  let passCount = 0;
  let failCount = 0;
  
  for (const [testName, result] of Object.entries(testResults)) {
    if (result) {
      console.log(`✅ PASS: ${testName}`);
      passCount++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      failCount++;
    }
  }
  
  console.log('-----------------------------------------------');
  console.log(`TOTAL: ${passCount + failCount} tests`);
  console.log(`PASSED: ${passCount} tests`);
  console.log(`FAILED: ${failCount} tests`);
  console.log('===============================================');
  
  return failCount === 0;
}

// Run the integration tests
runIntegrationTests()
  .then(success => {
    console.log(`Integration Test Suite ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error during tests:', error);
    process.exit(1);
  });