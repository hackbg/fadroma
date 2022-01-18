import { cwd } from 'process'
import { relative } from 'path'
import { fileURLToPath } from 'url'

import { render } from 'prettyjson'
import { table } from 'table'
import colors from 'colors'
const { bold, red, green, yellow, magenta } = colors

export default function Console (context: string) {

  try {
    context = relative(cwd(), fileURLToPath(context))
  } catch {
    //
  }

  const INDENT = "\n      "

  const format = (arg: any) => {
    if (typeof arg === 'object') {
      return INDENT + render(arg).replace(/\n/g, INDENT).trim()
    } else {
      return INDENT + arg
    }
  }

  return {
    context, format,
    table: (rows: any) => console.log(table(rows)),
    log:   (...args: Array<any>) => console.log(...args),
    info:  (...args: Array<any>) => console.info(bold(green('INFO ')), ...args),
    warn:  (...args: Array<any>) => console.warn(bold(yellow('WARN ')), ...args),
    error: (...args: Array<any>) => console.error(bold(red('ERROR')), ...args),
    trace: (...args: Array<any>) => {
      console.debug(bold(magenta('TRACE')), ...args.map(format))
      console.trace()
    },

    debug: (...args: Array<any>) => {
      if (!process.env.NO_DEBUG) {
        console.debug(args.map(format).join('')+'\n')
      }
      return args[0]
    }
  }

}
