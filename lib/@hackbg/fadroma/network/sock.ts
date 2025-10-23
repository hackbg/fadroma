import type { Socket } from '../deps.ts';
import { TcpServer, createConnection } from '../deps.ts';
import { reflect } from '../call.ts';

export type Net = { ports: Record<number, TcpServer> };

export const netContext = ({
  ports = {},
  ...rest
} = {}) => ({ ports, ...rest });

export const serveTcp = (port: number, handler: (_: Socket)=>unknown) =>
  reflect(`TCP ${port}`, function runTcpServer (ctx: Net = netContext()): TcpServer {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    ctx.ports[port] = new TcpServer().on('connecton', handler).listen(port, '127.0.0.1');
    ctx.ports[port].on('close', () => delete ctx.ports[port]);
    return ctx.ports[port];
  }, { port, handler });

export const waitPort = ({
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

