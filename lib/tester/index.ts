import type * as Test from './types.ts';
import { ok, deepStrictEqual as equal } from 'node:assert';
import { entrypoint, renamed, joined, formatMsec, red, green, orange, yellow, blue, gray } from './deps.ts';

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
export const suite = (meta: ImportMeta, name: string, ...steps: Test.Step<unknown>[]) =>
  entrypoint(meta, Object.assign(renamed(name, async function runTestSuite (..._args: string[]) {
    Error.stackTraceLimit = Infinity;
    const run = expect(name, ...steps);
    const { getContext, details, summary } = report();
    let error:  unknown;
    let result: unknown;
    try { result = await run(getContext()); } catch (e) { error = e; }
    console.log([details(), summary()].filter(Boolean).join('\n'));
    if (error) throw error;
    return result;
  }), { steps }), expect(name, ...steps));

/** The test report tracks each step of the test suite,
  * and sorts test outcomes into categories. */
export const report = ({
  failFast = false,

  pass = category(`🟢`, 'passed',   'Passed',  green( 'ok     ')),
  fail = category(`🔴`, 'failed',   'Failed',  red(   'wrong  ')),
  todo = category(`🟠`, 'tasks',    'TODO',    orange('todo   ')),
  warn = category(`🟡`, 'warnings', 'Warning', yellow('warning')),

  getContext = ({
    t0 = performance.now(), ids = [], names = [],
    track = async function track <T> (id: number|null, name: string|null, step: Test.Step<T>): Promise<T> {
      if (!step) return null
      const newIds   = [...ids, id].filter(Boolean);
      const newNames = [...names, name].filter(Boolean);
      const summary  = joined('',
        blue((joined('.', ...newIds)+' ').padEnd(10)),
        joined(': ', newNames.map((x, i)=>gray(i*2, x))));
      //console.trace(`⏳️ @${formatMsec(t0)} ${summary}`);
      try {
        const context = getContext({ ids: [...ids, id], names: [...names, name] });
        const result  = await step(context);
        return pass.add(t0, summary, null, result) as T;
      } catch (e: unknown) {
        const error = e as { todo?: unknown, message: string, stack?: string };
        if (error.todo) {
          return todo.add(t0, summary, error.message) as T;
        } else {
          const failure = fail.add(t0, summary, error.message, error.stack?.split('\n').slice(1).join('\n'));
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
    ...[pass, fail, todo, warn].map(x=>x.add), ...rest,
  }),

} = {}): Test.Report => ({
  getContext, pass, fail, todo, warn,
  summary: () => joined(' ', ...[pass, todo, warn, fail].map(x=>x.length > 0 && x.summary())),
  details: () => joined(' ', ...[pass, todo, warn, fail].map(x=>x.length > 0 && x.details())),
});

/** Define a test result category. */
const category = (
  icon: string, summary: string, details: string, _tag: string,
  results = [],
  format = (i: number, x: unknown) =>
    gray((i+1)*3, (typeof x === 'string') ? x  : JSON.stringify(x)),
  detail = ({ summary, details }: Test.Result) => joined('\n',
    joined(' ', icon, summary, details[0]&&format(0, details[0])),
      ...details.slice(1).filter(Boolean).map((x, i)=>`   ${format(i, x)}`)),
  sorter = (a: Test.Result, b: Test.Result) => { // FIXME sort by id field
    const [_a0, a1 = NaN, _a2, a3 = NaN] = (a.summary?.match(reStep)||[]).map(Number)
    const [_b0, b1 = NaN, _b2, b3 = NaN] = (b.summary?.match(reStep)||[]).map(Number)
    const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
    return -result },
  add = (t0: number, summary: string|null, ...details: unknown[]) => {
    const tD = performance.now() - t0;
    const result = { t0, tD, summary, details };
    results.push(result);
    return result; },
): Test.Results => Object.assign(results, { add, icon,
  summary: () => joined(' ', icon, String(results.length), summary),
  details: () => { const sorted = joined('\n', results.sort(sorter).map(detail))
                 ; return joined('', '\n', details, ': \n', sorted, '\n'); }, });

// FIXME: remove this, sort by id field
export const reStep = / (\d+)(.(\d+))? /;

/** Stub test step. When reached, terminates without passing or failing,
  * and adds a task to the test report.
  *
  * - [ ] FIXME: Steps made entirely out of TODOs should
  *              count as "todo"s and not as "pass"es. */
export const todo = (...info: string[]) => Object.assign(renamed(info.join(' '),
  function trackTodo (_context: Test.Context) {
    throw Object.assign(new Error(info.join(' ')), { todo: true })
  }), { info })

/** A test case, consisting of a name and zero or more test steps.
  * Zero steps makes it a todo.
  *
  * The test steps run in sequence, and are isolated from each other.
  * If no step throws an uncaught exception, the test case is passed.
  *
  * Return values are collected in an array and returned at the end.
  * This way you can show detailed test results in the final test report.
  *
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
export const expect = (name?: string, ...steps: Test.Step<unknown>[]) =>
  Object.assign(renamed(name, async function expectation (
    context = report().getContext()
  ) { 
    if (steps.length === 0) steps = [todo()];
    const results = steps.map(_=>undefined as unknown);
    for (const index in steps) {
      try {
        const step = steps[index];
        const id = (steps.length > 1) ? Number(index)+1 : null;
        results[index] = await context.track(id, name, step);
      } catch (error) {
        throw addStepStack(steps[index], error as Error);
      }
    }
    return results;
  }), { steps });

/** Required assertions. */
export const MUST = {
  include: <T>(expected: T) =>
    (actual: { includes (expected: T): boolean }) => actual.includes(expected),
  equal: <T> (expected: T, info?: string|Error) =>
    (actual: T|unknown) => equal(expected, actual, info),
  have: <T extends object> (key: keyof T|unknown) =>
    (actual: T|unknown) => ok((key as keyof T) in (actual as T), `missing key ${key}`),
};

/** Assertions that only emit a warning. */
export const SHOULD = {
  /* TODO */
};

/** A test case which expects an exception to be thrown. */
export const forbid = (name: string, failure: Test.Step<unknown>,
  // TODO: ...steps: Array<(_: Error)=>unknown>
) => {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return renamed(name, function forbidRun (context: Test.Context) {
    return context.track(0, name, async function forbidRunTracked () {
      let result: unknown;
      let error:  unknown;
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

/** Add the originating test step to an [Error]'s stack trace. */
const addStepStack = <T>(step: Test.Step<T>, error: Error) => {
  error.stack ||= ''
  if (step.stack) error.stack += '\n  Test defined at:\n' + step.stack.join('\n')
  return error
}

/** FIXME: Run the same set of test steps against different starting points.
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

/** Run steps in parallel. */
export const parallel = (name: string, variants: ((_: Test.Context)=>unknown)[]) =>
  expect(name, (context = report().getContext()) =>
    Promise.all(variants.map(variant=>variant(context.getContext()))));

const warnReturn = (context: Test.Context, id: string, result: unknown) =>
  context.warn(0, `Test step ${id} returned an unexpected value.`,
    `This may indicate a faulty test function.`,
    result);
