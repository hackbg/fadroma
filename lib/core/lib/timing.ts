import type { TaskStep, Stringy } from '../types.ts';
import { stringify, formatMsec } from './format.ts';
import { formatError } from './error.ts';

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
function task (name: Stringy, ...steps: TaskStep<unknown>[]) {
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
