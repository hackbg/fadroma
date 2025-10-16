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
export const suite = (...steps: Step[]) => Object.assign(
  async function testSuite (args: string[]) {
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

/** A test case, consisting of a name and one or more test steps.
 *
  * The test steps run in sequence, and are isolated from each other.
  * If no step throws an uncaught exception, the test case is passed.
  *
  * Return values are collected in an array and returned at the end.
  * This way you can show detailed test results in the final test report.
  *
  * Example:
  *
  *     import { expect } from '@fadrma/tester';
  *
  *     const testThing = expect('Thing', _ => ok(1 == 1));
  *
  *     const testSomeThings = expect('Some things',
  *       _ => ok(1 === 1),
  *       _ => equal(1, 1),
  *       testThing);
  *
  * * [ ] TODO: Add generic to [Context] for typed domain-specific test state.
  **/
export const expect = (label: string, ...steps: Step[]) =>
  Object.assign(renamed(label, async function expect (
    context: Context = defTestReport().context()
  ) {
    //return context.track(
      //context.count,
      //[context.crumb, label].filter(Boolean).map(x=>x.trim()).join(': '),
      //async function expectation (context: Context) {
        const results = steps.map(_=>undefined);
        for (const index in steps) {
          try {
            const step = steps[index];
            const count = [context.count, String(Number(index)+1)].filter(Boolean).join('.');
            results[index] = await context.track(count, label, step);
          } catch (error) {
            throw addStepStack(steps[index], error as Error);
          }
        }
        return results;
      //});
  }), { label, steps });

/** A **test case** for expecting an exception to be thrown. */
export const forbid = (
  name: string, failure: Step,
  // TODO: ...steps: Array<(_: Error)=>unknown>
) => {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return renamed(name, function forbidRun (context: Context) {
    const label = [context.crumb, name].filter(Boolean).join(': ');
    return context.track(context.count, label, async function forbidRunTracked() {
      let result, error;
      try {
        result = await failure(context);
        error = new Error(`${name}: missing expected failure, got: ${result}`);
      } catch (e) {
        return e;
      }
      throw Object.assign(error, { name, result });
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
