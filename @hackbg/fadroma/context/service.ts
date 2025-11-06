import type { Fn, Step, Async } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { execImpl, spawnImpl } from '../deps.ts';
import { Error, pipe, reflect, toString } from '../format.ts';

/** A collection of processes and network endpoints provided by them. */
export type Service = {
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
  return toString(info)(reflect(name, runService, { services }));
  async function runService (ctx: Partial<S> = { pids: {}, ports: {} } as S): Promise<S> {
    for (const service of services) await service(ctx);
    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
    return Object.assign(ctx, { kill, }) as unknown as S;
  }
}

/** A command invocation. */
export type Run = {
  argv:    string[],
  opts?:   { env?: Record<string, string> },
  handle?: ChildProcess
  pid?:    number,
  output?: unknown[],
  stdout?: string|unknown,
  stderr?: string|unknown,
  status?: number|null,
  signal?: string|null,
  error?:  Error,
};

/** Run a command and wait for result. */
export const Exec = (command: string, ...options: (Step<Run>|string)[]) =>
  reflect(`Exec(${command})`, async function exec (context = { exec: execImpl }): Promise<Run> {
    const { argv, opts } = Run(command, ...options);
    return { argv, opts, ...await context.exec(argv[0], argv.slice(1), opts) };
  });

/** Run a background service. */
export const Spawn = (daemon: string, ...options: (Step<Run>|string)[]) =>
  reflect(`Spawn(${daemon})`, async function spawn (context = { spawn: spawnImpl }): Promise<Run> {
    const { argv, opts } = Run(daemon, ...options);
    return { argv, opts, handle: await context.spawn(argv[0], argv.slice(1), opts) };
  });

/** Compose command invocation from options. */
export const Run = (path: string, ...opts: (Step<Run>|string)[]) =>
  pipe(...opts.filter(Boolean).map(toOpt))({ argv: [path], opts: {} }) as Run;
const toOpt = (opt: string|Step<Run>): Step<Run> =>
  (typeof opt === 'function') ? opt :
  (typeof opt === 'string') ? pushArg(opt) :
  Error.required('string or function');
const pushArg = (opt: string) =>
  reflect(opt, (run: Run) => { run.argv.push(opt); return run });

/** Set an environment variable for a command invocation */
export const Env = (name: string, value: string|null) =>
  reflect(name, function setEnvironmentVariable (run: Run) {
    run.opts ??= {};
    run.opts.env ??= {};
    run.opts.env[name] = value;
  }, { name, value });

/** Append command-line arguments to a command invocation. */
export const Arg = (...parts: string[]) => reflect(`Arg: parts[0]`,
  function addArgument (run: Run) {
    return Object.assign(run, { argv: [...run.argv || [], parts.join(' ')] })
  }, { parts });
