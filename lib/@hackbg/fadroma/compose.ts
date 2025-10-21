import type { StepsWithName } from './tasker.ts';
import type { Ports } from './listen.ts';
import type { Pids } from './spawn.ts';
import { reflect } from './reflect.ts';
import { listenContext } from './listen.ts';
import { spawnContext } from './spawn.ts';
export const compose: StepsWithName<Ports & Pids> = (name, ...services) =>
  reflect(name, async function spawnGroup (ctx: Pids & Ports = {
    ...listenContext(),
    ...spawnContext(),
  }) {
    for (const service of services) {
      const result = await service(ctx);
      if (result?.pid) {
        ctx.pids[result.pid] = result;
      }
      if (result?.ports) {
        for (const port of result.ports) ctx.ports[port] = result;
      }
    }
    return ctx
  }, { services });
