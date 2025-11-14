import type { Fn } from '../index.ts';
import { env, stdout, stderr, createLogUpdate, inspect } from '../deps.ts';
import { joined, ANSI, stackTrace } from '../format.ts';
const { red, yellow, dim, gray } = ANSI;
/** Logging interface. */
export type Log = {
  prefix:     string,
  format?:    Fn<unknown[], string>,
  formatOne?: Fn<[string],  string>,
  info  (...args: unknown[]): unknown;
  log   (...args: unknown[]): unknown;
  debug (...args: unknown[]): unknown;
  warn  (...args: unknown[]): unknown;
  error (...args: unknown[]): unknown;
  trace (...args: unknown[]): unknown;
};
/** Create logger. */
export function Log <T extends Log> (context: Partial<T> = {}): T {
  context.prefix ??= '';
  context.format ??= (args: unknown[]) =>
    (context.prefix ? `${context.prefix} ` : '') +
      joined(' ', args.map(context.formatOne));
  context.formatOne ??= (x: unknown) => (typeof x === 'string') ? x :
    (x && (typeof x === 'object') && (x instanceof Error)) ? x.message :
    inspect(x, { depth: 10, colors: true });
  const logWidth = (stdout.getWindowSize()||[Number(env.COLUMNS)])[0]
    || Number(env.COLUMNS) || Infinity;
  const logUpdater = createLogUpdate(stdout, { defaultWidth: logWidth });
  context.info  = (...args: unknown[]) => logUpdater(context.format(args) as string);
  context.log   = (...args: unknown[]) => logUpdater.persist(context.format(args) as string);
  context.error = (...args: unknown[]) => logUpdater.persist(red(context.format(args)));
  context.warn  = (...args: unknown[]) => logUpdater.persist(yellow(context.format(args)));
  context.debug = (...args: unknown[]) => logUpdater.persist(dim(context.format(args)));
  context.trace = (...args: unknown[]) => console.trace(gray(5, context.format(args)+'\n'));
  return context as T;
}
/** Enable tracing for all `console.log` calls,
  * colorize them, and reroute to stderr. */
export function traceConsole () {
  if (!(console as { untrace?: Fn }).untrace) {
    const { log, info, warn, error } = globalThis.console;
    Object.assign(globalThis.console, {
      log:   traced(ANSI.yellow('log')),
      info:  traced(ANSI.blue('info')),
      warn:  traced(ANSI.yellow('warn')),
      error: traced(ANSI.red('error')),
      untrace: function fadromaUntraceConsole () {
        Object.assign(globalThis.console, { log, info, warn, error });
      }
    });
  }
  function traced (kind: string) {
    return (...args: unknown[]) => {
      const trace = ANSI.gray(8, stackTrace(3, 1).join('\n '));
      const line = args.map(x=>inspect(x, { depth: Infinity })).join(' ');
      stderr.write(`${kind} ${line} ${trace}\n`);
    };
  }
}
