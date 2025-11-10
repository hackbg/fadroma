#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the, has, ok, equal }  from "./tester.ts";
import { Exec, Spawn, Arg, Env } from '../index.ts';
import { execImpl, spawnImpl } from '../deps.ts';
export default suite(import.meta, 'Service',
  the('Container', 'Pull', 'Run', 'Kill', 'Build'),
  the('Exec', () => Exec('true', 'foo', Env('ENV', 1)),
    has({ argv: ['true', 'foo'], env: { ENV: 1 } }),
    exec => exec({ exec: execImpl })),
  the('Spawn', () => Spawn('true', 'foo', Env('ENV', 2)),
    has({ argv: ['true', 'foo'], env: { ENV: 2 } }),
    spawn => spawn({ pids: {}, spawn: spawnImpl }),
    has('argv'), has('env'), has('pid')));
