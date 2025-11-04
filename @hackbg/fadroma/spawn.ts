import type { Fn, Step, Async } from './index.ts';
import { execImpl, spawnImpl } from './deps.ts';
import type { ChildProcess } from './deps.ts';
import { reflect } from './call.ts';

/** Process management context. */
export type Pids = {
  stdout: string,
  stderr: string,
  /** Process IDs known to this context. */
  pids: Record<number, { pid?: number, kill?: Fn, killed?: boolean }>,
  /** Invoke an external process. */
  exec (_: Invoke): Async<ExecResult>
  /** Launch a long-running background process. */
  spawn (_: Invoke): Async<SpawnResult>
  /** Kill any running process by pid. */
  kill (id: number): Async
};

/** A command invocation. */
export type Invoke = {
  argv: string[],
  opts?: { env?: Record<string, string> }
};

/** A background process. */
export type SpawnResult = ChildProcess;

/** The result of an invocation. */
export type ExecResult = {
  pid:    number,
  output: unknown[],
  stdout: string|unknown,
  stderr: string|unknown,
  status: number|null,
  signal: string|null,
  error?: Error
}

/** Define process management context. */
export const spawnContext = <T extends Pids>({
  pids  = {},
  exec  = (async ({ argv, opts }: Invoke) => {
    return await execImpl(argv[0],  argv.slice(1), opts);
  }) as T["exec"],
  spawn = ({ argv, opts }: Invoke) => spawnImpl(argv[0], argv.slice(1), opts),
  kill  = (_pid?: number) => { throw new Error('TODO') },
  stdout = '',
  stderr = '',
  ...rest
}: Partial<T> = {}): T => ({
  pids, exec, spawn, kill, stdout, stderr, ...rest
} as T);

/** Define a background task. */
export const spawn = (arg0: string, ...opts: (Step<Invoke>|string)[]) =>
  reflect(arg0, async function spawnDaemon (ctx: Pids = spawnContext()) {
    const child = await ctx.spawn(await invoke(arg0, opts));
    if (child.pid) {
      ctx.pids[child.pid] = child;
      Object.assign(spawnDaemon, { pid: child.pid });
    }
    return ctx
  }, { arg0, opts });

/** Define a command invocation. */
export const exec = (arg0: string, ...opts: (Step<Invoke>|string)[]) =>
  reflect(arg0, async function executeInvoke (ctx: Pids = spawnContext()) {
    const result = await ctx.exec(await invoke(arg0, opts));
    if (!result) throw new Error('ctx.exec returned nothing')
    const { stdout = '', stderr = '' } = result || {};
    ctx.stdout += stdout;
    ctx.stderr += stderr;
    return ctx;
  }, { arg0, opts });

/** Compose a command invocation from opts. */
export const invoke = async (arg0: string, opts: (Step<Invoke>|string)[]) => {
  let command = { argv: [arg0], opts: {} } as Invoke;
  for (const option of opts) {
    if (typeof option === 'function') {
      command = ((await option(command)) || command) as Invoke;
    } else if (typeof option === 'string') {
      command.argv ??= []
      command.argv.push(option);
    } else if (option) {
      throw new Error('unsupported option')
    }
  }
  return command;
}

/** Set an environment variable for a command invocation */
export const setEnv = (name: string, value: string|null) =>
  reflect(name, function setEnvironmentVariable (cmd: Invoke) {
    cmd.opts ??= {};
    cmd.opts.env ??= {};
    cmd.opts.env[name] = value;
  }, { name, value });

/** Append command-line arguments to a command invocation. */
export const addArgs = (...fragments: string[]) =>
  reflect(fragments[0], function addArgument (cmd: Invoke) {
    return Object.assign(cmd, { argv: [...cmd.argv || [], fragments.join(' ')] })
  }, { fragments });
