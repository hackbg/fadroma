import type { ClientRequest, ServerResponse } from '../deps.ts';
import { HttpServer } from '../deps.ts';
import { tcpAddr } from './Tcp.ts';
import { Ports } from './Port.ts';
import { Log } from './Log.ts';
import { Fn } from '../format.ts';
export default Http;
/** A HTTP route handler.
  *
  * - Handlers are tried sequentially, in the order they are added to the listener.
  *   Asynchronous handlers are awaited.
  *
  * - A matching handler that returns undefined is a middleware; use this to modify the context.
  *
  * - A matching handler that returns anything besides undefined terminates the handling.
  *   Its return value is written to the HTTP response with code 200.
  *
  * - If you want a different status code, set the `http` property of
  *   an error and throw it from the handler.
  *
  * - If handlers are matched but no value is returned, the response is an empty 200.
  *
  * - TODO: If no handlers are matched, the response is an empty 404. */
export interface Http extends Fn.Takes<[Http.Context]> {}
/** Define HTTP routes.
  *
  * Example 1: Building blocks
  *
  *     import { Http } from 'fadroma';
  *     // define routes:
  *     const route1 = Http.Get('/',  ({ req }) => {}),
  *     const route2 = Http.Post('/', ({ req }) => {}),
  *     // define router with optional name (they nest):
  *     const router = Http("example", route1, route2);
  *     // handle extant node-style request/response pair:
  *     await route({ req, res });
  *     // define listener with one or more routers:
  *     const listen = Http.Listen(8000, routes);
  *     // listen for requests:
  *     const server = listen();
  *
  * Example 2: Composition
  *
  *     import { Http } from 'fadroma';
  *     import { DB } from 'your-persistence-layer';
  *     export default API Http(CRUD('User'), CRUD('Item'),);
  *     function CRUD (model, ...modelSpecificRoutes) {
  *       return Http.Prefix(`/${model}/:id`,
  *         async context => {
  *           context.id    = context.req.param["id"];
  *           context.db    = await DB();
  *           context.model = context.db.models[model];
  *         },
  *         Http.Put(({    model, id, data }) => model.create(id, data)),
  *         Http.Get(({    model, id       }) => model.retrieve(id)),
  *         Http.Patch(({  model, id, data }) => model.update(id, data)),
  *         Http.Delete(({ model, id       }) => model.delete(id)),
  *         ...modelSpecificRoutes); }
  *
  *   */
function Http (name?: string, ...routes: Http.Handler[]): Http;
function Http (...routes: unknown[]) {
  let name = 'Http';
  if (typeof routes[0] === 'string') name = routes.shift();
  return Fn.Name(name, httpRouter, { routes })
  async function httpRouter (context) {
    const { req, res, debug = console.debug, error = console.error } = context;
    debug('REQ', req.method.padEnd(6))
    for (const route of routes) {
      if (route && typeof route === 'function') {
        debug('   ', req.method.padEnd(6), req.url, route.name)
        try {
          const result = await route(context);
          if (result !== undefined) {
            debug(200, req.method.padEnd(6), req.url, route.name)
            res.writeHead(200).end(JSON.stringify(result));
          }
        } catch (e) {
          const code = e.http || 500;
          error(code, req.method.padEnd(6), req.url, route.name, e.stack)
          res.writeHead(code).end(JSON.stringify({ error: e.message }));
        }
      }
    }
  }
}
namespace Http {
  export type Server   = HttpServer;
  export type Request  = ClientRequest;
  export type Response = ServerResponse;
  export type Method   = 'GET'|'PUT'|'PATCH'|'POST'|'DELETE'|'HEAD'|'OPTIONS';
  export const Method  = (m: Method, ...f: Http[]): Http =>
    Fn.Name(m, (r: Request) => (r.method === m) && Fn.Pipe(...f)(r), { ...f, method: m });
  export type Context  = { path?: string, method?: Method, body?: string };
  export const Prefix  = (p: string, ...f: Http[]): Http =>
    Fn.Name(p, (r: Request) => (r.path   === p) && Fn.Pipe(...f)(r), { ...f, path: p });
  export const Guard   = (c: number, ...f: Http[]): Http =>
    Fn.Name(c, (r: Request) => Promise.resolve(Fn.Pipe(...f)(r)).then(x=>{ if (!x) return c }));
  export const Get     = (p: string, ...f: Http[]): Http =>
    Prefix(p, Method('GET',  ...f));
  export const Post    = (p: string, ...f: Http[]): Http =>
    Prefix(p, Method('POST', ...f));
  export const Listen  = (l: string|number|URL, ...routes: Http[]) => {
    if (typeof l === 'number') l = `localhost:${l}`;
    if (typeof l === 'string') l = new URL(l);
    const { port, hostname = 'localhost' } = l as URL;
    const handler = Http(...routes);
    return Fn.Name(`Listen (${hostname}:${port})`, httpListen, { hostname, port, ...routes });
    function httpListen <P extends Ports & Log>({
      ports = {}, log = console.log, debug = console.debug
    }: P = Ports(Log()) as P): Server {
      const server = new HttpServer();
      ports[port] = { url: l, server };
      server.on('request', (req, res) => handler({ req, res }));
      server.on('close', () => delete ports[port]);
      return new Promise((resolve, reject)=>{
        server.once('error', reject);
        server.listen(Number(port), hostname as string, () => {
          server.off('error', reject);
          debug('Listening on', hostname, port);
          resolve(server)
        });
      });
    }
  }
  export const respond = (response, code, data) => response.status(code).send(data);
  //export const Param  = (name:   string, fn):                          Http => (req: Request & { params: Record<string, unknown> }) => Promise.resolve(fn(req)).then(val => { req.params[name] = val; });
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
