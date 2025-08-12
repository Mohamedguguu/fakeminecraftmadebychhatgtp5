// server.js - very small WebSocket relay server
const WebSocket = require('ws');
const port = 3000;
const wss = new WebSocket.Server({ port });

let nextId = 1;
const clients = new Map(); // ws -> id

wss.on('connection', (ws) => {
  const id = (nextId++).toString();
  clients.set(ws, id);
  ws._id = id;
  console.log('join', id);

  // send current players to new client
  const players = [];
  for(const [c, cid] of clients.entries()){
    if(c !== ws && c._lastPos) players.push({ id: cid, ...c._lastPos });
  }
  ws.send(JSON.stringify({ t: 'playerList', players }));

  // notify others
  const joinMsg = JSON.stringify({ t: 'join', id, x:0, y:2.5, z:0 });
  for(const c of clients.keys()) if(c!==ws) c.send(joinMsg);

  ws.on('message', (m) => {
    let msg;
    try { msg = JSON.parse(m); } catch(e){ console.warn('bad msg', e); return; }

    if(msg.t === 'move'){
      ws._lastPos = { x:msg.x, y:msg.y, z:msg.z, rx:msg.rx };
      // broadcast to others
      for(const c of clients.keys()){
        if(c !== ws && c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ t:'move', id, x:msg.x, y:msg.y, z:msg.z, rx:msg.rx }));
      }
    } else if(msg.t === 'place' || msg.t === 'remove'){
      // relay block events to others
      for(const c of clients.keys()){
        if(c.readyState === WebSocket.OPEN) c.send(JSON.stringify(Object.assign({}, msg, { id })));
      }
    }
  });

  ws.on('close', () => {
    console.log('leave', id);
    clients.delete(ws);
    // notify others
    for(const c of clients.keys()){
      if(c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ t:'leave', id }));
    }
  });
});

console.log(`WebSocket server started on ws://localhost:${port}`);
