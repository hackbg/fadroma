import { exit, argv, fileURLToPath, setImmediate } from './deps.ts';

export type Meta = Partial<ImportMeta>;

export type Main = (args: string[]) => unknown;

export type Step<T = unknown> = (context: T) => unknown;

export type Steps<T = unknown> =
  (...steps: Step<T>[])  => Step<T>;

export type StepsWithName<T = unknown> =
  (name: string, ...steps: Step<T>[]) => Step<T>;

export type StepsWithPort<T = unknown> =
  (port: string, ...steps: Step<T>[]) => Step<T>;

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
  if (isEntrypoint(meta, argv1)) setImmediate(async ()=>{
    try {
      await Promise.resolve(main(args))
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
export { task }

export async function timed <T> (
  fn: ()=>Promise<T>, cb: (ctx: { elapsed: string, result: T })=>unknown
): Promise<T> {
  const t0 = performance.now()
  const result = await fn()
  const t1 = performance.now()
  cb({
    elapsed: ((t1-t0)/1000).toFixed(3)+'s',
    result
  })
  return result as T
}

export async function optionallyParallel <T> (parallel: boolean|undefined, thunks: Array<()=>Promise<T>>) {
  if (parallel) {
    return await Promise.all(thunks.map(thunk=>thunk()))
  }
  const results = []
  for (const thunk of thunks) {
    results.push(await thunk())
  }
  return results
}

task.count = 0;
task.parallel = () => { throw new Error('TODO') }
function task (name: Stringy, ...steps: MaybeAsyncFn<unknown>[]) {
  const t0 = performance.now()
  if (steps.length === 0) return taskZero()
  if (steps.length === 1) return taskOne()
  return taskMany()
  async function taskZero () {
    const id = ++task.count
    console.log(`🙂 Step #${id}: ${name} (T+${(t0/1000).toFixed(3)}s)`)
    console.log(`Milestone reached.`)
  }
  async function taskOne () {
    const id = ++task.count
    console.log(`⭐️ Step #${id}: ${name} (T+${(t0/1000).toFixed(3)}s)`)
    try {
      const result = await steps[0]()
      const tD = performance.now() - t0
      const end = ((result === undefined) ? '.' : stringify(result, 2, 2));
      console.log(`🟢 Step #${id}: ${name} - done in ${formatMsec(tD)}` + end)
      return result
    } catch (e) {
      const tD = performance.now() - t0
      const error = formatError(e as Error)
      console.log(`🔴 Step #${id}: ${name} - fail in ${formatMsec(tD)}: ${error.message}`)
      throw error
    }
  }
  async function taskMany () {
    const id = ++task.count
    console.log(`📋️ Step #${id}: ${name} (T+${(t0/1000).toFixed(3)}s): ${steps.length} substeps`)
    const results = []
    try {
      for (const index in steps) {
        const step = steps[index]
        try {
          const result = await step()
          const tD = performance.now() - t0
          const end = ((result === undefined) ? '.' : stringify(result, 2, 2));
          console.log(`🟢 Step #${id}.${index}: ${name} - done in ${formatMsec(tD)}` + end)
          results.push(result)
        } catch (e) {
          const tD = performance.now() - t0
          const error = formatError(e as Error)
          console.log(`🔴 Step #${id}.${index}: ${name} - fail in ${formatMsec(tD)}: ${error.message}`)
          throw error
        }
      }
      return results
    } catch (e) {
      const tD = performance.now() - t0
      const error = formatError(e as Error)
      console.log(`🔴 Step #${id}: ${name} - fail in ${formatMsec(tD)}: ${error.message}`)
      throw error
    }
  }
}
