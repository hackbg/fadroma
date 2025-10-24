import type { Log, Timed, Takes, Returns, Reflects, Async } from './index.ts';
import { ok, equal, throws, rejects, getCwd, stdout, exit, argv, setImmediate, } from './deps.ts';
import { isEntrypoint } from './frontend/cmd.ts';
import { logger } from './logger.ts';
import { Error, msec, dT, joined, red, green, blue, orange, yellow, gray, bold, dim } from './format.ts';
import { call, reflect, objectReducer, reduceObject, identity, todo } from './call.ts';
export { call, ok, equal, throws, rejects, todo }
/** A step of the test suite. */
export type TestStep<T extends Testing = Testing> =
  Reflects & Takes<[T]> & Returns<Async<T|void>> & { skip?: boolean };
/** The context in which steps are executed. */
export type Testing = Log & Timed & TestOptions & TestPath & {
  /** Lists of test results by category. */
  report: Record<TestCategory, TestAddToCategory>,
};
/** Create a test context.
  *
  * This is automatically invoked when using [suite] or [run]. */
export const testContext = ({
  failFast = false,
  failTodo = false,
  report   = toReport(categorySpecs),
  t0       = performance.now(),
  ids      = [],
  names    = [],
  ...rest
} = {}): Testing => ({
  ...logger(), failFast, failTodo, report, t0, ids, names, ...rest,
});
/** Test config. */
export type TestOptions = {
  /** Whether the whole test run should terminate as soon as one step fails. */
  failFast?: boolean,
  /** Whether TODOs count toward test fails. */  
  failTodo?: boolean
};
/** Each case has a path in the test tree.
  * This is used for indentation, bulleted lists, etc. */
export type TestPath = {
  /** Breadcrumb of step indexes. */
  ids: number[],
  /** Breadcrumb of step names. */
  names: string[],
};
/** Test result categories. TODO infer */
export type TestCategory = 'pass'|'fail'|'todo'|'warn'|'skip'|'note';
/** Collection of results for a given category. */
export type TestAddToCategory =
  (<R>(context: Testing, result?: R, ...details: unknown[]) => R) & {
    id: string,
    icon: string,
    label: string,
    results: TestResult[]
  };
const toReport = reduceObject(objectReducer((cat, id)=>testCategory(id, cat)));
const categoryOrder = ['pass', 'fail', 'todo', 'warn', 'skip', 'note'];
const categorySpecs = { pass: { icon: `🟢`, color: green,  label: 'passed'   }
                      , fail: { icon: `🔴`, color: red,    label: 'failed'   }
                      , todo: { icon: `🟠`, color: orange, label: 'tasks'    }
                      , warn: { icon: `🟡`, color: yellow, label: 'warnings' }
                      , skip: { icon: `  `, color: orange, label: 'skip'     }
                      , idea: { icon: `  `, color: blue,   label: 'ideas'    }
                      , note: { icon: `  `, color: blue,   label: 'notes'    } } as const;
const testCategory = (id: string, { icon, label, color }): TestAddToCategory =>
  reflect(id, async function categorize ({ log, t0, ids, names }: Testing, ...details: unknown[]) {
    const results = [];
    const t1 = performance.now();
    const tD = t1 - t0;
    const result = { tD, details };
    log(msec(tD), icon, color(id), blue(ids.join('.')), gray(names.length, names.join(': ')), ...details.filter(Boolean));
    results.push(result);
    return { [id]: result };
  }, { id, icon, label, color });

/** Define a test suite that may run as module entrypoint.
  *
  * Use helpers like [expect] and [forbid] to define test steps.
  *
  * Example:
  *
  *     import { suite, expect, todo } from '@hackbg/fadroma';
  *     export default suite(import.meta, 'My module',
  *       expect('Test A', todo()),
  *       expect('Test B'
  *         expect('Test C', todo())
  *         expect('Test D', todo())));
  *
  **/
export function suite (meta: ImportMeta, name: string, ...steps: TestStep[]) {
  const testSuite = expect(name, ...steps);
  if (isEntrypoint(meta, argv[1])) setImmediate(testAndExit(testSuite));
  return testSuite as TestStep;
}
const testAndExit = (test: TestStep) => () =>
  runTest(test).then(({ context, result })=>{
    const lines = testSummarize({ context, result });
    stdout.write('\n'+joined('\n', lines) + '\n');
    exit(('pass' in result) ? 0 : 1);
  });

/** Format the test summary. */
export function testSummarize ({
  lines = [], indent = '', context, result
}) {
  const { tD, state, name, results = [] } = result;
  if (!categorySpecs[state]) throw new Error(`unknown category: ${state}`);
  const {icon, color} = categorySpecs[state];
  const style = (results.length > 1) ? bold : identity;
  let line = joined(' ',
    ' '+icon,
    color(state),
    color((indent+' ').padEnd(15,'-')),
    style((name||'<unnamed>').padEnd(20)),
                   );
  if (state === 'fail' && result.error) {
    line = joined(' ', line, gray(2, joined(': ', bold(result.error.name), result.error.message)));
    lines.push(line);
    lines.push(result.error.stack.split('\n').map(alignTrace).slice(1).join('\n'));
  } else {
    lines.push(line);
  };
  if (results.length === 1 && results[0].state === 'pass' && !results[0].name) {
    return lines;
  }
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    testSummarize({ context, result, indent: joined('.', indent, Number(index)+1), lines, });
  }
  return lines;
};
const alignTrace = (line: string) => {
  line = line.replace('file://'+getCwd(), '.');
  line = line.replace(getCwd(), '.');
  line = line.split(' (')
    .map((x,i)=>(i===0)?bold(gray(2, x.padEnd(30))):gray(3, x))
    .join(gray(3, ' ('));
  return line
}

/** Run a test suite, collecting the results into a test report.
  * 
  * This is automatically invoked when using [suite] as module entrypoint. */
export async function runTest <T extends Testing> (
  test: TestStep<T>, context = testContext()
): Promise<{ context: Testing, result: TestResult }> {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  if (typeof test !== 'function') test = todo(test);
  let error:  unknown;
  let result: TestResult;
  try {
    result = await testResult(context, test);
  } catch (e) {
    result = { state: 'fail', tD: dT(context.t0), results: [e], };
  }
  Error.stackTraceLimit = stackTraceLimit;
  return { context, result };
};

/** A test case, consisting of a name and zero or more test steps.
  * 
  * Steps run in sequence. If no step throws, the case passes.
  *
  * Steps are NOT piped to each other. Instead, return values from
  * each step is collected in an array and returned at the end.
  * This way you can show arbitrary details in the test report.
  * In order to pass state between steps, mutate the `context`.
  *
  *  Shorthands:
  *
  *   - Empty case like `expect('empty')`
  *     amounts to `expect('empty', todo())`.
  *   - Stringy step like `expect('empty', 'string')`
  *     amounts to `expect('empty', expect('string'))`.
  *   - Falsy step like `expect('something', null)`
  *     is only counted.
  *
  * Example:
  *
  *     import { suite, expect } from '@hackbg/fadroma';
  *     const test1 = expect('Thing', _ => ok(1 == 1));
  *     const test2 = expect('Some things',
  *       _ => ok(1 === 1),
  *       _ => equal(1, 1),
  *       preDefinedTest);
  *     export default suite(import.meta, 'Test suite', test1, test2);
  *
  **/
export function expect <T extends Testing> (
  name: string|null, ...steps: (string|TestStep)[]
) {
  return reflect(name, expectations, { steps });
  async function expectations (context: T = testContext() as T) {
    if (steps.length === 0) return {name, state: 'todo', results: []};
    const {t0, ids: baseIds = [], names: baseNames = []} = context;
    let results: Array<TestResult|undefined> = steps.map(_=>undefined);
    for (const index in steps) {
      const step  = steps[index];
      const id    = Number(index)+1;
      const t0    = performance.now();
      const ids   = [...baseIds, id].filter(Boolean);
      const names = [...baseNames, step.name].filter(Boolean);
      Object.assign(context, { t0, ids, names });
      const result = await testResult(context, step);
      results[index] = result;
      if ('fail' in result && context.failFast) throw result.fail;
    };
    Object.assign(context, { t0, ids: baseIds, names: baseNames })
    results = results.filter(Boolean);
    let state = 'pass';
    if (results.some(isTodo)) state = context.failTodo ? 'fail' : 'todo';
    if (results.some(isFail)) state = 'fail';
    return { name, state, results };
  }
}
/** The result of a test step. */
export type TestResult = Timed & {
  name:     string,
  state:    TestCategory,
  results?: unknown[],
  error?:   Error,
};
const testResult = async <T extends Testing> (
  ctx: T, step: TestStep<T>
): Promise<TestResult> => {
  const name = (typeof step === 'string') ? step : step.name;
  const tD = dT(ctx.t0);
  if (!step) {
    return { name, state: 'skip', tD };
  } else if (typeof step === 'string') {
    return { name, state: 'todo', tD, }
  } else if (step.skip) {
    return { name, state: 'skip', tD }
  } else {
    try {
      const result = await step(ctx);
      return { name, state: 'pass', tD, result };
    } catch (e) {
      const error = addStepStack(step, e as Error);
      if (error.todo) return { name, state: 'todo', tD, error, };
      return { state: 'fail', tD, error, };
    }
  }
}
const isTodo = (x?: { state?: unknown }) => x?.state === 'todo';
const isFail = (x?: { state?: unknown }) => x?.state === 'fail';
//const stepSummary = ({ t0, ids, names }) => joined('', stepIds(ids), stepNames(names));
//const stepIds     = ids   => blue(((joined('.', ...ids)||'<no id>')+' ').padEnd(10));
//const stepNames   = names => joined('│', names) || '<no name>';//.map((x, i)=>gray(i*2, x)));

///////////////////////////////////////////////////////////////////////////////

/** A test case which expects an exception to be thrown. */
export function forbid (
  name: string, failure: TestStep, ...steps: Array<(_: Error)=>unknown>
) {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return reflect(name, forbidRun, { failure, steps });
  function forbidRun (context: Testing) {
    return testResult(context, forbidRunTracked);//, 0, name);
    async function forbidRunTracked () {
      let result: unknown;
      let error:  unknown;
      try {
        result = await failure(context);
        error = new Error(`${name}: missing expected failure, got: ${result}`);
      } catch (e) {
        return e;
      }
      throw Object.assign(error, { name, result });
    }
  }
}

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

/** Add the originating test step to an [Error]'s stack trace. */
const addStepStack = (step: TestStep, error: Error) => {
  if (typeof error !== 'object') error = new Error(error);
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
  name: string, variants: Record<string, T>, steps: (_: T)=>TestStep
) => Object.assign(expect(name, ...Object.entries(variants)
  .map(([k, v])=>expect(k, steps(v)))), variants, steps);

/** Run steps in parallel. */
export const parallel = (name: string, variants: ((_: Testing)=>unknown)[]) =>
  expect(name, async (context = testContext()) => {
    await Promise.all(variants.map(variant=>variant(context)))
  });
