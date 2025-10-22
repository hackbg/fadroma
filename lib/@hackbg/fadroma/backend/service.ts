import type { Step, StepsWith, Net, Pids, FS, Log } from '../index.ts';

import { logger } from '../format/logger.ts';
import { reflect, pipe } from '../call.ts';
import { netContext } from './net.ts';
import { spawnContext } from './proc.ts';
import { fsContext } from './fs.ts';

export type ServiceContext = Net & Pids & FS & Log;

export const serviceContext = pipe(logger, spawnContext, fsContext, netContext);

export type ServiceComponent = Step<ServiceContext>;

export const service: StepsWith<string, ServiceContext> =
  (name, ...services: ServiceComponent[]) => reflect(name,
    async function spawnGroup (ctx: ServiceContext = serviceContext({})) {
      for (const service of services) {
        console.debug(service);
        await service(ctx)
      };
      return Object.assign(ctx, {
        kill: (_pid?: number) => {
          if (typeof pid === 'number') throw new Error('TODO');
          return Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()))
        }
      });
    }, { services });
