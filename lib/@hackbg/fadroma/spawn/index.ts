import type { Step, ChildProcess } from '../deps.ts';
import { TcpServer, HttpServer, execImpl, spawnImpl, createConnection } from '../deps.ts';
import { pipe, reflect } from '../reflect/index.ts';

const { assign } = Object;

export type Service  = Step<Ports & Pids>;

export type Listen   = Step<Ports>;
export type Ports    = { ports: Record<number, unknown> };

export type Spawn    = Step<Pids>;
export type Pids     = { pids: Record<number, unknown>
                       , exec  (_: Command): Shellout
                       , spawn (_: Command): ChildProcess
                       , kill  (pid: number): Promise<unknown> };
export type Shellout = { pid:    number
                       , output: unknown[]
                       , stdout: string|unknown
                       , stderr: string|unknown
                       , status: number|null
                       , signal: string|null
                       , error?: Error };

export type Option   = Step<Command>;
export type Command  = { argv:     string[]
                       , options?: { env?: Record<string, unknown> } };

export const context = (): Ports & Pids => ({
  ports: {},
  pids:  {},
  exec: ({ argv, options }: Command) =>
    execImpl(argv[0], argv.slice(1), options),
  spawn: ({ argv, options }: Command) =>
    spawnImpl(argv[0], argv.slice(1), options),
  kill (_?: number) {},
});

export const compose = (name: string, ...services: Service[]) =>
  reflect(name, async function spawnGroup (ctx: Pids & Ports = context()) {
    for (const service of services) {
      const result = await service(ctx);
      if (result?.pid) {
        ctx.pids[result.pid] = result;
      }
      if (result?.ports) {
        for (const port of result.ports) ctx.ports[port] = result;
      }
    }
    return ctx
  }, { services });

export const arg = (...fragments: string[]) => assign(
  function addArgument (cmd: Command) {
    return assign(cmd, {
      argv: [...cmd.argv || [], fragments.join(' ')]
    })
  }, { fragments });

export const setEnv = (name: string, value: string|null) => assign(
  function setEnvironmentVariable (cmd: Command) {
    cmd.options ??= {};
    cmd.options.env ??= {};
    cmd.options.env[name] = value;
  }, { name, value });

export const spawn = (arg0: string, ...options: Option[]) =>
  assign(function spawnDaemon (ctx: Pids = context()) {
    return ctx.spawn(buildCommand(arg0, options));
  }, { arg0, options });

export const exec = (arg0: string, ...options: (Option|string)[]) =>
  assign(function callShell (ctx: Pids = context()) {
    return ctx.exec(buildCommand(arg0, options));
  }, { arg0, options });;

export const buildCommand = (arg0: string, options: (Option|string)[]) => {
  let command = { argv: [arg0], options: {} };
  for (const option of options) {
    if (typeof option === 'function') {
      command = option(command) || command;
    } else if (typeof option === 'string') {
      command.argv ??= []
      command.argv.push(option);
    } else if (option) {
      throw new Error('unsupported option')
    }
  }
  return command;
}

export const serveTcp = (port: number, handler: (_: Socket)=>unknown) =>
  assign(function runTcpServer (ctx: Ports = context()): TcpServer {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    const server = new TcpServer();
    server.on('connecton', handler);
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, handler })

export const serveHttp = (port, ...routes: Option[]) =>
  assign(function runHttpServer (ctx: Ports = context()): HttpServer {
    const server = new HttpServer();
    server.listen(port, '127.0.0.1');
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, routes });

export const waitPort = ({
  port, host = 'localhost', retries = 20, interval = 250
}) => assign(function waitForPort (_?: unknown) {
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

    
}, { port })

export const rest = (path, ...options: Option[]) => pipe(...options);

export const get = (path, ...options: Option[]) => pipe(...options);

export const post = (path, ...options: Option[]) => pipe(...options);

export const ware = (path, ...options: Option[]) => pipe(...options);

export const param = (name, fn) => ware(async req => req.params[name] = await fn(req));

export const guard = (code, fn) => ware(async req => { if (!await fn(req)) return code });

export const every = (path, ...options: Option[]) => pipe(...options);

export const container = (name, ...options) => { throw new Error('TODO') };

export const image = (name, ...options) => { throw new Error('TODO') };

export const distro = (name, ...options) => { throw new Error('TODO') };

export const pkg = (name, ...options) => { throw new Error('TODO') };
