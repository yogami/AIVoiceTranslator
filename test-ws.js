import WebSocket from 'ws';

// Connect to the production WS server
const ws = new WebSocket('wss://aivoicetranslator-production.up.railway.app');

ws.on('open', () => {
  console.log('Connected to WS');
  // Register as student
  ws.send(JSON.stringify({
    type: 'register',
    role: 'student',
    languageCode: 'es-ES',
    classroomCode: 'TEST',
    name: 'Test Student'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg.type);
  if (msg.type === 'translation') {
    console.log('Translation text:', msg.text);
    console.log('Agent actions:', msg.agentActions);
    process.exit(0);
  } else if (msg.type === 'register' && msg.status === 'success') {
    console.log('Registered successfully. Now send manual translation payload.');
    // We can't easily trigger translation without a teacher session, 
    // but we can try to send a manual translation request if the server allows it.
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
});
