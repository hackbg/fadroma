import type * as Test from '../types.ts';
import { pipe, stdout, argv, write, formatMsec, red, green, orange, yellow, entrypoint } from '../deps.ts';
import { byStep } from './steps.ts';

/** Define a test suite.
  *
  * Example:
  *
  *     import { suite, expect, todo } from '@fadroma/tester';
  *     export default(import.meta,
  *       expect('Test A', todo()),
  *       expect('Test B'
  *         expect('Test C', todo())
  *         expect('Test D', todo())))
  **/
export const suite = (params: Partial<ImportMeta & Test.Options>, ...steps) => {
  const { url, main, filename, dirname, resolve, args = argv.slice(1)
        , output = stdout, failFast = true, } = params
  const meta = { url, main, filename, dirname, resolve, args, };
  const opts = { args, failFast, output, };
  return { ...meta, ...opts, run: entrypoint(meta, runTests) }
  async function runTests (suite) {
    Error.stackTraceLimit = Infinity;
    const report  = defTestReport();
    const context = report.context();
    let error, result;
    const run = pipe(...steps);
    const t0 = performance.now();
    try { result = await run(context) } catch (e) { error = e }
    const tD = performance.now() - t0;
    if (result !== report) report.warn.add(tD, 'Test did not return original context');
    console.log(join('\n', report.details(), report.summary()));
    if (error) throw error;
    return result;
  }
};

export const defTestReport = (): Test.Report => ({
  pass: defResultCategory(`🟢`, 'passed',   'Passed',  green('ok')),
  fail: defResultCategory(`🔴`, 'failed',   'Failed',  red('incorrect')),
  todo: defResultCategory(`🟠`, 'tasks',    'TODO',    orange('todo')),
  warn: defResultCategory(`🟡`, 'warnings', 'Warning', yellow('!')),

  context () {
    return {
      count:  '',
      prefix: '',
      pass: this.pass.add,
      fail: this.fail.add,
      todo: this.todo.add,
      warn: this.warn.add,
      async track (count, label, callback) {
        const prefix = `${count?(count+' '):''}${label?(label+' '):''}`
        const t0 = performance.now()
        console.log(`👉️ T=${formatMsec(t0)} ${prefix}`)
        try {
          return this.pass(t0, prefix, await callback({ t0, prefix }))
        } catch (e) {
          if (this.failFast) {
            throw this.fail(t0, prefix, e)
          } else {
            return this.fail(t0, prefix, e)
          }
        }
      },
    }
  },
  summary () {
    return join(' ',
      (this.pass.length > 0) && this.pass.summary(),
      (this.fail.length > 0) && this.fail.summary(),
      (this.todo.length > 0) && this.todo.summary(),
      (this.warn.length > 0) && this.warn.summary())
  },
  details () {
    return join(' ',
      (this.pass.length > 0) && this.pass.details(),
      (this.fail.length > 0) && this.fail.details(),
      (this.todo.length > 0) && this.todo.details(),
      (this.warn.length > 0) && this.warn.details())
  }
});

export const join = (joiner: String, ...data: (String|false|null)[]) =>
  data.flat().filter(Boolean).join(joiner);

export const defResultCategory = (
  icon: string, summary: string, details: string, tag: string
): Test.Results => {
  const results = []
  return Object.assign(results, {
    icon,
    add (t0, summary, result, ...extra) {
      const tD = performance.now() - t0
      const text = `${icon} T+${formatMsec(tD)} ${tag} ${summary}`
      console.log(text);
      results.push([summary, result, ...extra])
      return result
    },
    summary () {
      return join(' ', icon, this.length, summary)
    },
    details () {
      return join('',
        '\n',
        details,
        ': \n',
        join('\n', this.sort(byStep).map(x=>`${icon} ${x[0]}`)),
        '\n')
    },
  })
}
