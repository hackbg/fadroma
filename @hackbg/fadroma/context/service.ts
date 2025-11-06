import type { Fn, StepsWith, Log } from '../index.ts';
import { pipe, reflect, toString } from '../format.ts';
import { logger } from './logger.ts';
import { Tcp } from './tcp.ts';
import { FS } from './fs.ts';
import { Pids } from './spawn.ts';
/** Service context. */
export type ServiceContext = Tcp & Pids & FS & Log;
/** Create a service context. */
export const serviceContext = pipe(logger, Pids, FS, Tcp);

/** Define a service. */
export function service (name: string, ...services: Fn<[ServiceContext]>[]) {
  const info = `[Service (${services.length}): ${name}]`;
  return toString(info)(reflect(name, runService, { services }));
  async function runService (ctx = serviceContext() as ServiceContext) {
    for (const service of services) {
      ctx.info('Starting', service);
      const _instance = await service(ctx);
      ctx.log('Started', service);
    }
    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
    return { name, kill }
  }
}
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
