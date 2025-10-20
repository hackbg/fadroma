import type { Info, Timed, MaybeAsync, MaybeAsyncFn } from '../format/index.ts';
import { joined, } from '../format/index.ts';
import { red, green, blue, orange, yellow, gray } from '../color/index.ts';
import { isEntrypoint } from '../tasker/index.ts';
import { reflect } from '../reflect/index.ts';
import { argv } from '../deps.ts';

/** A test step. */
export type Step<T> = { stack?: string[]
                      , steps?: unknown[]
                      } & MaybeAsyncFn<T, [Context]>;

/** Collection of results for a given category. */
export type Results = { icon: string
                      , add:  Add
                      } & Result[] & Info;

/** The result of a test step. */
export type Result  = { summary: string|null
                      , details: unknown[]
                      } & Timed;

/** Category noun. */
export type Category = 'passed'|'failed'|'warnings'|'skipped'|'tasks'|'ideas';

/** Tracks each step, sorting outcomes into categories. */
export type Report = Record<Category, Results> & Contextual & Info;

/** Can obtain updated context. */
export type Contextual = { context (_?: Partial<Context>): Context };

/** Category verb. */
export type Categorize = 'pass'|'fail'|'warn'|'skip'|'todo'|'idea';

/** The test context for a step. */
export type Context    = { /** Whether the whole test run should terminate
                             * on the first failing step. */
                           failFast?:   boolean
                         , /** Whether TODOs count toward test failures. */  
                           failOnTodo?: boolean
                         , /** Breadcrumb of parent step indexes. */
                           ids:         number[]
                         , /** Breadcrumb of parent step names. */
                           names:       string[]
                         , /** Execute and categorize a test step. */
                           track:       Track
                         } & Record<Categorize, Add> & Contextual & Timed;

/** Track the status of a leaf of the test tree. */
export type Track = <T>(id: number|null, name: string|null, callback: Step<T>)
  => MaybeAsync<T>;

/** Add result to category. */
export type Add = (t0: number, summary: string|null, ...extra: unknown[])
  => unknown;

/** Test entrypoint. Runs the contained tests and reports.
  *
  * Example:
  *
  *     import { entrypoint, suite, expect, todo } from '@hackbg/tester';
  *     export default entrypoint(import.meta, suite(,
  *       expect('Test A', todo()),
  *       expect('Test B'
  *         expect('Test C', todo())
  *         expect('Test D', todo()))))
  *
  **/
export const suite = <T>(
  meta: ImportMeta, name: string, ...steps: Test.Step<T>[]
) => {
  const testSuite = expect(name, ...steps);
  if (isEntrypoint(meta, argv[1])) setImmediate(()=>run(testSuite));
  return testSuite
};

/** Run a test suite, collecting the results into a test report.
  * 
  * This is automatically invoked when using [suite] as module entrypoint. */
export const run = async (testSuite: Test.Step<unknown>, {
  context, details, summary
} = report()) => {
  let error:  unknown;
  let result: unknown;
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  try { result = await testSuite(context()); } catch (e) { error = e; }
  Error.stackTraceLimit = stackTraceLimit;
  console.log([details(), summary()].filter(Boolean).join('\n'));
  if (error) throw error;
  return result;
};

/** Create a test report.
  *
  * This is automatically invoked when using [run] or [suite]. */
export const report = ({
  failFast = false,

  passed   = category(`🟢`, 'passed',   'Passed',  green( 'ok     ')),
  failed   = category(`🔴`, 'failed',   'Failed',  red(   'wrong  ')),
  tasks    = category(`🟠`, 'tasks',    'TODO',    orange('todo   ')),
  warnings = category(`🟡`, 'warnings', 'Warning', yellow('warning')),
  skipped  = category(`  `, 'skipped',  'skip',    orange('skip   ')),
  ideas    = category(`  `, 'ideas',    'idea',    blue(  'idea   ')),

  context = ({
    t0 = performance.now(), ids = [], names = [],
    pass = (...args) => passed.add(performance.now()   - t0, ...args),
    fail = (...args) => failed.add(performance.now()   - t0, ...args),
    todo = (...args) => tasks.add(performance.now()    - t0, ...args),
    warn = (...args) => warnings.add(performance.now() - t0, ...args),
    idea = (...args) => ideas.add(performance.now()    - t0, ...args),
    skip = (...args) => skipped.add(performance.now()  - t0, ...args),
  } = {}): Test.Context => ({
    t0, ids, names, pass, fail, todo, warn, context,
    async track <T> (id: number|null, name: string|null, step: Test.Step<T>) {
      const newIds   = [...ids, id].filter(Boolean);
      const newNames = [...names, name].filter(Boolean);
      const summary  = joined('',
        blue((joined('.', ...newIds)+' ').padEnd(10)),
        joined('│', newNames.map((x, i)=>gray(i*2, x))));
      if (typeof step !== 'function') {
        return warn(`not a function: ${summary}`, step) as T
      };
      //console.trace(`⏳️ @${formatMsec(t0)} ${summary}`);
      try {
        const stepContext = context({ ids: newIds, names: newNames });
        const result  = await step(stepContext);
        return pass(summary, null, result) as T;
      } catch (e: unknown) {
        const error = e as { todo?: unknown, message: string, stack?: string };
        if (error.todo) {
          return todo(summary, error.message) as T;
        } else {
          const failure = fail(summary, error.message, error.stack?.split('\n').slice(1).join('\n'));
          if (failFast) {
            throw failure;
          } else {
            return failure as T;
          }
        }
      }
    },
  }),

} = {}): Test.Report => ({
  context, passed, failed, tasks, warnings,
  summary: () => joined(' ', ...[passed, tasks, warnings, failed].map(x=>x.length > 0 && x.summary())),
  details: () => joined(' ', ...[passed, tasks, warnings, failed].map(x=>x.length > 0 && x.details())),
});

/** Define a test result category.
  *
  * This is automatically invoked when using [run], [suite], and [report]. */
const category = (icon: string, summary: string, details: string, _tag: string, {
  results = [],
  format = (i: number, x: unknown) =>
    gray((i+1)*3, (typeof x === 'string') ? x  : JSON.stringify(x)),
  detail = ({ summary, details }: Test.Result) => joined('\n',
    joined(' ', icon, summary, details[0]&&format(0, details[0])),
      ...details.slice(1).filter(Boolean).map((x, i)=>`   ${format(i, x)}`)),
  sorter = (a: Test.Result, b: Test.Result) => {
    //console.log({a,b});  // FIXME sort by id field
    const [_a0, a1 = NaN, _a2, a3 = NaN] = (a.summary?.match(reStep)||[]).map(Number)
    const [_b0, b1 = NaN, _b2, b3 = NaN] = (b.summary?.match(reStep)||[]).map(Number)
    const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
    return -result },
  add = (t0: number, summary: string|null, ...details: unknown[]) => {
    const tD = performance.now() - t0;
    const result = { t0, tD, summary, details };
    results.push(result);
    return result; },
} = {}): Test.Results => Object.assign(results, {
  add, icon,
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
export const todo = (...info: string[]) => reflect(
  info.join(' '),
  function trackTodo <T extends Test.Context>(_context: T) {
    throw Object.assign(new Error(info.join(' ')), { todo: true })
  }, { info });

/** A test case, consisting of a name and zero or more test steps.
  * 
  *   - Steps run in sequence.
  *   - If no step throws, the case passes.
  *   - Empty case like `expect('empty')`
  *     amounts to `expect('empty', todo())`.
  *   - Stringy step like `expect('empty', 'string')`
  *     amounts to `expect('empty', expect('string'))`.
  *   - Falsy step like `expect('something', null)`
  *     is only counted.
  *
  * Return values from steps are collected in an array and returned
  * at the end. This way you can show detailed test results in the
  * final test report.
  *
  * In order to pass state between steps, mutate the `context`.
  *
  * Example:
  *
  *     import { expect } from '@hackbg/tester';
  *
  *     const testThing = expect('Thing', _ => ok(1 == 1));
  *
  *     const testSomeThings = expect('Some things',
  *       _ => ok(1 === 1),
  *       _ => equal(1, 1),
  *       testThing);
  *
  **/
export const expect = <T extends Test.Context>(
  name?: string, ...steps: Test.Step<unknown>[]
) =>
  reflect(name, async function expectation (
    context: T = report().context() as T
  ) {
    if (steps.length === 0) steps = [todo()];
    const results: Array<undefined|{pass:unknown}|{fail: Error}|{todo: unknown}> =
      steps.map(_=>undefined);
    for (const index in steps) {
      try {
        let step = steps[index];
        if (!step) continue;
        if (typeof step === 'string') step = expect(step);
        const id = (steps.length > 1) ? Number(index)+1 : null;
        results[index] = { pass: await context.track(id, name, step) };
      } catch (e) {
        const error = addStepStack(steps[index], e as Error);
        results[index] = { [e.todo ? 'todo' : 'fail']: error };
        if (e.todo && context.failOnTodo) throw error;
        if (context.failFast) throw error;
      }
    }
    if (results.every(x=>!!x.todo)) {
      throw new Error(`TODO: ${name}`, { todo: true, errors })
    }
    if (results.some(x=>!!x.fail)) {
      throw Object.assign(results.find(x=>!!x.fail), { more: results.filter(x=>!!x.fail) })
    }
    //return results; FIXME
  }, { steps });

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
export const forbid = (
  name:     string,
  failure:  Test.Step<unknown>,
  ...steps: Array<(_: Error)=>unknown>
) => {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return reflect(name, function forbidRun (context: Test.Context) {
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
  }, { failure, steps })
}

/** Add the originating test step to an [Error]'s stack trace. */
const addStepStack = <T>(step: Test.Step<T>, error: Error) => {
  error.stack ||= ''
  if (step.stack) error.stack += '\n  From:\n' + step.stack.join('\n')
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
  expect(name, (context = report().context()) =>
    Promise.all(variants.map(variant=>variant(context.context()))));
