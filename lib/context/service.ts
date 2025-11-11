import type { Fn, Step, Async, Ports } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { execImpl, spawnImpl, inspect, getCwd } from '../deps.ts';
import { Error, Pipe, Name, toString } from '../format.ts';
import { Dir } from './fs.ts';
/** A collection of processes and network endpoints provided by them. */
export type Service = Dir & Ports<number> & {
  /** Processes comprising the service, by PID. */
  pids: Record<number, ChildProcess>;
  /** Terminate the service. */
  kill: Fn<[], Async>;
};
/** Command invocation that returns a result. */
export type Exec = Fn<[Partial<Dir & { exec?: typeof execImpl }>],
  Async<Run & {
    pid?:    number,
    status?: number|null,
    signal?: string|null,
    error?:  Error,
    stdout?: string|unknown,
    stderr?: string|unknown,
  }>>;
/** Run a command and wait for result. */
export function Exec (
  command: string, ...options: (Step<Run>|string)[]
): Exec {
  return Name(`Exec(${command})`, async function exec (context?: {
    dir?: string, exec?: typeof execImpl,
  }): Promise<Run> {
    context ??= {};
    context.dir ??= getCwd();
    context.exec ??= execImpl;
    const { argv, env } = Run(command, ...options);
    const [ cmd, ...args ] = argv;
    const opts = { env, cwd: context?.dir ?? getCwd() }
    return { argv, env, ...await context.exec(cmd, args, opts) };
  }, { command, options });
}
/** Command invocation that spawns a background process. */
export type Spawn = Fn<[Partial<Dir & { spawn?: typeof spawnImpl }>],
  Async<Run & ChildProcess>>;
/** Run a background service. */
export function Spawn (daemon: string, ...options: (Step<Run>|string)[]): Spawn {
  return Name(`Spawn(${daemon})`, async function spawn (context?: {
    dir?: string, spawn?: typeof spawnImpl
  }): Promise<Run & ChildProcess> {
    context ??= {};
    context.dir ??= getCwd();
    context.spawn ??= spawnImpl;
    const { argv, env } = Run(daemon, ...options);
    const [ cmd, ...args ] = argv;
    const opts = { env, cwd: context?.dir ?? getCwd() }
    return { argv, env, ...await context.spawn(cmd, args, opts) } as Run & ChildProcess;
  }, { daemon, options });
}
/** Command invocation. */
export type Run = { argv: string[], env?: Record<string, string> };
/** Define a service. */
export function Service <S extends Service> (
  name: string, ...services: Fn<[S]>[]
) {
  const info = `[Service (${services.length}): ${name}]`;
  return toString(info)(Name(name, runService, { services }));
  async function runService (
    ctx = { ...Dir(), pids: {}, ports: {} } as Partial<S>
  ): Promise<S> {
    for (const service of services) await service(ctx);
    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
    return Object.assign(ctx, { kill, }) as unknown as S;
  }
}
/** Set environment variable in run config. */
export function Env (name: string, value: string|null) {
  return Name(`Env(${name}=${value})`, function setEnv (context: Run) {
    context ??= {} as Run;
    context.env ??= {};
    context.env[name] = value;
    return context
  }, { name, value });
}
/** Append command-line arguments to a command invocation. */
export function Arg (...parts: string[]) {
  return Name(`Arg(${parts[0]})`, function addArgument (context: Run) {
    context ??= {} as Run;
    context.argv ??= []
    context.argv.push(parts.join(' '))
    return context
  }, { parts });
}
/** Compose command invocation from options. */
export function Run (path: string, ...opts: (Step<Run>|string)[]) {
  return Pipe(...opts.filter(Boolean).map(toOpt))({ argv: [path], env: {} }) as Run;
}
const toOpt = (opt: string|Step<Run>): Step<Run> =>
  (typeof opt === 'function') ? opt :
  (typeof opt === 'string')   ? pushArg(opt) :
  (typeof opt === 'object')   ? context=>Object.assign(context, opt) :
  Error.required(`string or function, got: ${inspect(opt)}`);
const pushArg = (opt: string) =>
  Name(opt, (run: Run) => { run.argv.push(opt); return run });
