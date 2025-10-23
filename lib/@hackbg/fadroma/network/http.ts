import type { Net, Step, StepsWith } from '../index.ts';
import { HttpServer } from '../deps.ts';
import { pipe, reflect } from '../call.ts';
import { netContext } from './sock.ts';

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

export type Router = { url?: string, method?: string, body?: string };

export type Route = StepsWith<string, Router>;

export type Handler = Step<Router>;

export const route: Route = (path, ...routes) => reflect(path,
  async function routeRequest (context: Router) {
    if (matchRoute(path)(context.path)) return pipe(...routes)(context)
  }, { routes });

export const method: Route = (method, ...routes) => reflect(method,
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

export const guard = (code: number, ...handlers: Handler[]) =>
  ware(async req => { if (!await (pipe(...handlers)(req))) return code });
