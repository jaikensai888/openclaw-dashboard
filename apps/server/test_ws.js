const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:3002/ws');
let conversationId = null;
let gotResponse = false;

ws.on('open', () => {
  console.log('[Test] Connected');
  ws.send(JSON.stringify({ type: 'conversation.create' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[Test] Received:', msg.type);
  
  if (msg.type === 'conversation.created') {
    conversationId = msg.payload.id;
    console.log('[Test] Created conv:', conversationId);
    setTimeout(() => {
      console.log('[Test] Sending chat.send...');
      ws.send(JSON.stringify({
        type: 'chat.send',
        conversationId: conversationId,
        content: '你好'
      }));
    }, 300);
  }
  
  if (msg.type === 'chat.message') {
    console.log('[Test] chat.message role:', msg.payload?.role);
    if (msg.payload?.role === 'assistant') {
      gotResponse = true;
      console.log('[Test] SUCCESS Reply:', msg.payload.content?.slice(0, 150));
      ws.close();
      process.exit(0);
    }
  }
  
  if (msg.type === 'chat.streaming') {
    process.stdout.write('.');
  }
  
  if (msg.type === 'error') {
    console.error('[Test] Error:', msg.payload);
  }
});

ws.on('error', (e) => console.error('[Test] WS Error:', e.message));

setTimeout(() => {
  console.log('\n[Test] Timeout after 35s, gotResponse=' + gotResponse);
  ws.close();
  process.exit(gotResponse ? 0 : 1);
}, 35000);
