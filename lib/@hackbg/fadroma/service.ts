import type { Step, StepsWith, Net, Pids, Log } from './index.ts';
import { logger } from './logger.ts';
import { reflect, pipe } from './call.ts';
import { netContext } from './network.ts';
import { spawnContext } from './service/proc.ts';
import { fsContext } from './service/fs.ts';

export * from './service/fs.ts';
export * from './service/oci.ts';
export * from './service/proc.ts';

/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths: Record<string, unknown>
};

/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FS) => FS;

export type ServiceContext = Net & Pids & FS & Log;

export const serviceContext = pipe(logger, spawnContext, fsContext, netContext);

export type ServiceComponent = Step<ServiceContext>;

export const service: StepsWith<string, ServiceContext> =
  (name, ...services: ServiceComponent[]) => reflect(name,
    async function spawnGroup (ctx: ServiceContext = serviceContext({})) {
      for (const service of services) {
        //console.debug(service);
        await service(ctx)
      };
      return Object.assign(ctx, {
        kill: (_pid?: number) => {
          if (typeof pid === 'number') throw new Error('TODO');
          return Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()))
        }
      });
    }, { services });
