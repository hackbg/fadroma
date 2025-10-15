import type { Context } from '../types.ts'
import { pipe } from '../deps.ts';

/** Use this to stub a test. */
export const todo = (...info: string[]) => Object.assign(function todo (context: Context) {
  context.todo(0, info[0], info[1], ...info.slice(2));
  return context;
}, { info })

export const matrix = <T>(
  name: string, variants: T[], ...tests: ((T)=>unknown)[]
) => () =>
  Promise.all(variants.map(variant=>pipe(tests)(variant)))

/** A **test suite** consists of a name and one or more **test case**s.
  * 
  * - The test suite acts as a checklist, and logs the
  *   outcome of each test case. 
  * - Test cases are functions.
  *   Using `test`, `testAx`, `testTx` can help you prepare them.
  * - The return value of each test case is NOT passed to the next one.
  * - The return value of each test case is preserved,
  *   and an array of return values is returned at the end.
  * A **test case** consists of a name and one or more **test step**s.
  * 
  * - Test steps are functions. Using `call` can help you prepare them.
  * - Each function receives the awaited return value of the previous one.
  * - If no test step throws an uncaught exception, the test case is a pass.
  **/
export const expect = (name: string, ...tests) =>
  renamed(name, async function suiteRun (context: Context = {}) {
    const label = [context.prefix, name].filter(Boolean).join(': ');
    return context.track(context.count, label, suiteRunTracked);
    async function suiteRunTracked () {
      const results = tests.map(()=>{});
      for (const index in tests) {

        // FIXME: unify `suite` and `expect`
        const order   = String(Number(index)+1);
        const counter = [context.count, order].filter(Boolean).join('.');
        const context = { report, count: counter, prefix: name };
        const result  = await tests[index](context);
        results.push(result);

        /* Without step counting:
        // FIXME: unify `suite` and `expect`
        let step, state
        try {
          for (step of steps) state = await step(state) ?? state
          return state
        } catch (e) {
          e.stack ||= ''
          if (step.stack) e.stack += '\n  Test defined at:\n' + step.stack.join('\n')
          throw e
        }
        */

      }
      return results
    }
  })

/** A **test case** for expecting an exception to be thrown. */
export const forbid = (name, fn, callback?) => {
  name = [`Forbid`, name].filter(Boolean).join(': ')
  return renamed(name, async function forbidRun (context: Context = {}) {
    const label = [context.prefix, name].filter(Boolean).join(': ')
    return context.track(context.count, label, async function forbidRunTracked() {
      let result
      let error
      try {
        result = await fn()
        error = new Error(`${name}: missing expected rejection, got: ${result}`)
      } catch (e) {
        if (callback) e = await callback(e)
        return e
      }
      throw Object.assign(error, { name, result })
    })
  })
}

function renamed (value, fn) {
  Object.defineProperty(fn, 'name', { value })
  return fn
}

export const includes = (x) => line => line.includes(x)

export function assertLength (length, x, name) {
  equal(x?.length, length, name)
  return x
}
