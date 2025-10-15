import { stdout, argv, write, Write, formatMsec, red, green, orange, yellow, entrypoint } from '../deps.ts';
import { byStep } from './steps.ts';
import type * as Test from './types.ts';
export const suite = (main = null, {
  args = argv.slice(1), output = stdout, failFast = true,
}: Partial<Test.Options>) => ({
  file, args, failFast, output,
  run: entrypoint(main, async function runTests (suite) {
    const results = defTestResults();
    Error.stackTraceLimit = Infinity;
    const context = this.results.context();
    let error, result;
    try { result = await suite(context) } catch (e) { error = e }
    const { pass, fail, todo, warn } = results;
    write(output, join('\n', results.details, results.summary));
    if (error) throw error;
    return result;
  })
})
const defTestResults = (): Test.Report => ({
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
        const prefix = `${count} ${label}`
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
      when(this.pass.length > 0, this.pass.summary),
      when(this.fail.length > 0, this.fail.summary),
      when(this.todo.length > 0, this.todo.summary),
      when(this.warn.length > 0, this.warn.summary))
  },
  details () {
    return join(' ',
      when(this.pass.length > 0, this.pass.details),
      when(this.fail.length > 0, this.fail.details),
      when(this.todo.length > 0, this.todo.details),
      when(this.warn.length > 0, this.warn.details))
  }
})
const when = (condition, data) => condition ? data : null;
const join = (joiner, ...data) => data.flat().filter(Boolean).join(joiner);
const defResultCategory = (icon, summary, details, tag): Test.Results =>
  Object.assign([], {
    icon,
    add (t0, summary, result, ...extra) {
      const tD = performance.now() - t0
      const text = `${icon} T+${formatMsec(tD)} ${tag} ${summary}`
      this.push([summary, result, ...extra])
      return result
    },
    summary () {
      return join(' ', icon, this.length, summary)
    },
    details () {
      return join('', '\n', details, ': \n', join('\n', this.sort(byStep)))
    },
  })
