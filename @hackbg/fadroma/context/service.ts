import type { Fn, Step, Async } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { execImpl, spawnImpl, inspect } from '../deps.ts';
import { Error, pipe, Named, toString } from '../format.ts';
import { FS } from './fs.ts';

/** A collection of processes and network endpoints provided by them. */
export type Service = FS & {
  /** Processes comprising the service, by PID. */
  pids: Record<number, { pid: number, kill (): Async }>,
  /** Mapping of port to PID that provides it. */
  ports: Record<number, number>
  /** Terminate the service. */
  kill (): Async
};

/** Define a service. */
export function Service <S extends Service> (name: string, ...services: Fn<[S]>[]) {
  const info = `[Service (${services.length}): ${name}]`;
  return toString(info)(Named(name, runService, { services }));
  async function runService (ctx = FS({ pids: {}, ports: {} } as Partial<S>)): Promise<S> {
    for (const service of services) await service(ctx);
    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
    return Object.assign(ctx, { kill, }) as unknown as S;
  }
}

/** Run a command and wait for result. */
export const Exec = (command: string, ...options: (Step<Run>|string)[]): Exec =>
  Named(`Exec(${command})`, async function exec (context = { exec: execImpl }) {
    const { argv, env } = Run(command, ...options);
    const [ cmd, ...args ] = argv;
    return { argv, env, ...await (context.exec??execImpl)(cmd, args, { env }) };
  }, Run(command, ...options));
/** Command invocation that returns a result. */
export type Exec = Fn<[{ exec?: typeof execImpl }], Async<Run & {
  pid?:    number,
  output?: unknown[],
  stdout?: string|unknown,
  stderr?: string|unknown,
  status?: number|null,
  signal?: string|null,
  error?:  Error,
}>>;

/** Run a background service. */
export const Spawn = (daemon: string, ...options: (Step<Run>|string)[]): Spawn =>
  Named(`Spawn(${daemon})`, async function spawn (context = { spawn: spawnImpl }) {
    const { argv, env } = Run(daemon, ...options);
    const [ cmd, ...args ] = argv;
    return { argv, env, handle: await (context.spawn??spawnImpl)(cmd, args, { env }) };
  }, Run(daemon, ...options));
/** Command invocation that spawns a background process. */
export type Spawn = Fn<[{ exec?: typeof execImpl }], Async<Run & {
  handle?: ChildProcess
}>>;

/** Compose command invocation from options. */
export const Run = (path: string, ...opts: (Step<Run>|string)[]) =>
  pipe(...opts.filter(Boolean).map(toOpt))({ argv: [path], env: {} }) as Run;
/** Command invocation. */
export type Run = { argv: string[], env?: Record<string, string> };

const toOpt = (opt: string|Step<Run>): Step<Run> =>
  (typeof opt === 'function') ? opt :
  (typeof opt === 'string')   ? pushArg(opt) :
  (typeof opt === 'object')   ? context=>Object.assign(context, opt) :
  Error.required(`string or function, got: ${inspect(opt)}`);

const pushArg = (opt: string) =>
  Named(opt, (run: Run) => { run.argv.push(opt); return run });

/** Set environment variable in run config. */
export const Env = (name: string, value: string|null) =>
  Named(`Env(${name}=${value})`, function setEnv (context: Partial<Run> = {}) {
    context.env ??= {};
    context.env[name] = value;
    return context
  }, { name, value });

/** Append command-line arguments to a command invocation. */
export const Arg = (...parts: string[]) =>
  Named(`Arg(${parts[0]})`, function addArgument (context: Partial<Run> = {}) {
    context.argv ??= []
    context.argv.push(parts.join(' '))
    return context
  }, { parts });
