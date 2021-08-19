import { cwd } from 'process'
import { relative } from 'path'
import { fileURLToPath } from 'url'
import { render } from 'prettyjson'
import colors from 'colors'

const Console = filename => {
  filename = relative(cwd(), fileURLToPath(filename))
  const format = arg => '\n'+((typeof arg === 'object') ? render(arg) : arg)
  return {
    filename,
    format,
    table: rows      => console.log(table(rows)),
    info:  (...args) => console.info('ℹ️ ', ...args),
    log:   (...args) => console.log(...args),
    warn:  (...args) => console.warn('⚠️ ', ...args),
    error: (...args) => console.error('🦋', ...args),
    debug: (...args) => {
      if (!process.env.NODEBUG) {
        console.debug('\n' + colors.yellow(filename), ...args.map(format)) }
      return args[0] } } }

export default Console
