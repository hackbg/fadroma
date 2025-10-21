import type { ChildProcess } from './deps.ts';
import { execImpl, spawnImpl } from './deps.ts';
import { pipe, reflect } from './index.ts';

const { assign } = Object;

export type SpawnContext =
  { pids: Record<number, unknown>
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

export const spawnContext = (): SpawnContext => (
  { pids:  {}
  , exec:  ({ argv, options }: Command) => execImpl(argv[0], argv.slice(1), options)
  , spawn: ({ argv, options }: Command) => spawnImpl(argv[0], argv.slice(1), options)
  , kill (_?: number) {} });

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
  assign(function spawnDaemon (ctx: SpawnContext = spawnContext()) {
    return ctx.spawn(buildCommand(arg0, options));
  }, { arg0, options });

export const exec = (arg0: string, ...options: (Option|string)[]) =>
  assign(function callShell (ctx: SpawnContext = spawnContext()) {
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

type OCI = { images: Record<string, Image>, containers: Record<string, Container> };
type Image = { /*TODO*/ };
type Container = { /*TODO*/ };
export const container: StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };
export const image:     StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };
export const distro:    StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };
export const pk:        StepsWithName<OCI> = (name, ...options) => { throw new Error('TODO') };

export const every = (path, ...options: Option[]) =>
  pipe(...options);

