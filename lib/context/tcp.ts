import type { Fn } from '../index.ts';
import type { Socket } from '../deps.ts';
import { createTcpServer, createConnection } from '../deps.ts';

export function Listen (at: number|string|URL, handler: Fn<[Socket]>) {
  const { port, hostname } = tcpAddr(at);
  const server = createTcpServer(handler);
  server.on('connecton', handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname as any, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
};

export function Connect (to: number|string|URL) {
  const { port, hostname } = tcpAddr(to);
  return createConnection({ port: Number(port), host: hostname });
};

/** Resolve TCP address. */
export function tcpAddr (to: number|string|URL): URL {
  if (!isNaN(Number(to))) to = `tcp://127.0.0.1:${to}`;
  if (typeof to === 'string') to = new URL(to);
  return to as URL
}
