import type { Context, Step } from '../types.ts'
import { defTestReport } from './report.ts';
import { renamed, pipe } from '../deps.ts';

/** Define a test suite.
  *
  * Example:
  *
  *     import { entrypoint, suite, expect, todo } from '@fadroma/tester';
  *     export default entrypoint(import.meta, suite(,
  *       expect('Test A', todo()),
  *       expect('Test B'
  *         expect('Test C', todo())
  *         expect('Test D', todo()))))
  **/
export const suite = (...steps: Test.Step[]) =>
  Object.assign(async function runTests (suite) {
    Error.stackTraceLimit = Infinity;
    const run     = pipe(...steps);
    const report  = defTestReport();
    const context = report.context();
    let error, result;
    try { result = await run(context) } catch (e) { error = e }
    console.log([report.details(), report.summary()].filter(Boolean).join('\n'));
    if (error) throw error;
    return result;
  }, { steps });

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
export const expect = (label: string, ...tests: Step[]) =>
  Object.assign(renamed(label, function expect (
    context: Context = defTestReport().context()
  ) {
    return context.track(
      context.count,
      [context.crumb, label].filter(Boolean).map(x=>x.trim()).join(': '),
      async function expectation (context: Context) {
        for (const index in tests) {
          try {
            const step = tests[index];
            const count = [context.count, String(Number(index)+1)].filter(Boolean).join('.');
            const result = await context.track(count, label, step) ?? context;
            //if (result !== context) warnReturn(context, count, result);
          } catch (error) {
            throw addStepStack(tests[index], error as Error);
          }
        }
        return context;
      });
  }), { label, tests });

/** A **test case** for expecting an exception to be thrown. */
export const forbid = (
  name: string,
  failure: (_: Context)=>unknown,
  ...tests: Array<(_: Error)=>unknown>
) => {
  name = [`Forbid`, name].filter(Boolean).join(': ')
  return renamed(name, function forbidRun (context: Context) {
    const label = [context.crumb, name].filter(Boolean).join(': ')
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

/** This step terminates a test when reached.
  * Tests terminated by this step are counted
  * as neither passed nor failed. */
export const todo = (...info: string[]) =>
  Object.assign(renamed(info.join(' '), function trackTodo (context: Context) {
    throw Object.assign(new Error(`${context.count} ${context.crumb}`), {
      todo: info
    })
  }, { info }))

export const matrix = <T>(name: string, variants: ((T)=>unknown)[]) =>
  expect(name, (context: Context = {}) =>
    Promise.all(variants.map(variant=>variant(context))));

export const includes = (x) => line => line.includes(x)

export function assertLength (length, x, name) {
  equal(x?.length, length, name)
  return x
}

const warnReturn = (context: Context, count: string, result: unknown) =>
  context.warn(0, `Test step ${count} returned an unexpected value.`,
    `This may indicate a faulty test function.`,
    result);

const addStepStack = (step: Step, error: Error) => {
  error.stack ||= ''
  if (step.stack) error.stack += '\n  Test defined at:\n' + step.stack.join('\n')
  return error
}
