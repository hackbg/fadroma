import type * as Test from './types.ts';
import { ok, deepStrictEqual as equal } from 'node:assert';
import { renamed, joined, formatMsec, red, green, orange, yellow, gray } from './deps.ts';
export * from './types.ts';
/** Define a test suite. Running it will output a test report.
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
export const suite = (name: string, ...steps: Test.Step<unknown>[]) => Object.assign(
  renamed(name, async function testSuite (_args: string[]) {
    Error.stackTraceLimit = Infinity;
    const run = expect(name, ...steps);
    const { getContext, details, summary } = report();
    let error, result;
    try { result = await run(getContext()); } catch (e) { error = e; }
    console.log([details(), summary()].filter(Boolean).join('\n'));
    if (error) throw error;
    return result;
  }), { steps });
/** A test case, consisting of a name and one or more test steps.
  *
  * The test steps run in sequence, and are isolated from each other.
  * If no step throws an uncaught exception, the test case is passed.
  *
  * Return values are collected in an array and returned at the end.
  * This way you can show detailed test results in the final test report.
  *
  * An empty `expect('something')` with no steps becomes a TODO.
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
  * * [ ] TODO: Add generic to [Test.Context] for typed domain-specific test state.
  **/
export const expect = (label?: string, ...steps: Test.Step<unknown>[]) =>
  Object.assign(renamed(label, async function expectation (
    context = report().getContext()
  ) { 
    if (steps.length === 0) steps = [todo()];
    const results = steps.map(_=>undefined as unknown);
    for (const index in steps) {
      try {
        const step = steps[index];
        results[index] = await context.track(Number(index), label, step);
      } catch (error) {
        throw addStepStack(steps[index], error as Error);
      }
    }
    return results;
  }), { label, steps });
/** Add the originating test step to an [Error]'s stack trace. */
const addStepStack = <T>(step: Test.Step<T>, error: Error) => {
  error.stack ||= ''
  if (step.stack) error.stack += '\n  Test defined at:\n' + step.stack.join('\n')
  return error
}
/** A **test case** for expecting an exception to be thrown. */
export const forbid = (
  name: string, failure: Test.Step<unknown>,
  // TODO: ...steps: Array<(_: Error)=>unknown>
) => {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return renamed(name, function forbidRun (context: Test.Context) {
    const label = [context.label, name].filter(Boolean).join(': ');
    return context.track(context.id, label, async function forbidRunTracked() {
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
  Object.assign(renamed(info.join(' '), function trackTodo (context: Test.Context) {
    throw Object.assign(new Error(info.join(' ')), { todo: true })
  }), { info })

/** Run the same set of test steps against different starting points.
  *
  * Example:
  *
  *     const strawberry = 1.0, chocolate = 1.0, vanilla = 1.0;
  *     const flavors = { strawberry, chocolate, vanilla };
  *     const testTastiness = matrix('Ice cream', flavors, flavor => [
  *       MUST.gte(0.5, 'bleh')
  *     ])
 *
 * */
export const matrix = <T>(
  name: string, variants: Record<string, T>, steps: (_: T)=>(Test.Step<unknown>[])
) => Object.assign(expect(name, ...Object.entries(variants)
  .map(([k, v])=>expect(k, ...steps(v)))), variants, steps);

export const parallel = (name: string, variants: ((_: Test.Context)=>unknown)[]) =>
  expect(name, (context = report().getContext()) =>
    Promise.all(variants.map(variant=>variant(context.getContext()))));

export const includes = <T>(x: T) =>
  (line: { includes (x: T): boolean }) => line.includes(x);

export const assertLength = (length: number, x: { length: number }, name?: string|Error) => {
  equal(x?.length, length, name);
  return x;
};

/** Assertions that fail the test. */
export const MUST = {

  equal: <T> (expected: T, info?: string|Error) =>
    (actual: T|unknown) => equal(
      expected, actual, info),

  have: <T extends object> (key: keyof T|unknown) =>
    (actual: T|unknown) => ok(
      (key as keyof T) in (actual as T), `missing key ${key}`),

};

/** Assertions that only emit a warning. */
export const SHOULD = { /* TODO */ };

/** The test report tracks each step of the test suite,
  * and sorts test outcomes into categories. */
export const report = ({
  failFast = true,
  pass = category(`🟢`, 'passed',   'Passed',  green( 'ok     ')),
  fail = category(`🔴`, 'failed',   'Failed',  red(   'wrong  ')),
  todo = category(`🟠`, 'tasks',    'TODO',    orange('todo   ')),
  warn = category(`🟡`, 'warnings', 'Warning', yellow('warning')),
  getContext = ({
    t0 = performance.now(), ids = [], names = [],
    track = async function track <T> (id: number|null, name: string|null, step: Test.Step<T>): Promise<T> {
      const summary = joined(' -- ', joined('.', ...ids, id), joined(': ', ...names, name));
      console.log(`⏳️ @${formatMsec(t0)} ${summary}`);
      try {
        const context = getContext({ ids: [...ids, id], names: [...names, name] });
        const result  = await step(context);
        return pass.add(t0, summary, result) as T;
      } catch (e: unknown) {
        const error = e as { todo?: unknown, message: string, stack?: string };
        if (error.todo) {
          return todo.add(t0, name, error.message) as T;
        } else {
          const failure = fail.add(t0, name, error.message, error.stack?.split('\n').slice(1).join('\n'));
          if (failFast) {
            throw failure;
          } else {
            return failure as T;
          }
        }
      }
    },
    ...rest
  } = {}): Test.Context => ({
    t0: performance.now(), ids, names, track,
    ...[pass, fail, todo, warn].map(x=>x.add),
    ...rest,
  })
} = {}): Test.Report => ({
  getContext, pass, fail, todo, warn,
  summary: () => joined(' ', ...[pass, fail, todo, warn].map(x=>x.length > 0 && x.summary())),
  details: () => joined(' ', ...[pass, fail, todo, warn].map(x=>x.length > 0 && x.details())),
})
/** Define a test result category. */
const category = (
  icon: string, summary: string, details: string, _tag: string,
  sorter = (a: Test.Result, b: Test.Result) => {
    const [_a0, a1 = NaN, _a2, a3 = NaN] = (a.summary?.match(reStep)||[]).map(Number)
    const [_b0, b1 = NaN, _b2, b3 = NaN] = (b.summary?.match(reStep)||[]).map(Number)
    const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
    return -result
  },
  detail = ({ summary, details }: Test.Result) => joined('\n',
    `${icon} ${summary}`,
    ...details.filter(Boolean).map((x, i)=>`   ${
      gray((i+1)*3, (typeof x === 'string') ? x  : JSON.stringify(x))
    }`)
  ),
): Test.Results => {
  const results: Test.Result[] = []
  return Object.assign(results, {
    icon,
    summary: () => joined(' ', icon, String(results.length), summary),
    details: () => {
      const sorted = joined('\n', results.sort(sorter).map(detail));
      return joined('', '\n', details, ': \n', sorted, '\n');
    },
    add: (t0: number, summary: string|null, ...details: unknown[]) => {
      const tD = performance.now() - t0;
      const result = { t0, tD, summary, details };
      results.push(result);
      return result;
    },
  })
}

export const reStep = / (\d+)(.(\d+))? /;

const warnReturn = (context: Test.Context, id: string, result: unknown) =>
  context.warn(0, `Test step ${id} returned an unexpected value.`,
    `This may indicate a faulty test function.`,
    result);
