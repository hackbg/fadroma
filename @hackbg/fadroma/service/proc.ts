import type { ChildProcess } from '../deps.ts';
import type { Fn, Step } from '../index.ts';
import { execImpl, spawnImpl } from '../deps.ts';
import { reflect } from '../call.ts';
/** Define a process management context. */
export const spawnContext = ({
  pids  = {},
  exec  = ({ argv, options }: Command) => execImpl(argv[0],  argv.slice(1), options),
  spawn = ({ argv, options }: Command) => spawnImpl(argv[0], argv.slice(1), options),
  kill  = (_pid?: number) => { throw new Error('TODO') },
  ...rest
} = {}) => ({ pids, exec, spawn, kill, ...rest });
/** A process management context. */
export type Pids = {
  /** Process IDs known to this context. */
  pids: Record<number, { kill?: Fn }>,
  /** Invoke an external process. */
  exec  (_: Command): ExecResult
  /** Launch a long-running background process. */
  spawn (_: Command): SpawnResult
  /** Kill any running process by pid. */
  kill  (id: number): Promise<unknown>
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
/** A command invocation. */
export type Command = {
  argv:     string[],
  options?: { env?: Record<string, unknown> }
};
/** Define a background task. */
export const spawn = (arg0: string, ...options: (Step<Command>|string)[]) =>
  reflect(arg0, async function spawnDaemon (ctx: Pids = spawnContext()) {
    const child = ctx.spawn(await buildCommand(arg0, options));
    if (child.pid) {
      ctx.pids[child.pid] = child;
      Object.assign(spawnDaemon, { pid: child.pid });
    }
    return ctx
  }, { arg0, options });
/** Define a command invocation. */
export const exec = (arg0: string, ...options: (Step<Command>|string)[]) =>
  reflect(arg0, async function executeCommand (ctx: Pids = spawnContext()) {
    const result = await ctx.exec(await buildCommand(arg0, options));
    return ctx;
  }, { arg0, options });;
/** Compose a command invocation from options. */
export const buildCommand = async (arg0: string, options: (Step<Command>|string)[]) => {
  let command = { argv: [arg0], options: {} };
  for (const option of options) {
    if (typeof option === 'function') {
      command = ((await option(command)) || command);
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
  reflect(name, function setEnvironmentVariable (cmd: Command) {
    cmd.options ??= {};
    cmd.options.env ??= {};
    cmd.options.env[name] = value;
  }, { name, value });
/** Append command-line arguments to a command invocation. */
export const addArgs = (...fragments: string[]) =>
  reflect(fragments[0], function addArgument (cmd: Command) {
    return Object.assign(cmd, { argv: [...cmd.argv || [], fragments.join(' ')] })
  }, { fragments });
