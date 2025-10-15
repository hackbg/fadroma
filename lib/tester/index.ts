export * from './lib/report.ts';
export * from './lib/task.ts';
export * from './lib/tester.ts';

export class Tester {
  constructor ({
    url  = import.meta.url,
    argv = process.argv.slice(1)
  }) {
    if (false /*TODO*/) setImmediate(()=>this.run())
  }
  failFast  = true
  successes = []
  failures  = []
  async track (count, label, callback) {
    const prefix = `${pad1(count)} ${label}`
    const t0 = performance.now()
    console.log(`👉️ T=${formatMsec(t0)} ${prefix}`)
    try {
      return this.passed(t0, prefix, await callback({ t0, prefix }))
    } catch (e) {
      if (this.failFast) {
        throw this.failed(t0, prefix, e)
      } else {
        return this.failed(t0, prefix, e)
      }
    }
  }
  passed (t0, info, results) {
    const tD = performance.now() - t0
    const text = `🟢 T+${formatMsec(tD)} ${green('OK')} ${info}`
    this.successes.push(text)
    //console.log(text)
    return results
  }
  failed (t0, info, error) {
    const tD = performance.now() - t0
    const text = `🔴 T+${formatMsec(tD)} ${red('incorrect')} ${info}`
    this.failures.push(text + '\n   ' + (error?.message || '').split('\n')[0])
    return formatError(error, info)
  }
  async run (suite) {
    let error
    try { await suite({ report: this }) } catch (e) { error = e }
    if (this.successes.length > 0) {
      console.log('\nPassed:')
      for (const line of this.successes.sort(byStep)) console.log(line)
    }
    if (this.failures.length > 0) {
      console.log('\nFailed:')
      for (const line of this.failures.sort(byStep)) console.log(line)
    }
    console.log(`\n` + [
      (this.successes.length > 0) ? `🟢 ${this.successes.length} passed ` : '',
      (this.failures.length  > 0) ? `🔴 ${this.failures.length} failed ` : '',
    ].join(' '))
    if (error) throw error
  }
}

