import type { Spawn, Option, Context } from './types.ts';
import { pipe, renamed } from './deps.ts';

export const compose = (name: string, ...spawns: Spawn[]) => Object.assign(
  renamed(name, async function spawnGroup (context: Context) {
    for (const spawn of spawns) {
      const result = await spawn(context);
      if (result.pid) context.pids[result.pid] = result;
      if (result.ports) for (const port of result.ports) context.ports[port] = result;
    }
  }), { spawns })

export const run = (name: string, ...options: Option[]) => (context: Context) => {}

export const arg = (...value: string[]) => (context: Context) => {}

export const setEnv = (name: string, value: string|null) => (context: Context) => {}

export const container = (name, ...options) => { throw new Error('TODO') };

export const image = (name, ...options) => { throw new Error('TODO') };

export const distro = (name, ...options) => { throw new Error('TODO') };

export const pkg = (name, ...options) => { throw new Error('TODO') };

export const shell = (...options: Option[]) => pipe(...options);

export const spawn = (...options: Option[]) => pipe(...options);

export const serve = (...routes: Option[]) => pipe(...options);

export const rest = (path, ...options: Option[]) => pipe(...options);

export const get = (path, ...options: Option[]) => pipe(...options);

export const post = (path, ...options: Option[]) => pipe(...options);

export const ware = (path, ...options: Option[]) => pipe(...options);

export const every = (path, ...options: Option[]) => pipe(...options);
