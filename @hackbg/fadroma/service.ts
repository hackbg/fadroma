import type { Fn, StepsWith, Tcp, Log, FS, Pids } from './index.ts';
import { pipe, reflect } from './call.ts';
import { logger } from './logger.ts';
import { tcpContext } from './tcp.ts';
import { fsContext } from './codegen.ts';
import { spawnContext } from './spawn.ts';
/** Service context. */
export type ServiceContext = Tcp & Pids & FS & Log;
/** Create a service context. */
export const serviceContext = pipe(
  logger, spawnContext, fsContext, tcpContext);
/** Define a service. */
export const service = (name: string, ...services: Fn<[ServiceContext]>[]) => reflect(name,
  async function spawnGroup (ctx = serviceContext() as ServiceContext) {
    for (const service of services) {
      console.log('Starting', service);
      const instance = await service(ctx);
      console.log('Started', service);
    }
    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
    return { name, kill }
  }, { services });
/** A service. */
export type Service = Pick<ServiceContext, 'pids'|'ports'> &
  { name: string, kill (): Promise<void> };
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
