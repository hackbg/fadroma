import type { ChildProcess } from '../deps.ts';
import { execImpl, spawnImpl, inspect, cwd } from '../deps.ts';
import { Error } from './Err.ts';
import { Dir } from './Fs.ts';
import Fn from './Fn.ts';

export default Run;

/** Command invocation. */
type Run = { argv: string[], env?: Run.Env };

/** Define a command invocation. */
function Run (path: string, ...opts: (Run.Def|string)[]) {
  const context = { argv: [path], env: {} };
  return Fn.Pipe(...opts.filter(Boolean).map(toOpt))(context) as Run;
}

/** Command invocation internals. */
namespace Run {
  /** Part of definition of command invocation. */
  export type Def    = Fn.Step<Run>;
  /** Command environment. */
  export type Env    = Record<string, string>;
  /** A background process. */
  export type Daemon = Run & ChildProcess & { kill (code: number): unknown; };
  /** Command invocation that spawns [Daemon]. */
  export type Spawn  = Fn<[Partial<Dir & { spawn?: typeof spawnImpl }>], Daemon>;
  /** Command invocation that returns a result. */
  export type Exec   = Fn<[Partial<Dir & { exec?:  typeof execImpl  }>], Fn.Async<Ran>>;
  /** Result of command invocation. */
  export type Ran    = Run & {
    pid?:    number,
    status?: number|null,
    signal?: string|null,
    error?:  Error,
    stdout?: string|unknown,
    stderr?: string|unknown,
  };
  /** Run a command and wait for result. */
  export function Exec (command: string, ...options: (Def|string)[]): Exec {
    return Fn.Name(`Exec(${command})`, exec, { command, options });
    async function exec (context?: { dir?: string, exec?: typeof execImpl }): Promise<Ran> {
      context ??= {};
      context.dir ??= cwd();
      context.exec ??= execImpl;
      const { argv, env } = Run(command, ...options);
      const [ cmd, ...args ] = argv;
      const opts = { env, cwd: context?.dir ?? cwd() }
      return { argv, env, ...await context.exec(cmd, args, opts) };
    }
  }
  /** Run a background process. */
  export function Spawn (daemon: string, ...options: (Def|string)[]): Spawn {
    return Fn.Name(`Spawn(${daemon})`, spawn, { daemon, options });
    async function spawn (context?: { dir?: string, spawn?: typeof spawnImpl }): Promise<Daemon> {
      context ??= {};
      context.dir ??= cwd();
      context.spawn ??= spawnImpl;
      const { argv, env } = Run(daemon, ...options);
      const [ cmd, ...args ] = argv;
      const opts = { env, cwd: context?.dir ?? cwd() }
      return Object.assign(context.spawn(cmd, args, opts), { argv, env }) as Run & ChildProcess;
    };
  }
  /** Define environment variable to be set by [Run]. */
  export function Env (name: string, value: string|null) {
    return Fn.Name(`Env(${name}=${value})`, function setEnv (context: Run) {
      context ??= {} as Run;
      context.env ??= {};
      context.env[name] = value;
      return context
    }, { name, value });
  }
  /** Define command-line arguments to be appended by [Run]. */
  export function Arg (...parts: string[]) {
    return Fn.Name(`Arg(${parts[0]})`, function addArgument (context: Run) {
      context ??= {} as Run;
      context.argv ??= []
      context.argv.push(parts.join(' '))
      return context
    }, { parts });
  }
}

const toOpt = <T extends Run>(opt: string|Run.Def): Run.Def =>
  (typeof opt === 'function') ? opt :
  (typeof opt === 'string')   ? pushArg(opt) :
  (typeof opt === 'object')   ? (context: T)=>Object.assign(context, opt) :
  Error.required(`string or function, got: ${inspect(opt)}`);

const pushArg = (opt: string) =>
  Fn.Name(opt, (run: Run) => { run.argv.push(opt); return run });

const parseStdout = (re: RegExp) =>
  ({ stdout }: { stdout: string }) => stdout.match(re)[1];

///** A collection of processes and network endpoints provided by them. */
//export type Service = Dir & Ports<number> & {
//  /** Processes comprising the service, by PID. */
//  pids: Record<number, ChildProcess>;
//  /** Terminate the service. */
//  kill: Fn<[], Fn.Async>;
//};
///** Define a service. */
//export function Service <S extends Service> (
//  name: string, ...services: Fn<[S]>[]
//) {
//  const info = `[Service (${services.length}): ${name}]`;
//  return toString(info)(Fn.Name(name, runService, { services }));
//  async function runService (
//    ctx = { ...Dir(), pids: {}, ports: {} } as Partial<S>
//  ): Promise<S> {
//    for (const service of services) await service(ctx);
//    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
//    return Object.assign(ctx, { kill, }) as unknown as S;
//  }
//}
