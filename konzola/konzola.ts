import { cwd } from 'process'
import { relative } from 'path'
import { fileURLToPath } from 'url'

import { render } from 'prettyjson'
import { table } from 'table'
import colors from 'colors'
const { bold, red, green, yellow, magenta, inverse } = colors

let maxContextLength = 0

export default function Console (context: string = '') {

  maxContextLength = Math.max(maxContextLength, context.length)

  const INFO  = () => bold(green(  `INFO  ${context.padEnd(maxContextLength)}`))
  const WARN  = () => bold(yellow( `WARN  ${context.padEnd(maxContextLength)}`))
  const ERROR = () => bold(red(    `ERROR ${context.padEnd(maxContextLength)}`))
  const TRACE = () => bold(magenta(`TRACE ${context.padEnd(maxContextLength)}`))

  const INDENT = "\n      "
  const format = (arg: any) => {
    if (typeof arg === 'object') {
      return INDENT + render(arg).replace(/\n/g, INDENT).trim()
    } else {
      return INDENT + arg
    }
  }

  return {
    format,
    table: (rows: any) => console.log(table(rows)),
    log:   (...args: Array<any>) => console.log(           ...args),
    info:  (...args: Array<any>) => console.info( INFO(),  ...args),
    warn:  (...args: Array<any>) => console.warn( WARN(),  ...args),
    error: (...args: Array<any>) => console.error(ERROR(), ...args),
    trace: (...args: Array<any>) => {
      console.debug(bold(magenta('TRACE')), ...args.map(format))
      console.trace()
    },

    debug: (...args: Array<any>) => {
      if (!process.env.NO_DEBUG) {
        console.debug(args.map(format).join('').slice(1))
      }
      return args[0]
    }
  }

}
