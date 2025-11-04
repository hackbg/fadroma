import type { Fn, Tcp, Endpoint, Step } from './index.ts';
import { HttpServer } from './deps.ts';
import { pipe, reflect } from './call.ts';
import { tcpContext, tcpAddr } from './tcp.ts';

/** HTTP context. */
export type Http = Tcp & {
  serve (at: number, handler: Fn<[Request]>): Server,
  fetch (url: string|URL): Promise<ReturnType<typeof fetch>>,
};

export type Server = Endpoint & Router;

/** URL router. */
export type Router = { url?: string, method?: string, body?: string };

/** URL route. */
export type Route = <T extends Request>(_: unknown, ...handlers: Fn<[T]>[]) => Fn<[T]>;

/** URL route handler. */
export type Handler = Step<Router>;

/** Define HTTP server. */
export const serveHttp = (at: number|string|URL, ...routes: Handler[]) => {
  at = tcpAddr(at);
  return reflect(`HTTP ${at.toString()}`,
    function runHttpServer (ctx: Tcp = tcpContext()): HttpServer {
      const { port, hostname = '127.0.0.1' } = at;
      const server = new HttpServer();
      server.listen(`${hostname}:${port}`);
      ctx.ports[port] = { url: at, server };
      server.on('close', () => delete ctx.ports[port]);
      return server;
    }, { at, routes });
}

/** Define URL route. */
export const route = (path, ...routes) => reflect(path,
  async function routeRequest (context: Request) {
    if (matchRoute(path)(context.url)) return pipe(...routes)(context)
  }, { routes });

/** Match URL from request against route patterns. */
export const matchRoute = (expected) => (actual) => false; // TODO

/** Only handle if HTTP method matches. */
export const method = (method, ...routes: Route[]) => reflect(method,
  async function onMethod (context: Router) {
    if (context.method === method) return pipe(...routes)(context);
  }, { method, routes });

/** Only handle if HTTP method is GET. */
export const get = (path, ...routes) => route(path, method('get', ...routes));

/** Only handle if HTTP method is POST. */
export const post = (path, ...routes) => route(path, method('post', ...routes));

/** Set request parameter. */
export const param = (name: string, fn) =>
  async (req: Request & { params: Record<string, unknown> }) =>
    req.params[name] = await fn(req);

/** If condition doesn't match, return with specified code. */
export const guard = (code: number, ...handlers: Handler[]) =>
  async (req: Request & { params: Record<string, unknown> }) => {
    if (!await (pipe(...handlers)(req))) return code };

// TODO: construct API client from method set
// like `Endpoint` in old `@hackbg/port`
//[>* API endpoint client. <]
//export class Endpoint {
  //url: URL
  //constructor (url: string) {
    //this.url = new URL(url)
  //}
  //get (pathname: string = '', params: Record<string, string|undefined> = {}): Promise<any> {
    //const url = Object.assign(new URL(this.url.toString()), { pathname })
    //for (const [key, value] of Object.entries(params)) {
      //if (value) url.searchParams.set(key, value)
    //}
    //return new Promise((resolve, reject)=>{
      //this._get(url.toString(), res => {
        //let data = ''
        //res.on('data', chunk => data += chunk)
        //res.on('end', () => resolve(JSON.parse(data)))
      //}).on('error', reject)
    //})
  //}
  //_get = http.get
//}

