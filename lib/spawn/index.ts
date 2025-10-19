import type { Spawn, Option, Pids, Ports, Command, Service } from './types.ts';
import { pipe, renamed, TcpServer, HttpServer, execImpl, spawnImpl } from './deps.ts';
import type { Socket } from './types.ts';

export const context = (): Ports & Pids => ({
  ports: {},
  pids:  {},
  exec: ({ argv, options }: Command) => execImpl(argv[0], argv.slice(1), options),
  spawn (_: Command) {},
  kill  (_: number) {},
});

export const compose = (name: string, ...services: Service[]) => Object.assign(
  renamed(name, async function spawnGroup (ctx: Pids & Ports = context()) {
    for (const service of services) {
      const result = await service(ctx);
      if (result.pid) ctx.pids[result.pid] = result;
      if (result.ports) for (const port of result.ports) ctx.ports[port] = result;
    }
  }), { services })

export const arg = (...fragments: string[]) => Object.assign(
  function addArgument (cmd: Command) {
    return Object.assign(cmd, {
      argv: [...cmd.argv || [], fragments.join(' ')]
    })
  }, { fragments });

export const setEnv = (name: string, value: string|null) => Object.assign(
  function setEnvironmentVariable (cmd: Command) {
    cmd.options ??= {};
    cmd.options.env ??= {};
    cmd.options.env[name] = value;
  }, { name, value });

export const spawn = (...options: Option[]) => pipe(...options);

export const exec = (arg0: string, ...options: (Option|string)[]) =>
  Object.assign(function callShell (ctx: Pids = context()) {
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
    const spawned = ctx.exec(command)
    return spawned
  }, { arg0, options });

export const serveTcp = (port: number, handler: (_: Socket)=>unknown) =>
  Object.assign(function runTcpServer (ctx: Ports = context()): TcpServer {
    if (port in ctx.ports) throw new Error(`port ${port}: occupied`);
    const server = new TcpServer();
    server.on('connecton', handler);
    server.listen(port);
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, handler })

export const serveHttp = (port, ...routes: Option[]) =>
  Object.assign(function runHttpServer (ctx: Ports = context()): HttpServer {
    const server = new HttpServer();
    server.listen(port);
    ctx.ports[port] = server;
    server.on('close', () => delete ctx.ports[port]);
    return server;
  }, { port, routes });

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
