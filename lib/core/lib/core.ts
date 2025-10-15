import { exit, argv, fileURLToPath } from '../deps.ts'
import type { Colorful } from '../index.ts';

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
export const entrypoint = <F extends ((...args: string[])=>unknown)> (
  url: boolean|string|URL, callback: F
): F => {
  const [_, main, ...args] = argv
  const shouldRun = (url === true) || ((url !== false) && (main === fileURLToPath(url)));
  if (shouldRun) setImmediate(()=>Promise
    .resolve(callback(...args))
    .catch((e: Error & { exitCode?: number })=>{
      console.error(e);
      exit(e.exitCode ?? 1);
    }))
  return callback
}

export type Id = string|number|bigint
export type Identified<I extends Id> = { id: I };

export type Name   = string
export type Named  = { name: Name };

export type Hash   = string;
export type Hashed = { hash: Hash };

export type Info   = { summary (), details () };

export type Entity<I extends Id> = Identified<I> & Partial<Named & Colorful>;
