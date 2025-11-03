import type { Fn, Step, Log, Reflects, Async, Prototype } from './index.ts';
import { ok, equal, partialEqual, throws, rejects, stdout, exit, argv, setImmediate, inspect } from './deps.ts';
import { isEntrypoint } from './client/cmd.ts';
import { logger } from './logger.ts';
import { ANSI, dT, joined, spaced, lines, msec } from './format.ts';
import { Error, addStepStack, withInfiniteStack, alignTrace } from './error.ts';
import { merge, call, reflect, identity, todo } from './call.ts';
export { call, ok, equal, throws, rejects, todo }
/** Test context passed to eacgh step. */
export type Testing = Log & TestResult & TestOptions & TestBins & { args?: string [] };
/** Test result categories. */
export type TestBins = Record<TestState, TestCategory>;
export type TestStack = TestFrame[];
export type TestFrame = { t0: number, index: number, name: string };
export type TestState = 'pass'|'fail'|'todo'|'idea'|'warn'|'skip'|'note';
export type TestFilters = { only?: string[], except?: string[] };
export type TestOptions = { args?: string[] } & TestFilters;
/** A step of the test suite. */
export type TestStep <T extends Testing = Testing> =
  Reflects & Fn<[T], Async<unknown>> & { skip?: boolean };
/** Collects test results. */
export type TestCategory = Fn<[TestStep], TestResult> &
  { icon: string, label: string, color: Fn<[string], string>, results: TestResult[] };
/** The result of a test step. */
export type TestResult = { tD: number, state: TestState, substeps?: TestResult[] }
  & ({ returned: unknown } | { threw: { todo?: boolean } });
/** Create empty test context. */
export function testContext <T extends Testing> (...options: Partial<T>[]): T {
  const config = merge({}, ...options);
  const args = config?.args || [];
  const context: T = {} as T;
  return merge(context, logger(), {
    args,
    only:   args.filter(x=>(!x.startsWith('--'))&&(x[2]!=='!')),
    except: args.filter(x=>x.startsWith('--!')),
    //failFast: args.includes('--fail-fast'),
    //failTodo: args.includes('--fail-todo'),
    pass: testCategory('pass', `🟢`, ANSI.green,  'passed'  ),
    fail: testCategory('fail', `🔴`, ANSI.red,    'failed'  ),
    todo: testCategory('todo', `🟠`, ANSI.orange, 'tasks'   ),
    warn: testCategory('warn', `🟡`, ANSI.yellow, 'warnings'),
    skip: testCategory('skip', `🟣`, ANSI.purple, 'skipped' ),
    idea: testCategory('idea', `🔵`, ANSI.blue,   'ideas'   ),
    note: testCategory('note', `⚫️`, ANSI.dim,    'notes'   ),
  } as Partial<T>, config);

  function testCategory (
    state: TestState, icon: string, color: Step<string>, label: string = state
  ): TestCategory {
    let count = 0;
    const props = { state, icon, label, color, get count () { return count } };
    return reflect(state, function categorizeTestResult (result: Partial<TestResult>): TestResult {
      count++;
      result = { ...result, state };
      context.log('+'+msec(result.tD), icon, color(result.name||ANSI.gray(7, '(unnamed)')));
      if ('threw' in result && !result.threw?.todo) context.error(result.threw);
      return result as TestResult;
    }, props);
  }
}
/** A test case, consisting of a name and zero or more test steps.
  *
  *   1. Steps run in sequence. If no step throws, the case passes.
  *   2. **Empty case** like `expect('empty')`
  *      amounts to `expect('empty', todo())`.
  *   3. **Stringy step** like `expect('empty', 'string')`
  *      amounts to `expect('empty', expect('string'))`
  *   4. **Falsy step** like `expect('something', null)` is only counted.
  *
  * Example:
  *
  *     import { testSuite, expect, ok, equal } from '@hackbg/fadroma';
  *     export const test1 = expect('Thing', _ => ok(1 == 1));
  *     export const test2 = expect('Some things',
  *       _ => ok(1 === 1),
  *       _ => equal(1, 1),
  *       test1);
  *     export default testSuite(import.meta, 'Test suite', test2);
  *
  **/
export function expect <T extends Testing> (
  name: string|null, ...stepsAndTodos: (TestStep<T>|string)[]
) {
  if (stepsAndTodos.length === 0) return todo(name);
  const steps: TestStep<T>[] = stepsAndTodos.map(toStep);
  return reflect(name, (steps.length > 1) ? expectMany : expectOne, { steps });
  async function expectOne (context: T): Promise<TestResult> {
    const [step] = steps;
    const t0 = performance.now();
    //if (!step.skip) context.log('@'+msec(t0), '🏁', name);
    try {
      const returned = await step(context);
      return context.pass({ name, tD: dT(t0), returned });
    } catch (error) {
      const threw = addStepStack(step, error);
      const state = error.todo ? 'todo' : 'fail';
      return context[state]({ name, tD: dT(t0), threw });
    }
  }
  async function expectMany (context: T): Promise<TestResult> {
    const t0 = performance.now();
    const substeps = [];
    for (let index = 1; index <= steps.length; index++) {
      const step = steps[index-1];
      const t0 = performance.now();
      const stepName = [name, step.name].filter(Boolean).join(': ');
      context.log('@'+msec(t0), '🏁', stepName);
      try {
        const returned = await step(context);
        substeps[index-1] = context.pass({ index, name: stepName, tD: dT(t0), returned });
        context.returned = returned;
      } catch (error) {
        const threw = addStepStack(step, error);
        const state = error.todo ? 'todo' : 'fail';
        substeps[index] = context[state]({ index, name: stepName, tD: dT(t0), threw });
        if (state !== 'todo') break;
      }
    }
    //console.log(substeps, substeps.length === 0,
      //substeps.every(isPass),
      //substeps.some(isFail),
      //substeps.some(isTodo));
    return context[testState(substeps)]({ tD: dT(t0), substeps }) as TestResult;
  }
}
const toStep = <T extends Testing>(step: TestStep<T>|string) =>
  (typeof step === 'string') ? todo(step) : step;
const testIndex = (stack: TestStack) => stack.map(s=>s.index).join('.')+'.';
const testNames = (stack: TestStack) => stack.map(s=>s.name).join(': ');
const isPass = (x?: { state?: unknown }) => x?.state === 'pass';
const isTodo = (x?: { state?: unknown }) => x?.state === 'todo';
const isFail = (x?: { state?: unknown }) => x?.state === 'fail';
const testState = (results: TestResult[]): TestState|null =>
  (results.length === 0)  ?  null  :
  (results.every(isPass)) ? 'pass' :
  (results.some(isFail))  ? 'fail' :
  (results.some(isTodo))  ? 'todo' : null;

/** Assertions for specifying tests in terms of RFC2119 MUST/SHOULD (NOT). */
export type RFC2119 = {
  be: <T extends Testing & { returned: unknown }>
    (type: string) => (context: T) => Async<T["returned"]>;
  beInstanceOf: <T extends Testing & { returned: Prototype }>
    (prototype: Prototype) => (context: T) => Async<T["returned"]>;
  equal: <T extends Testing & { returned: V }, V>
    (value: V) => (context: T) => Async<T["returned"]>;
  include: <T extends Testing & { returned: { includes (_: V): boolean } }, V>
    (value: V) => (_: T) => Async<T["returned"]>;
  have: <T extends Testing & { returned: O },
         O extends object,
         K extends keyof O,
         V extends O[K]>
    (key: K|unknown, value?: V|unknown) => (_: T) => Async<T["returned"]>;
};

/** Assertions. */
export const must: RFC2119 = {
  be: (type) => reflect(`MUST be ${type}`, function mustBe ({ returned }) {
    ok(typeof returned === type, `not ${type}: ${inspect(returned)}`);
    return returned;
  }, { type }),

  equal: (expected, info?: string|Error) => reflect(
    `MUST equal ${inspect(expected)}`, function mustEqual ({ returned }) {
      equal(expected, returned, info);
      return returned;
    }, { expected }),

  beInstanceOf: (prototype) => reflect(`MUST be instance of ${prototype}`,
    function mustBe ({ returned }) {
      ok(returned, 'missing');
      ok(typeof returned === 'object', `not object: ${inspect(returned)}`);
      ok(returned instanceof prototype);
      return returned;
    }, { prototype }),

  have: (key, ...args) => reflect(
    (typeof key === 'string')
      ? `MUST have "${key}"` + ((args.length > 0) ? ` = ${inspect(args[0])}` : '')
      : `MUST partially equal "${inspect(key)}"`,
    function mustHave ({ returned }) {
      ok(returned, 'falsy');
      if (typeof key !== 'string') throw new Error("not implemented: partial equal");
      ok(key as keyof typeof returned in returned, `${key} missing in ${inspect(returned)}`);
      if (args.length > 0) {
        const expected = args[0];
        const actual   = returned[key as keyof typeof returned];
        const message  = `${inspect(actual)} != ${inspect(expected)}`;
        equal(expected, actual, `${key} wrong: ${message}`);
      }
      return returned;
    }, { key, value: args[0], checks: args.slice(1) }),

  include: (item) => reflect(
    `MUST include ${inspect(item)}`,
    function mustInclude ({ returned }) {
      ok(returned && typeof returned === 'object', 'non-object');
      ok(typeof returned['includes'] === 'function', 'no includes method');
      ok(returned.includes(item), `doesn't include ${item}`)
      return returned;
    }, { item }),

};

/** Call function returned by last test step. */
export const ditto = () => {
  let name = 'ditto';
  return Object.defineProperty(ditto, 'name', { get () { return name } });
  function ditto ({ returned }) {
    name = returned?.name;
    return returned();
  }
};

/** TODO: RFC2119 assertions that only emit warning. */
export const should = { /* TODO */ };

/** TODO: Run steps in parallel. */
export const parallel = (name: string, variants: ((_: Testing)=>unknown)[]) =>
  expect(name, async (context: Testing) => {
    await Promise.all(variants.map(variant=>variant(context)))
  });

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
  name: string, variants: T[]|Record<string, T>, ...steps: TestStep[]
) => Object.assign(expect(name, ...Object.entries(variants)
  .map(([k, _v])=>expect(k, ...steps))), variants, steps);

/** FIXME: A test case which expects an exception to be threw. */
export function forbid (
  name: string, failure: TestStep, ...steps: Array<(_: Error)=>unknown>
) {
  name = [`Forbid`, name].filter(Boolean).join(': ');
  return reflect(name, forbidRun, { failure, steps });
  function forbidRun (context: Testing) {
    throw Error.TODO('forbid')
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

/** Test entrypoint. When a test module is run standalone,
  * tests contained in a `testSuite` run automatically.
  *
  * Use helpers like [expect] and [forbid] to define test steps.
  *
  * Example:
  *
  *     import { testSuite, expect, todo, ok, equal } from '@hackbg/fadroma';
  *     export default testSuite(import.meta, 'My module',
  *       'Strings are TODOs',
  *       expect('Empty expects are TODOs'),
  *       expect('Does not throw',
  *         context => { ok(true, "unary assertion") },
  *         expect('Nested test', context => {
  *           equal(1, 1, "binary assertion")
  *         })));
  *
  **/
export function testSuite (
  meta: ImportMeta, name: string, ...steps: (TestStep|string)[]
) {
  const suite = expect(name, ...steps);
  const enter = isEntrypoint(meta, argv[1]);
  if (enter) setImmediate(()=>testAndExit(suite, ...argv.slice(2)));
  return suite as TestStep;
}

/** Run a single test step and exit the interpreter. */
export const testAndExit = (test: TestStep, ...args: string[]) =>
  testRun(test, args).then(({ context, result })=>{
    stdout.write('\n' + lines(testReport({ context, result })) + '\n');
    exit(('pass' in result) ? 0 : 1);
  });

/** Run a test suite, collecting the results into a test report. */
export async function testRun <T extends Testing> (
  test: TestStep<T>, args: string[], context = testContext({ args }),
): Promise<{ context: Testing, result: TestResult }> {
  if (typeof test !== 'function') test = todo(test);
  return { context, result: await withInfiniteStack(test, context) };
}

/** Print a summary of test results. */
export function testReport ({
  context, result, details = [], indent = '', root = true,
}) {
  if (!context[result.state]) return [];
  const state = result.state;
  const name  = result.name;
  const icon  = context[state]?.icon  || '';
  const color = context[state]?.color || identity;
  const style = (result.results?.length > 1) ? ANSI.bold : identity;
  const line  = spaced(` ${icon}`, color(state), color((indent+' ').padEnd(15,'-')), style((name||'<unnamed>').padEnd(20)));
  if (state === 'fail' && result?.error?.message) {
    details.push(spaced(line, ANSI.gray(2, joined(': ', ANSI.bold(result.error.name), result.error.message))));
    details.push(result.error.stack.split('\n').map(alignTrace).slice(1).join('\n'));
  } else {
    details.push(line);
  };
  const results = result?.results || [];
  if (results.length === 1 && results[0].state === 'pass' && !results[0].name) {
    return details
  }
  for (let index = 0; index < results.length; index++)
    testReport({ context, result: results[index], details,
      indent: joined('.', indent, Number(index)+1), root: false, });
  if (root) for (const name of [
    'pass', 'fail', 'todo', 'idea', 'warn', 'skip', 'note'
  ]) {
    const category = context[name];
    const { icon, color, label } = category;
    details.push(spaced(` ${icon}`, color(`${context[name].count} ${label}`), ''));
  }
  return details
}

export default {
  context: testContext,
  suite:   testSuite,
  reflect, expect, must, call, ditto,
}
