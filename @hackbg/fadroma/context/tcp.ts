import type { Fn, RW, AsyncIter, Ports, Endpoint } from '../index.ts';
import type { Socket, TcpServer } from '../deps.ts';
import { createTcpServer, createConnection, denoConnect } from '../deps.ts';
import { Named, asyncIter, toRW } from '../format.ts';

/** TCP context. */
export type Tcp = Ports & {
  listen (at: number|string|URL, handler: Fn<[Socket]>): TcpEndpoint
  connect (to: number|string|URL): Promise<RW>
};

/** Define network context. */
export function Tcp <T extends Tcp>({
  ports   = {},
  connect = tcpConnect,
  listen  = tcpListen as any,
  ...rest
}: Partial<T> = {}): T {
  return { ports, connect, listen, ...rest } as T
}

/** A network endpoint. */
export type TcpEndpoint = Endpoint & TcpServer & AsyncIter<Socket>;

/** Resolve TCP address. */
export function tcpAddr (to: number|string|URL): URL {
  if (!isNaN(Number(to))) to = `tcp://127.0.0.1:${to}`;
  if (typeof to === 'string') to = new URL(to);
  return to as URL
}

/** Connect to a listener. */
export async function tcpConnect (
  to: number|string|URL,
  debug = false
): Promise<Socket> {
  const { port, hostname } = tcpAddr(to);
  return createConnection(port, hostname);
  //if (denoConnect) {
    //const socket = await denoConnect({ hostname, port: Number(port) });
    //return toRW(socket);
  //} else {
    //throw new Error('not implemented');
  //}
}

/** Listen for connections. */
export async function tcpListen (
  at: number|string|URL, handler?: Fn<[Socket]>
): Promise<TcpServer> {
  const { port, hostname } = tcpAddr(at);
  const server = createTcpServer(handler);
  server.on('connecton', handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname as any, () => {
      server.off('error', reject);
      resolve(server);
      //resolve(asyncIter(async function * (s: typeof server) {
        //while (s.listening) {
          //yield await new Promise(resolve=>s.once('connection', resolve))
        //}
      //})(Object.assign(server, { handler })) as TcpEndpoint);
    });
  });
}

/** Define TCP service. */
export function tcpServe (port: number, handler: Fn<[Socket]>) {
  return Named(`TCP(Serve ${port})`, async function runTcpServer (
    ctx: Tcp = Tcp()
  ): Promise<TcpEndpoint> {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    const endpoint = await tcpListen(port, handler);
    endpoint.on('close', () => delete ctx.ports[port]);
    return ctx.ports[port] = endpoint;
  }, { port, handler });
}
