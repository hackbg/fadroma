import type { Step, StepsWithName } from './call.ts';
import { pipe, reflect } from './call.ts';
import type { Socket } from './deps.ts';
import { TcpServer, HttpServer, createConnection } from './deps.ts';

export type Net = { ports: Record<number, TcpServer> };

export const netContext = (): Net => ({ ports: {} });

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

type Router = { method?: string };

type Route = StepsWithName<Router>;

type Handler = Step<Router>;

export const serveHttp = (port: number, ...routes: Handler[]) =>
  reflect(`HTTP ${port}`, function runHttpServer (ctx: Net = netContext()): HttpServer {
    const server = new HttpServer();
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, routes });

export const matchRoute = (expected) => (actual) =>
  false; // TODO

export const route: Route = (path, ...routes) => Object.assign(
  async function routeRequest (context: Router) {
    if (matchRoute(path)(context.path)) return pipe(...routes)(context)
  }, { routes });

export const method: Route = (method, ...routes) => Object.assign(
  async function onMethod (context: Router) {
    if (context.method === method) return pipe(...routes)(context);
  }, { method, routes });

export const get: Route = (path, ...routes) =>
  route(path, method('get', ...routes));

export const post: Route = (path, ...routes) =>
  route(path, method('post', ...routes));

export const ware: Route = (...routes) =>
  pipe(...routes);

export const param: Route = (name, fn) =>
  ware(async req => req.params[name] = await fn(req));

export const guard: Route = (code, fn) =>
  ware(async req => { if (!await fn(req)) return code });
