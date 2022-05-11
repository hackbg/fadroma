function Konzola (context) {

  maxContextLength = Math.max(maxContextLength, context.length)

  const INFO  = () => `INFO  ${context.padEnd(maxContextLength)}`
  const WARN  = () => `WARN  ${context.padEnd(maxContextLength)}`
  const ERROR = () => `ERROR ${context.padEnd(maxContextLength)}`
  const TRACE = () => `TRACE ${context.padEnd(maxContextLength)}`

  const INDENT = "\n      "
  const format = (arg) => arg

  return {
    format,
    table: (rows = []) => console.log(table(rows)),
    log:   (...args) => console.log(           ...args),
    info:  (...args) => console.info( INFO(),  ...args),
    warn:  (...args) => console.warn( WARN(),  ...args),
    error: (...args) => console.error(ERROR(), ...args),
    trace: (...args) => {
      console.debug('TRACE', ...args.map(format))
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

module.exports         = Konzola
module.exports.default = Konzola
module.exports.Console = Konzola
module.exports.Konzola = Konzola
