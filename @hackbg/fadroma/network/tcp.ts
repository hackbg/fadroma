import type { Fn, RW } from '../index.ts';
import type { Socket } from '../deps.ts';
import { TcpServer, createConnection, denoConnect, denoListen } from '../deps.ts';
import { reflect } from '../call.ts';
import { toRW } from './stream.ts';
/** TCP context. */
export type Tcp = {
  ports: Record<number, TcpServer>
  listen (at: number|string|URL, handler: Fn<[Socket]>): Endpoint
  connect (to: number|string|URL): Promise<RW>
};
/** A network endpoint. */
export type Endpoint = URL & TcpServer;
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
/** Connect to a listener. */
export async function tcpConnect (to: number|string|URL): Promise<RW> {
  if (typeof to === 'number') to = `tcp://localhost:${to}`;
  if (typeof to === 'string') to = new URL(to);
  const { port, hostname } = to as URL;
  if (denoConnect) {
    const socket = await denoConnect({ hostname, port: Number(port) });
    return Object.assign(to, toRW(socket));
  } else {
    throw new Error('not implemented');
  }
}
/** Listen for connections. */
export function tcpListen (at: number|string|URL, handler?: Fn<[Socket]>): Endpoint {
  if (typeof at === 'number') at = `tcp://localhost:${at}`;
  if (typeof at === 'string') at = new URL(at);
  const server = new TcpServer().on('connecton', handler);
  if (handler) server.listen(at, handler);
  return Object.assign(server, at, { handler });
}
/** Define TCP service. */
export const tcpServe = (port: number, handler: Fn<[Socket]>) =>
  reflect(`TCP ${port}`, function runTcpServer (ctx: Tcp = tcpContext()): Endpoint {
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
