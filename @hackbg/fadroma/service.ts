import type { Fn, Step, StepsWith, Tcp, Log, Async, FS } from './index.ts';
import { execImpl, spawnImpl } from './deps.ts';
import type { ChildProcess } from './deps.ts';
import { pipe, reflect } from './call.ts';
import { logger } from './logger.ts';
import { tcpContext } from './network.ts';
import { fsContext } from './codegen.ts';
/** Service context. */
export type ServiceContext = Tcp & Pids & FS & Log;
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
/** Define a background task. */
export const spawn = (arg0: string, ...opts: (Step<Invoke>|string)[]) =>
  reflect(arg0, async function spawnDaemon (ctx: Pids = spawnContext()) {
    const child = await ctx.spawn(await buildInvoke(arg0, opts));
    if (child.pid) {
      ctx.pids[child.pid] = child;
      Object.assign(spawnDaemon, { pid: child.pid });
    }
    return ctx
  }, { arg0, opts });
/** Define a command invocation. */
export const exec = (arg0: string, ...opts: (Step<Invoke>|string)[]) =>
  reflect(arg0, async function executeInvoke (ctx: Pids = spawnContext()) {
    const result = await ctx.exec(await buildInvoke(arg0, opts));
    if (!result) throw new Error('ctx.exec returned nothing')
    const { stdout = '', stderr = '' } = result || {};
    ctx.stdout += stdout;
    ctx.stderr += stderr;
    return ctx;
  }, { arg0, opts });
/** Compose a command invocation from opts. */
export const buildInvoke = async (arg0: string, opts: (Step<Invoke>|string)[]) => {
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
  (_name, ..._opts) => { throw new Error('TODO') };
/** Define an image to pull or build. */
export const ociImage: StepsWith<string, OCIContext> =
  (_name, ..._opts) => { throw new Error('TODO') };
/** Define an image layer. */
export const ociLayer: StepsWith<string, OCILayer> =
  (_name, ..._opts) => { throw new Error('TODO') };
/** Define a distro (base layer + packages). */
export const distro: StepsWith<string, OCIContext> =
  (_name, ..._opts) => { throw new Error('TODO') };
/** Define a distro package. */
export const distroPkg: StepsWith<string, OCIContext> =
  (_name, ..._opts) => { throw new Error('TODO') };
