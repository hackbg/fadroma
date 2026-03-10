import type Fn from './Fn.ts';

export default Main;

/** A program's entrypoint. */
type Main = Fn.Takes<[{ args: string[], exit: Fn }]>;

/** If the current module is the program entrypoint,
  * runs the given main function **on next tick**.
  *
  * If the task throws, the error is logged and the process exits.
  * The exit code can be specified by the `exitCode` field of the
  * thrown exception. If not specified, it defaults to 1.
  *
  * Example:
  *
  *   import { Fn } from '@hackbg/fadroma';
  *   export default Fn.Main(import.meta.main || import.meta.url, main)
  *   async function main (...args: string[]) {
  *     console.log('Program arguments:', ...args)
  *   }
  *
  * */
function Main <M extends Main> (meta: Main.Meta = {}, main: M) {
  const [_, argv1, ...args] = argv;
  if (Main.is(meta || {}, argv1)) setTimeout(async ()=>{
    try {
      await Promise.resolve(main({ args, exit }));
      //exit(0);
    } catch (e) {
      const error = e as Error & { exitCode?: number };
      console.error('Main threw:', error);
      //exit(error.exitCode ?? 1);
    }
  }, 0)
}

namespace Main {
  /** Used to recognize entrypoint. */
  export type Meta = Partial<ImportMeta>;
  /** Return true if the entrypoint matches. */
  export const is = function isMain (meta: boolean|Meta, argv1: string) {
    if (meta === false) return false;
    if (meta === true) return true;
    if (meta?.main) return true;
    if (meta?.url && fileURLToPath(meta?.url) == argv1) return true;
  };
  // Inlined to not require polyfill.
  const fileURLToPath = (url: string|URL) => {
    url = new URL(url);
    if (url.protocol !== 'file:') throw new Error('not a file URL');
    return url.pathname;
  }
}

const { exit, argv } = await import('node:process').catch(e=>{
  console.warn(e);
  return { exit () {}, argv: [] }
});
