let maxContextLength = 0

function Konzola (context) {

  maxContextLength = Math.max(maxContextLength, context.length)

  const INFO  = () => [`%cINFO  ${context.padEnd(maxContextLength)}`, 'font-weight:bold']
  const WARN  = () => [`%cWARN  ${context.padEnd(maxContextLength)}`, 'font-weight:bold']
  const ERROR = () => [`%cERROR ${context.padEnd(maxContextLength)}`, 'font-weight:bold']
  const TRACE = () => [`%cTRACE ${context.padEnd(maxContextLength)}`, 'font-weight:bold']

  const INDENT = "\n      "
  const format = (arg) => arg

  const log = (...args) => console.log(...args)

  return Object.assign(log, {
    log,
    format,
    info:  (...args) => console.info(...INFO(),  ...args),
    warn:  (...args) => console.warn(...WARN(),  ...args),
    error: (...args) => console.error(...ERROR(), ...args),
    trace: (...args) => {
      console.debug(...TRACE(), ...args.map(format))
      console.trace()
    },
    debug: (...args) => {
      if (!process.env.NO_DEBUG) {
        console.debug(args.map(format).join('').slice(1))
      }
      return args[0]
    },
    table: (rows = []) => console.log(table(rows)),
  })

}

export default Konzola
export { Konzola }
export const Console = Konzola

export function timestamp (d = new Date()) {
  return d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
}

export const bold = x => x
