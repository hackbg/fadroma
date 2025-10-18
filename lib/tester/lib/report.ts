import type * as Test from '../types.ts';
import { joined, formatMsec, red, green, orange, yellow, GRAY, ANSI_RESET } from '../deps.ts';

export const defTestReport = ({
  failFast = true,
  pass = category(`🟢`, 'passed',   'Passed',  green( 'ok     ')),
  fail = category(`🔴`, 'failed',   'Failed',  red(   'wrong  ')),
  todo = category(`🟠`, 'tasks',    'TODO',    orange('todo   ')),
  warn = category(`🟡`, 'warnings', 'Warning', yellow('warning')),
  summary = () => joined(' ', ...[pass, fail, todo, warn].map(x=>x.length > 0 && x.summary())),
  details = () => joined(' ', ...[pass, fail, todo, warn].map(x=>x.length > 0 && x.details())),
  context = ({ t0 = performance.now, ...rest } = {}) => ({
    t0, count: '', crumb: '',
    ...[pass, fail, todo, warn].map(x=>x.add),
    ...rest,
    async track (count: string, label: string, callback: Test.Step) {
      const crumb = `${count?(count+' '):''}${label?(label+' '):''}`
      const t0 = performance.now()
      console.log(`👉️ @${formatMsec(t0)} ${crumb}`)
      try {
        return pass.add(t0, crumb, await callback(context({ t0, crumb, count })))
      } catch (e: unknown) {
        const error = e as { todo?: unknown, message: string, stack?: string };
        if (error.todo) {
          return todo.add(t0, crumb, error.message)
        } else {
          const failure = fail.add(t0, crumb, error.message, error.stack?.split('\n').slice(1).join('\n'));
          if (failFast) { throw failure; } else { return failure; }
        }
      }
    }
  })
} = {}): Test.Report => ({
  pass, fail, todo, warn,
  context, summary, details
})

export const reStep = / (\d+)(.(\d+))? /

export const category = (
  icon: string, summary: string, details: string, tag: string,
  detail = ({ summary, details }: Test.Result) => joined('\n',
    `${icon} ${summary}`, ...details.filter(Boolean)),
  sorter = (a: Test.Result, b: Test.Result) => {
    const [_a0, a1 = NaN, _a2, a3 = NaN] = (a.summary.match(reStep)||[]).map(Number)
    const [_b0, b1 = NaN, _b2, b3 = NaN] = (b.summary.match(reStep)||[]).map(Number)
    const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
    return -result
  }
): Test.Results => {
  const results: Test.Result[] = []
  return Object.assign(results, {
    icon,
    summary () {
      return joined(' ', icon, String(results.length), summary);
    },
    details () {
      const sorted = joined('\n', results.sort(sorter).map(detail));
      return joined('', '\n', details, ': \n', sorted, '\n');
    },
    add (t0: number, summary: string, ...details: unknown[]) {
      const tD = performance.now() - t0;
      const result = { t0, tD, summary, details };
      results.push(result);
      return result;
    },
  })
}
