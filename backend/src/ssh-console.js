import { Client } from 'ssh2';
import { WebSocketServer } from 'ws';

// Secure browser SSH console helper. The API should create short-lived sessions
// and pass credentials only through an authenticated, server-side session.
export function attachSSHConsole(httpServer, { authorize, getCredentials }) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/ws/ssh') return;
      const sessionId = url.searchParams.get('session');
      if (!sessionId || !(await authorize(sessionId))) throw new Error('Unauthorized');
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, sessionId));
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, sessionId) => {
    const ssh = new Client();
    let closed = false;
    const close = () => { if (!closed) { closed = true; try { ssh.end(); } catch {} try { ws.close(); } catch {} } };
    const credentials = await getCredentials(sessionId);
    if (!credentials) return close();

    ssh.on('ready', () => {
      ssh.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
        if (err) return close();
        ws.on('message', data => { if (!closed) stream.write(data.toString()); });
        ws.on('close', close);
        stream.on('data', data => { if (ws.readyState === ws.OPEN) ws.send(data.toString()); });
        stream.on('close', close);
      });
    }).on('error', close).connect({
      host: credentials.host,
      port: Number(credentials.port || 22),
      username: credentials.username,
      privateKey: credentials.privateKey,
      readyTimeout: 10000,
      keepaliveInterval: 10000
    });
  });

  return wss;
}
