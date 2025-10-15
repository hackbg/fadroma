import { stringify, formatMsec, formatError } from './client.ts'
export { task }
task.count = 0;
task.parallel = () => { throw new Error('TODO') }
export type TaskStep<T> = (()=>T)|(()=>Promise<T>);
function task (name, ...steps: TaskStep<unknown>[]) {
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
      e = formatError(e)
      console.log(`🔴 Step #${id}: ${name} - fail in ${formatMsec(tD)}: ${e.message}`)
      throw e
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
          e = formatError(e)
          console.log(`🔴 Step #${id}.${index}: ${name} - fail in ${formatMsec(tD)}: ${e.message}`)
          throw e
        }
      }
      return results
    } catch (e) {
      const tD = performance.now() - t0
      e = formatError(e)
      console.log(`🔴 Step #${id}: ${name} - fail in ${formatMsec(tD)}: ${e.message}`)
      throw e
    }
  }
}
