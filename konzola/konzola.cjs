const colors = require('colors')
const { bold, red, green, yellow, magenta, inverse } = colors
const { render } = require('prettyjson')
const { prompts } = require('prompts')
const { table } = require('table')
const { cwd } = require('process')
const { relative } = require('path')
const { fileURLToPath } = require('url')

let maxContextLength = 0

function Konzola (context) {

  maxContextLength = Math.max(maxContextLength, context.length)

  const INFO  = () => bold(green(  `${context.padEnd(maxContextLength)} INFO `))
  const WARN  = () => bold(yellow( `${context.padEnd(maxContextLength)} WARN `))
  const ERROR = () => bold(red(    `${context.padEnd(maxContextLength)} ERROR`))
  const TRACE = () => bold(magenta(`${context.padEnd(maxContextLength)} TRACE`))

  const INDENT = "\n      "
  const format = (arg) => {
    if (typeof arg === 'object') {
      return INDENT + render(arg).replace(/\n/g, INDENT).trim()
    } else {
      return INDENT + arg
    }
  }

  const log = (...args) => console.log(...args)

  return Object.assign(log, {
    log,
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
    },
    table: (rows = []) => console.log(table(rows)),
    format,
  })

}

module.exports         = Konzola
module.exports.default = Konzola
module.exports.Console = Konzola
module.exports.Konzola = Konzola
module.exports.colors  = colors
module.exports.bold    = colors.bold
module.exports.render  = render
module.exports.prompts = prompts
module.exports.table   = table
