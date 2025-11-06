#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the, has, ok, equal }  from "./tester.ts";
import { Exec, Spawn } from '../index.ts';
import { execImpl, spawnImpl } from '../deps.ts';
export default suite(import.meta, 'Service',
  the('Container', 'Pull', 'Run', 'Kill', 'Build'),
  the('Spawn', () => equal({ ...Spawn('true', 'foo', 'bar', 'baz') }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),
    the('Exec', async () => {
      const run = Exec('true');
      equal({ ...run }, { arg0: 'true', opts: [] });
      const context = { exec: execImpl };
      equal(await run(context), context);
    })),
  the('Exec', () => equal({ ...Exec('true', 'foo', 'bar', 'baz')  }, { arg0: 'true', opts: ['foo', 'bar', 'baz'] }),
    the('Spawn', async () => {
      const context = { pids: {}, spawn: spawnImpl };
      const start = Spawn('true');
      equal({ ...start }, { arg0: 'true', opts: [] });
      equal(await start(context), context);
      ok('pid' in start);
      ok(context.pids[start.pid].pid === start.pid);
      ok(context.pids[start.pid].killed === false);
      ok(context.pids[start.pid].kill());
      ok(context.pids[start.pid].killed === true);
    })));
