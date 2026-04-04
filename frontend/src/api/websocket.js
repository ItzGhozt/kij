const WS_URL = 'wss://kij-backend.onrender.com/ws';

let _ws = null;
let _listeners = [];
let _reconnectTimer = null;
let _pingInterval = null;

function connect() {
  if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

  _ws = new WebSocket(WS_URL);

  _ws.onopen = () => {
    console.log('[WS] connected');
    clearInterval(_pingInterval);
    _pingInterval = setInterval(() => {
      if (_ws.readyState === WebSocket.OPEN) _ws.send('ping');
    }, 25000);
  };

  _ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'pong') return;
      _listeners.forEach((fn) => fn(msg));
    } catch {
      // ignore malformed messages
    }
  };

  _ws.onclose = () => {
    console.log('[WS] closed – reconnecting in 3s');
    clearInterval(_pingInterval);
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(connect, 3000);
  };

  _ws.onerror = () => {
    _ws.close();
  };
}

function onMessage(fn) {
  _listeners.push(fn);
}

function offMessage(fn) {
  _listeners = _listeners.filter((f) => f !== fn);
}

export const WS = { connect, onMessage, offMessage };
