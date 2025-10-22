import type { StepsWithName } from './call.ts';
import type { Net } from './net.ts';
import type { Pids } from './spawn.ts';
import type { FS } from './fs.ts';
import type { Log } from './log.ts';
import { reflect } from './call.ts';
import { netContext } from './net.ts';
import { spawnContext } from './spawn.ts';
import { fsContext } from './fs.ts';
export const compose: StepsWithName<Net & Pids & FS & Log> =
  (name, ...services) => reflect(name, async function spawnGroup (ctx = {
    ...netContext(), ...spawnContext(), ...fsContext(),
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
