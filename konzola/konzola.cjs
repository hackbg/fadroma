module.exports         = Konzola
module.exports.default = Konzola
module.exports.Console = Konzola
module.exports.Konzola = Konzola

const { cwd } = require('process')
const { relative } = require('path')
const { fileURLToPath } = require('url')
const { render } = require('prettyjson')
const { table } = require('table')
const { bold, red, green, yellow, magenta, inverse } = require('colors')

let maxContextLength = 0

function Konzola (context) {

  maxContextLength = Math.max(maxContextLength, context.length)

  const INFO  = () => bold(green(  `INFO  ${context.padEnd(maxContextLength)}`))
  const WARN  = () => bold(yellow( `WARN  ${context.padEnd(maxContextLength)}`))
  const ERROR = () => bold(red(    `ERROR ${context.padEnd(maxContextLength)}`))
  const TRACE = () => bold(magenta(`TRACE ${context.padEnd(maxContextLength)}`))

  const INDENT = "\n      "
  const format = (arg) => {
    if (typeof arg === 'object') {
      return INDENT + render(arg).replace(/\n/g, INDENT).trim()
    } else {
      return INDENT + arg
    }
  }

  return {
    format,
    table: (rows = []) => console.log(table(rows)),
    log:   (...args) => console.log(           ...args),
    info:  (...args) => console.info( INFO(),  ...args),
    warn:  (...args) => console.warn( WARN(),  ...args),
    error: (...args) => console.error(ERROR(), ...args),
    trace: (...args) => {
      console.debug(bold(magenta('TRACE')), ...args.map(format))
      console.trace()
    },

    debug: (...args) => {
      if (!process.env.NO_DEBUG) {
        console.debug(args.map(format).join('').slice(1))
      }
      return args[0]
    }
  }

}
