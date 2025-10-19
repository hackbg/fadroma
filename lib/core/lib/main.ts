import { exit, argv, fileURLToPath, setImmediate } from '../deps.ts';
export type Meta = Partial<ImportMeta>;
export type Main = ((...args: string[])=>unknown);
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
  main: ((...args: string[])=>unknown),
  alt?: unknown
) {
  const [_, argv1, ...args] = argv
  if (isEntrypoint(meta, argv1)) setImmediate(async ()=>{
    try {
      await Promise.resolve(main(...args))
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
  (!(meta === false)) && (
    (meta === true) || (!!meta.main) || (meta.url && fileURLToPath(meta.url) == argv1)
  );
