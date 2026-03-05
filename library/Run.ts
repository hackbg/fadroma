import Fn from './Fn.ts';
import { Dir } from './Fs.ts';
import { required } from './Err.ts';
import type { ChildProcess } from 'node:child_process';
const { inspect, promisify } = await import('node:util')
  .catch(e=>{ console.warn(e); return {} as never; });
const { spawn: spawnImpl, execFile } = await import('node:child_process')
  .catch(e=>{ console.warn(e); return {} as never; });
const { cwd } = await import('node:process')
  .catch(e=>{ console.warn(e); return { cwd: () => '.' }; });
const execImpl = promisify(execFile);
export { execFile, execImpl };
/** Invocation of outiside process. */
export type Run = { argv: string[], env?: Env };
/** Part of definition of command invocation. */
export type Step = Fn.Step<Ran>;
/** Command environment. */
export type Env = Record<string, string>;
/** Command invocation that is meant to return a result. */
export type Exec = Fn<[Partial<Dir & { exec?: typeof execImpl }>], Fn.Async<Ran>>;
/** Command invocation that is meant to spawn a [Daemon]. */
export type Spawn = Fn<[Partial<Dir & { spawn?: typeof spawnImpl }>], Daemon>;
/** A process or service that runs in the background until killed. */
export type Daemon = Run & ChildProcess & { kill (code: number): unknown; };
/** Result of process run. */
export type Ran = Run & {
  pid?:    number,
  status?: number|null,
  signal?: string|null,
  error?:  Error,
  stdout?: string|unknown,
  stderr?: string|unknown,
};
/** Define a command invocation. */
export function Run (path: string, ...opts: (Step|string)[]) {
  const context = { argv: [path], env: {} };
  return Fn.Pipe(...opts.filter(Boolean).map(toOpt))(context) as Run;
}
export namespace Run {
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
  /** Terminate a process .*/
  export function Kill (code = 9) {
    return Fn.Name('Kill process', (context: Daemon) => context.kill(code))
  }
  /** Pipe a child process's stdout/stderr. */
  export function Verbose (enabled?: boolean, stdout = process.stderr, stderr = process.stderr) {
    return Fn.Name(`Verbose: ${enabled ? 'yes' : 'no'}`, (context: Run) => {
      context.verbose = enabled;
      if (enabled) {
        context.stdout.pipe(stdout);
        context.stderr.pipe(stderr);
      }
      return context
    })
  };
}
/** Run a command and wait for result. */
export function Exec (command: string, ...options: (Step|string)[]): Exec {
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
export function Spawn (daemon: string, ...options: (Step|string)[]): Spawn {
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
const toOpt = <T extends Run>(opt: string|Step): Step =>
  (typeof opt === 'function') ? opt :
  (typeof opt === 'string')   ? pushArg(opt) :
  (typeof opt === 'object')   ? (context: T)=>Object.assign(context, opt) :
  required(`string or function, got: ${inspect(opt)}`);
const pushArg = (opt: string) =>
  Fn.Name(opt, (run: Run) => { run.argv.push(opt); return run });
