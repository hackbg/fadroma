import type { Fn, RW, AsyncIter, Ports, Endpoint } from '../index.ts';
import type { Socket } from '../deps.ts';
import { TcpServer, createConnection, denoConnect, denoListen } from '../deps.ts';
import { reflect, asyncIter } from '../call.ts';
import { toRW } from './stream.ts';
/** TCP context. */
export type Tcp = Ports & {
  listen (at: number|string|URL, handler: Fn<[Socket]>): TcpEndpoint
  connect (to: number|string|URL): Promise<RW>
};
/** A network endpoint. */
export type TcpEndpoint = Endpoint & TcpServer & AsyncIter<Socket>;
/** Define network context. */
export function tcpContext <T extends Tcp>({
  ports   = {},
  connect = tcpConnect,
  listen  = tcpListen,
  ...rest
}: Partial<T> = {}): T {
  return {
    ports,
    connect,
    listen,
    ...rest
  } as T
}
export function tcpAddr (to: number|string|URL): URL {
  if (!isNaN(Number(to))) to = `tcp://localhost:${to}`;
  if (typeof to === 'string') to = new URL(to);
  return to as URL
}

/** Connect to a listener. */
export async function tcpConnect (to: number|string|URL): Promise<RW> {
  const { port, hostname } = tcpAddr(to);
  if (denoConnect) {
    const socket = await denoConnect({ hostname, port: Number(port) });
    return toRW(socket);
  } else {
    throw new Error('not implemented');
  }
}
/** Listen for connections. */
export function tcpListen (at: number|string|URL, handler?: Fn<[Socket]>): TcpEndpoint {
  const server = new TcpServer().on('connecton', handler);
  if (handler) server.listen(tcpAddr(at), handler);
  return asyncIter(async function * (s: typeof server) {
    while (s.listening) {
      yield await new Promise(resolve=>s.once('connection', resolve))
    }
  })(Object.assign(server, at, { handler })) as TcpEndpoint;
}
/** Define TCP service. */
export const tcpServe = (port: number, handler: Fn<[Socket]>) =>
  reflect(`TCP ${port}`, function runTcpServer (ctx: Tcp = tcpContext()): TcpEndpoint {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    const endpoint = tcpListen(port, handler);
    endpoint.on('close', () => delete ctx.ports[port]);
    return ctx.ports[port] = endpoint;
  }, { port, handler });
/** Wait for port to open until proceeding. */
export const tcpWait = ({
  port, host = 'localhost', retries = 20, interval = 250
}) => reflect(`Wait for ${host}:${port}`, function waitForPort (_?: unknown) {
  let timer: ReturnType<typeof setTimeout>|null = null
  let socket: Socket|null = null
  return new Promise<void>((resolve, reject)=>{
    retry()
    function retry () {
      clear()
      if (--retries < 0) { reject(new Error('out of retries')) }
      socket = createConnection(port, host, () => { clear(); if (retries > 0) resolve() });
      timer  = setTimeout(() => { retry() }, interval)
      socket.on('error', () => { clear(); setTimeout(retry, interval) })
    }
    function clear () {
      if (timer) clearTimeout(timer)
      timer = null
      socket?.destroy()
      socket = null
    }
  })
}, { port });
