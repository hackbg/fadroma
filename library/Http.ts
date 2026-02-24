import type { ClientRequest, ServerResponse } from 'node:http';
import { Server as HttpServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { Ports } from './Port.ts';
import { Log } from './Log.ts';
import Fn from './Fn.ts';

export default Http;

export type Http<C extends Http.Context = Http.Context> = Http.Handler<C>;

/** Define HTTP routes.
  *
  * Example 1: Building blocks
  *
  *     import { Http } from 'fadroma';
  *
  *     // define routes:
  *     const route1 = Http.Get('/',  ({ req }) => {}),
  *     const route2 = Http.Post('/', ({ req }) => {}),
  *
  *     // define router, with optional name. they nest
  *     const router = Http("example", route1, route2);
  *
  *     // handle extant node-style request/response pair:
  *     await route({ req, res });
  *
  *     // define listener with one or more routers:
  *     const listen = Http.Listen(8000, routes);
  *
  *     // listen for requests:
  *     const server = listen();
  *
  * Example 2: Composition
  *
  *     import { Http } from 'fadroma';
  *     import { DB } from 'your-persistence-layer';
  *
  *     export default API Http(CRUD('User'), CRUD('Item'),);
  *
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
  *         ...modelSpecificRoutes
  *       );
  *     }
  *
  *   */
function Http (name?: string, ...routes: Http[]): Http;
function Http (...routes: Http[]): Http;
function Http (...routes: unknown[]) {
  let name = 'Http';
  if (typeof routes[0] === 'string') name = routes.shift() as string;
  return Fn.Name(name, httpRouter, { routes })
  async function httpRouter (context: Http.Context) {
    for (const route of routes) {
      if (route && typeof route === 'function') {
        const result = await route(context);
        if (result !== undefined) return result;
      }
    }
  }
}

namespace Http {
  const decoder = new TextDecoder();

  /** Alias to Node-style HTTP server, which responds to
    * HTTP requests by invoking its [Http.Handler]. */
  export interface Server extends HttpServer {}

  /** Alias to Node-style HTTP request input, where the body must be read out in chunks. */
  export interface Request extends ClientRequest {
    url: string;
  }

  /** Read the body of an incoming [Request]. */
  export function readBody (req: Http.Request): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = [];
      try {
        req.on('error', reject);
        req.on('data', chunk => data.push(chunk));
        req.on('end', () => resolve(decoder.decode(Buffer.concat(data))));
      } catch(e) {
        reject(e);
      }
    })
  }

  /** Alias to Node-style HTTP response output. */
  export interface Response extends ServerResponse {}

  /** Write status code and JSON-serialized data to [Response]. */
  export function respond (res: Response, code: number, data: unknown) {
    res.writeHead(code).end(JSON.stringify(data));
    return res;
  }

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
  export interface Handler<C extends Context = Context> extends Fn.Takes<[C]> {}

  /** Context available to HTTP route handlers. */
  export interface Context extends Log { req: Request, res: Response, }

  /** HTTP method names. */
  export type Method = 'GET'|'PUT'|'PATCH'|'POST'|'DELETE'|'HEAD'|'OPTIONS';

  /** Define method handler.
    *
    * It evaluates contained handlers IFF the request is of method `m` */
  export function Method (m: Method, ...f: Http[]): Http {
    return Fn.Name(`Method ${m}`, function methodHandler (c: Context) {
      if (c.req.method === m) return Fn.Pipe(...f)(c)
    }, { ...f, method: m });
  }

  export namespace Method {
    export const Get    = (prefix?: string, ..._: Http[]) => method('GET',    prefix, ..._);
    export const Put    = (prefix?: string, ..._: Http[]) => method('PUT',    prefix, ..._);
    export const Patch  = (prefix?: string, ..._: Http[]) => method('PATCH',  prefix, ..._);
    export const Post   = (prefix?: string, ..._: Http[]) => method('POST',   prefix, ..._);
    export const Delete = (prefix?: string, ..._: Http[]) => method('DELETE', prefix, ..._);
    function method (m: Method, ...args: unknown[]) {
      if (typeof args[0] === 'string') return Prefix(args[0], method(m, ...args.slice(1)));
      return Method(m, ...args as Http[]);
    }
  }

  /** Define path handler.
    *
    * It evaluates contained handlers IFF the request path is equal to `p`.
    *
    * FIXME: Actually match the path prefix. */
  export const Prefix = (p: string, ...f: Http[]): Http => Fn.Name(`Prefix ${p}`,
    function prefixHandler (r: Context) {
      if (r.req.url === p) return Fn.Pipe(...f)(r)
    }, { ...f, path: p });

  /** Define guard handler.
    *
    * Path handler throws specified `code` if the pipe `...f` does not evaluate to true-ish.
    * This prevents subsequent handlers from evaluating. */
  export const Guard  = (code: number, ...f: Http[]): Http => Fn.Name(`Guard ${code}`,
    async function guardHandler (r: Context) {
      const x = await Fn.Pipe(...f)(r);
      if (!x) throw Object.assign(new Error(`HTTP ${code}`), { http: code })
    }, { ...f, code });

  export function Listen (l: string|number|URL, ...routes: Http[]) {
    if (typeof l === 'number') l = `localhost:${l}`;
    if (typeof l === 'string') l = new URL(l);
    const { port, hostname = 'localhost' } = l as URL;
    const handler = Http(...routes);
    return Fn.Name(`Listen (${hostname}:${port})`, httpListen, { hostname, port, ...routes });
    function httpListen <P extends Ports & Log> (context: P = Ports(Log()) as P): Promise<Server> {
      const { ports = {}, debug = console.debug } = context;
      const server = new HttpServer();
      const portState = ports[port] = { url: l, server };
      server.on('request', onRequest);
      server.on('close',   onClose);
      return new Promise((resolve, reject)=>{
        server.once('error', reject);
        debug('Starting listener on', port);
        server.listen(Number(port), hostname as string, onListen);
        function onListen () {
          server.off('error', reject);
          debug('Listening on', hostname, port);
          resolve(server)
        }
      });
      async function onClose () {
        debug('Stopping listener');
        if (ports[port] === portState) {
          delete ports[port];
        }
      }
      async function onRequest (req: Request, res: Response) {
        debug('REQ', req.method.padEnd(6), req.url)
        let code   = 404;
        let result = undefined;
        try {
          result = await handler({ ...context, req, res });
          code = 200;
        } catch (e) {
          code = e.http || 500;
          result = { error: e.message };
        }
        return respond(res, code, result);
      }
    }
  }

  /** Fetch textual response of HTTP request. */
  export async function fetchText (url: string|URL, method = 'GET', body?: BodyInit) {
    const result = await fetch(url, { method, body: JSON.stringify(body) });
    const text = await result.text();
    const code = result.status;
    if (code !== 200) {
      throw Object.assign(new Error(`${url}: ${code} (${text})`), { code, text })
    } else {
      return text;
    }
  }
  /** Fetch textual response of HTTP request and parse it as JSON. */
  export async function fetchJson (url: string|URL, method = 'GET', body?: BodyInit) {
    const text = await fetchText(url, method, body);
    console.log({text});
    return JSON.parse(text)
  }
  /** Fetch textual response of HTTP request and parse it as JSON. */
  export async function postBinary (url: string|URL, body: unknown) {
    const result = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const text = await result.text();
    const code = result.status;
    if (code !== 200) {
      throw Object.assign(new Error(`${url}: ${code} (${text})`), { code, text })
    } else {
      return text;
    }
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
