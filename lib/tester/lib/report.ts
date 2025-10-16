import type * as Test from '../types.ts';
import { formatMsec, red, green, orange, yellow, GRAY, ANSI_RESET } from '../deps.ts';

export const defTestReport = ({
  failFast = true,
  pass = defResultCategory(`🟢`, 'passed',   'Passed',  green('ok')),
  fail = defResultCategory(`🔴`, 'failed',   'Failed',  red('wrong')),
  todo = defResultCategory(`🟠`, 'tasks',    'TODO',    orange('todo')),
  warn = defResultCategory(`🟡`, 'warnings', 'Warning', yellow('warning')),
  summary = () => join(' ', (pass.length > 0) && pass.summary(),
                            (fail.length > 0) && fail.summary(),
                            (todo.length > 0) && todo.summary(),
                            (warn.length > 0) && warn.summary()),
  details = () => join(' ', (pass.length > 0) && pass.details(),
                            (fail.length > 0) && fail.details(),
                            (todo.length > 0) && todo.details(),
                            (warn.length > 0) && warn.details()),
  context = ({ t0 = performance.now, ...rest } = {}) => ({
    t0,
    count: '',
    crumb: '',
    pass: pass.add,
    fail: fail.add,
    todo: todo.add,
    warn: warn.add,
    ...rest,
    async track (count: string, label: string, callback: Test.Step) {
      const crumb = `${count?(count+' '):''}${label?(label+' '):''}`
      const t0 = performance.now()
      console.log(`👉️ T=${formatMsec(t0)} ${crumb}`)
      try {
        return pass.add(t0, crumb, await callback(context({ t0, crumb, count })))
      } catch (e) {
        if (e.todo) {
          todo.add(t0, crumb, '');
          throw e;
        } else {
          const failure = fail.add(t0, crumb, e.message, e.stack.split('\n').slice(1).join('\n'));
          if (failFast) { throw failure; } else { return failure; }
        }
      }
    }
  })
} = {}): Test.Report => ({ pass, fail, todo, warn, context, summary, details })

export const join = (joiner: String, ...data: (String|false|null)[]) =>
  data.flat().filter(Boolean).join(joiner);

export const defResultCategory = (
  icon: string, summary: string, details: string, tag: string
): Test.Results => {
  const results: unknown[] = []
  return Object.assign(results, {
    icon,
    add (t0: number, summary: string, result: string, ...extra: unknown[]) {
      const tD = performance.now() - t0
      let text = `${icon} T+${formatMsec(tD)} ${tag} ${summary} ${result}`
      let index = 2;
      for (let line of extra) {
        if (typeof line === 'object') line = JSON.stringify(line);
        text += `\n              ${GRAY[++index]}${line}${ANSI_RESET}`
      }
      console.log(text);
      results.push([summary, result, ...extra])
      return result
    },
    summary () {
      return join(' ', icon, String(results.length), summary)
    },
    details () {
      const formatStep = (x: unknown[]) => [
        `${icon} ${x[0]}`, ...x.slice(1).filter(Boolean)
      ].join('\n')
      return join('',
        '\n',
        details,
        ': \n',
        join('\n', results.sort(byStep).map(formatStep)),
        '\n')
    },
  })
}

// TODO: tested step counter
export const reStep = / (\d+)(.(\d+))? /
export const byStep = (a, b) => {
  const [_a0, a1 = NaN, _a2, a3 = NaN] = (a[0].match(reStep)||[]).map(Number)
  const [_b0, b1 = NaN, _b2, b3 = NaN] = (b[0].match(reStep)||[]).map(Number)
  const result = (a1 > b1) ? 1 : (a1 < b1) ? -1 : (a3 > b3) ? 1 : (a3 < b3) ? -1 : -1
  return result
}
