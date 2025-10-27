import type { Fn, Step, StepsWith, Tcp, Log, Async } from './index.ts';
import { execImpl, spawnImpl } from './deps.ts';
import type { ChildProcess } from './deps.ts';
import { pipe, reflect } from './call.ts';
import { logger } from './logger.ts';
import { tcpContext } from './network.ts';
import { fsContext } from './codegen.ts';
/** Define process management context. */
export const spawnContext = ({
  pids  = {},
  exec  = async ({ argv, options }: Command) => {
    return await execImpl(argv[0],  argv.slice(1), options);
  },
  spawn = ({ argv, options }: Command) => spawnImpl(argv[0], argv.slice(1), options),
  kill  = (_pid?: number) => { throw new Error('TODO') },
  stdout = '',
  stderr = '',
  ...rest
} = {}) => ({ pids, exec, spawn, kill, stdout, stderr, ...rest });
/** Process management context. */
export type Pids = {
  stdout: string|unknown,
  stderr: string|unknown,
  /** Process IDs known to this context. */
  pids: Record<number, { kill?: Fn }>,
  /** Invoke an external process. */
  exec  (_: Command): Async<ExecResult>
  /** Launch a long-running background process. */
  spawn (_: Command): Async<SpawnResult>
  /** Kill any running process by pid. */
  kill  (id: number): Async
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
    const child = await ctx.spawn(await buildCommand(arg0, options));
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
    if (!result) throw new Error('ctx.exec returned nothing')
    const { stdout = '', stderr = '' } = result || {};
    ctx.stdout += stdout;
    ctx.stderr += stderr;
    return ctx;
  }, { arg0, options });
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
/** A context for building and running containers
  * either via Podman/Buildah, or via Docker. */
export type OCIContext = {
  builder: 'buildah'|'docker'|unknown
  images: Record<string, OCIImage>,
  runtime: 'podman'|'docker'|unknown
  containers: Record<string, OCIContainer>
};
/** A running container. */
export type OCIContainer = { name: string };
/** A container image. */
export type OCIImage = {
  name: string, tag: string, url: string, layers: OCILayer[], };
/** A layer of a container image. */
export type OCILayer = { command: string };
/** Define a container to run. */
export const ociContainer: StepsWith<string, OCIContext> =
  (_name, ..._options) => { throw new Error('TODO') };
/** Define an image to pull or build. */
export const ociImage: StepsWith<string, OCIContext> =
  (_name, ..._options) => { throw new Error('TODO') };
/** Define an image layer. */
export const ociLayer: StepsWith<string, OCILayer> =
  (_name, ..._options) => { throw new Error('TODO') };
/** Define a distro (base layer + packages). */
export const distro: StepsWith<string, OCIContext> =
  (_name, ..._options) => { throw new Error('TODO') };
/** Define a distro package. */
export const distroPkg: StepsWith<string, OCIContext> =
  (_name, ..._options) => { throw new Error('TODO') };
/** Service context. */
export type ServiceContext = Tcp & Pids & FS & Log;
/** Create a service context. */
export const serviceContext = pipe(
  logger, spawnContext, fsContext, tcpContext);
/** Define a service. */
export const service: StepsWith<string, ServiceContext> =
  (name, ...services: ServiceComponent[]) => reflect(name,
    async function spawnGroup (ctx = serviceContext() as ServiceContext) {
      for (const service of services) await service(ctx);
      const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
      return { name, kill }
    }, { services });
/** A service. */
export type Service = Pick<ServiceContext, 'pids'|'ports'> &
  { name: string, kill (): Promise<void> };
export type ServiceComponent = Step<ServiceContext>;
