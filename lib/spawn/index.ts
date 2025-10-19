import type { Spawn, Option, Context } from './types.ts';
import { pipe } from './deps.ts';
export const service = (name: string, ...spawns) => Object.assign(
  async function spawnGroup (context: Context) {
    for (const spawn of spawns) {
      const result = await spawn(context);
      if (result.pid) context.pids[result.pid] = result;
    }
  }, { spawns })
export const spawn = (name: string, ...options: Option[]) => (context: Context) => {}
export const run   = (name: string, ...options: Option[]) => (context: Context) => {}
export const docker = (...options: Option[]) => Object.assign(function dockerInvoke (spawn: Spawn) {
  const context = pipe(...options)({ argv: ['docker'] });
}, { options });
export const runInContainer = (name, ...options) => { throw new Error('TODO') };
export const buildImage = (name, ...options) => { throw new Error('TODO') };
export const distro = (name, ...options) => { throw new Error('TODO') };
export const pkg = (name, ...options) => { throw new Error('TODO') };
export const command: Option = (command: 'build'|'run') =>
  (context: Context) => Object.assign(context, { argv: [...context.argv, command] })
