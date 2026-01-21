import type { Step } from '../index.ts';
import { HttpServer } from '../deps.ts';
import { Fn } from '../format.ts';
import { tcpAddr } from './tcp.ts';
import { Ports } from './port.ts';

/** HTTP context. */
export interface Http extends Ports {
  serve (at: number, handler: Fn<[Request]>):
    Http.Server,
  fetch (url: string|URL):
    Promise<ReturnType<typeof fetch>>,
};

/** Define HTTP server. */
export function Http (at: number|string|URL, ...routes: Http.Handler[]) {
  at = tcpAddr(at);
  return Fn.Name(`HTTP ${at.toString()}`,
    function runHttpServer <P extends Ports> (ctx: P = Ports() as P):
      HttpServer
    {
      const { port, hostname = 'localhost' } = at;
      const server = new HttpServer();
      server.listen(port, hostname);
      ctx.ports[port] = { url: at, server };
      server.on('close', () => delete ctx.ports[port]);
      return server;
    }, { at, routes });
}

export namespace Http {
  export type Server = { url?: URL } & Router;
  /** URL router. */
  export type Router = { url?: string, method?: string, body?: string };
  /** URL route. */
  export type Route = <T extends Request>(_: unknown, ...handlers: Fn<[T]>[]) => Fn<[T]>;
  /** URL route handler. */
  export type Handler = Step<Router>;
  /** Define URL route. */
  export const Route = function httpRoute (path: string, ...routes) {
    return Fn.Name(path, async function routeRequest (context: Request) {
      if (matchRoute(path)(context.url)) return Fn.Pipe(...routes)(context)
    }, { routes });
  };

  /** Match URL from request against route patterns. */
  export const matchRoute = (expected) => (actual) => false; // TODO

  /** Only handle if HTTP method matches. */
  export const method = (method, ...routes: Http.Route[]) => Fn.Name(method,
    async function onMethod (context: Http.Router) {
      if (context.method === method) return Fn.Pipe(...routes)(context);
    }, { method, routes });

  /** Only handle if HTTP method is GET. */
  export const get = (path, ...routes) => Http.Route(path, method('get', ...routes));

  /** Only handle if HTTP method is POST. */
  export const post = (path, ...routes) => Http.Route(path, method('post', ...routes));

  /** Set request parameter. */
  export const param = (name: string, fn) =>
    async (req: Request & { params: Record<string, unknown> }) =>
      req.params[name] = await fn(req);

  /** If condition doesn't match, return with specified code. */
  export const guard = (code: number, ...handlers: Http.Handler[]) =>
    async (req: Request & { params: Record<string, unknown> }) => {
      if (!await (Fn.Pipe(...handlers)(req))) return code };
}

/** Fetch helper. */
export async function callUrl (url: string|URL, method = 'GET', body?: BodyInit) {
  const result = await fetch(url, { method, body: JSON.stringify(body) });
  const text = await result.text();
  const code = result.status;
  if (code !== 200) {
    throw Object.assign(new Error(`${url}: ${code} (${text})`), { code, text })
  } else {
    return text;
  }
}

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
