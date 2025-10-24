import type { Step, StepsWith, Net, Pids, Log, FS } from './index.ts';
import { logger } from './logger.ts';
import { reflect, pipe } from './call.ts';
import { netContext } from './network.ts';
import { spawnContext } from './service/proc.ts';
import { fsContext } from './service/fs.ts';
export * from './service/fs.ts';
export * from './service/oci.ts';
export * from './service/proc.ts';
export type ServiceContext = Net & Pids & FS & Log;
export type Service = Pick<ServiceContext, 'pids'|'ports'> &
  { name: string, kill (): Promise<void> };
export const serviceContext = pipe(logger, spawnContext, fsContext, netContext);
export type ServiceComponent = Step<ServiceContext>;
export const service: StepsWith<string, ServiceContext> =
  (name, ...services: ServiceComponent[]) => reflect(name,
    async function spawnGroup (ctx: ServiceContext) {
      const pids = {}, ports = {};
      for (const service of services)
        await service({ ...ctx, pids, ports });
      const kill = () => Promise.all(Object.values(ctx.pids)
        .map(proc=>proc.kill()));
      return { name, ports, pids, kill }
    }, { services });
