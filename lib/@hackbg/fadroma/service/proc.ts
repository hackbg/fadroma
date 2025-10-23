import type { ChildProcess } from '../deps.ts';
import type { Fn, Step } from '../index.ts';
import { execImpl, spawnImpl } from '../deps.ts';
import { reflect } from '../call.ts';

export const spawnContext = ({
  pids  = {},
  exec  = ({ argv, options }: Command) => execImpl(argv[0],  argv.slice(1), options),
  spawn = ({ argv, options }: Command) => spawnImpl(argv[0], argv.slice(1), options),
  kill  = (_pid?: number) => { throw new Error('TODO') },
  ...rest
} = {}) => ({ pids, exec, spawn, kill, ...rest });

export type Pids =
  { pids: Record<number, { kill?: Fn }>
  , kill  (id: number): Promise<unknown>
  , spawn (_: Command): ChildProcess
  , exec  (_: Command): { pid:    number
                        , output: unknown[]
                        , stdout: string|unknown
                        , stderr: string|unknown
                        , status: number|null
                        , signal: string|null
                        , error?: Error }; };

export type Command =
  { argv:     string[]
  , options?: { env?: Record<string, unknown> } };

export type CommandOption = Step<Command>;

export const spawn = (arg0: string, ...options: (CommandOption|string)[]) =>
  reflect(arg0, async function spawnDaemon (ctx: Pids = spawnContext()) {
    const child = ctx.spawn(await buildCommand(arg0, options));
    if (child.pid) {
      ctx.pids[child.pid] = child;
      Object.assign(spawnDaemon, { pid: child.pid });
    }
    return ctx
  }, { arg0, options });

export const exec = (arg0: string, ...options: (CommandOption|string)[]) =>
  reflect(arg0, async function executeCommand (ctx: Pids = spawnContext()) {
    const result = await ctx.exec(await buildCommand(arg0, options));
    return ctx;
  }, { arg0, options });;

export const buildCommand = async (arg0: string, options: (CommandOption|string)[]) => {
  let command = { argv: [arg0], options: {} };
  for (const option of options) {
    if (typeof option === 'function') {
      command = await (option(command) || command);
    } else if (typeof option === 'string') {
      command.argv ??= []
      command.argv.push(option);
    } else if (option) {
      throw new Error('unsupported option')
    }
  }
  return command;
}

export const setEnv = (name: string, value: string|null) =>
  reflect(name, function setEnvironmentVariable (cmd: Command) {
    cmd.options ??= {};
    cmd.options.env ??= {};
    cmd.options.env[name] = value;
  }, { name, value });

export const addArgs = (...fragments: string[]) =>
  reflect(fragments[0], function addArgument (cmd: Command) {
    return Object.assign(cmd, { argv: [...cmd.argv || [], fragments.join(' ')] })
  }, { fragments });
