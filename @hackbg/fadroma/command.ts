import type { Meta, Main } from './index.ts';
import { setImmediate, argv, exit, fileURLToPath } from './deps.ts';

/** If the current module is the program entrypoint,
  * runs the given main function as a separate task.
  *
  * If the task throws, the error is logged and the process exits.
  * The exit code can be specified by the `exitCode` field of the
  * thrown exception. If not specified, it defaults to 1.
  *
  * Example:
  *
  *   export default entrypoint(import.meta.main || import.meta.url, main)
  *   async function main (...args: string[]) {
  *     console.log('Program arguments:', ...args)
  *   }
  *
  * */
export function entrypoint <M extends Main> (meta: Meta, main: M): M;
export function entrypoint <N> (meta: Meta, main: Main, alt: N): N;
export function entrypoint (
  meta: Partial<ImportMeta> = {},
  main: (args: string[])=>unknown,
  alt?: unknown
) {
  const [_, argv1, ...args] = argv
  if (isEntrypoint(meta || {}, argv1)) setImmediate(async ()=>{
    try {
      await Promise.resolve(main(args));
      exit(0);
    } catch (e) {
      const error = e as Error & { exitCode?: number };
      console.error(error);
      exit(error.exitCode ?? 1);
    }
  })
  if (alt) return alt
  return main
}

export const isEntrypoint = (meta: boolean|Partial<ImportMeta>, argv1: string) =>
  (!(meta === false)) && (false
    || (meta === true)
    || (!!meta?.main)
    || (meta?.url && fileURLToPath(meta?.url) == argv1));
export const command = (name, ...steps) => () => { throw new Error('TODO') }

export const commandOption = (name, ...steps) => () => { throw new Error('TODO') }

export const CLI = command(null,
  command('build',
    command('debug'),
    command('mocks'),
    command('release')),
  command('clone'),
  command('deploy'),
  command('keys',
    command('check'),
    command('regen')),
  command('localnet',
    command('deployed'),
    command('wait')),
  command('repl'),
  command('test',
    commandOption('full'),
    commandOption('debug')))
