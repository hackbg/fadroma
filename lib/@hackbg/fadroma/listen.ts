import type { Socket } from './deps.ts';
import { TcpServer, HttpServer, createConnection } from './deps.ts';
import { pipe, reflect } from './reflect.ts';

type Router = {
  method?: string
};

type Route = Step<Router>;

export type ListenContext = {
  ports: Record<number, unknown>
};

export const listenContext = (): ListenContext => ({
  ports: {}
});

export const serveTcp = (port: number, handler: (_: Socket)=>unknown) =>
  reflect(`TCP ${port}`, function runTcpServer (ctx: ListenContext = listenContext()): TcpServer {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    const server = new TcpServer();
    server.on('connecton', handler);
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
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

export const serveHttp = (port: number, ...routes: Route[]) =>
  reflect(`HTTP ${port}`, function runHttpServer (ctx: ListenContext = listenContext()): HttpServer {
    const server = new HttpServer();
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, routes });

export const matchRoute = (expected) => (actual) =>
  false; // TODO

export const param:  StepsWithName<Router> = (name, fn) =>
  ware(async req => req.params[name] = await fn(req));

export const guard:  StepsWithName<Router> = (code, fn) =>
  ware(async req => { if (!await fn(req)) return code });

export const route:  StepsWithName<Router> = (path, ...routes) => Object.assign(
  async function routeRequest (context: Router) {
    if (matchRoute(path)(context.path)) return pipe(...routes)(context)
  }, { routes });

export const method: StepsWithName<Router> = (method, ...routes) => Object.assign(
  async function onMethod (context: Router) {
    if (context.method === method) return pipe(...routes)(context);
  }, { method, routes });

export const get:    StepsWithName<Router> = (path, ...routes) =>
  route(path, method('get', ...routes));

export const post:   StepsWithName<Router> = (path, ...routes) =>
  route(path, method('post', ...routes));

export const ware:   Steps<Router> = (...routes) =>
  pipe(...options);

export const set:    StepsWithName    = (key?: string) =>
  pipe(...options);
