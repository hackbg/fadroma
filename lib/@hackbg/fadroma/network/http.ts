import type { Net, Step, StepsWith } from '../index.ts';
import { HttpServer } from '../deps.ts';
import { pipe, reflect } from '../call.ts';
import { netContext } from './sock.ts';
/** URL router. */
export type Router = { url?: string, method?: string, body?: string };
/** URL route. */
export type Route = StepsWith<string, Router>;
/** URL route handler. */
export type Handler = Step<Router>;
/** Define HTTP server. */
export const serveHttp = (port: number, ...routes: Handler[]) =>
  reflect(`HTTP ${port}`, function runHttpServer (ctx: Net = netContext()): HttpServer {
    const server = new HttpServer();
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, routes });
/** Define URL route. */
export const route: Route = (path, ...routes) => reflect(path,
  async function routeRequest (context: Router) {
    if (matchRoute(path)(context.path)) return pipe(...routes)(context)
  }, { routes });
/** Match URL from request against route patterns. */
export const matchRoute = (expected) => (actual) => false; // TODO
/** Only handle if HTTP method matches. */
export const method: Route = (method, ...routes: Route[]) => reflect(method,
  async function onMethod (context: Router) {
    if (context.method === method) return pipe(...routes)(context);
  }, { method, routes });
/** Only handle if HTTP method is GET. */
export const get:  Route = (path, ...routes) => route(path, method('get', ...routes));
/** Only handle if HTTP method is POST. */
export const post: Route = (path, ...routes) => route(path, method('post', ...routes));
/** Add a middleware. */
export const ware: Route = (...routes) => pipe(...routes);
/** Set request parameter. */
export const param: Route = (name, fn) =>
  ware(async req => req.params[name] = await fn(req));
/** If condition doesn't match, return with specified code. */
export const guard = (code: number, ...handlers: Handler[]) =>
  ware(async req => { if (!await (pipe(...handlers)(req))) return code });
