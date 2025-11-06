import { env, stdout, createLogUpdate, inspect } from '../deps.ts';
import { Named, joined, ANSI, stackTrace } from '../format.ts';
const { red, yellow, dim, gray } = ANSI;

/** Logging interface. */
export type Log = {
  info  (...args: unknown[]): unknown;
  log   (...args: unknown[]): unknown;
  debug (...args: unknown[]): unknown;
  warn  (...args: unknown[]): unknown;
  error (...args: unknown[]): unknown;
  trace (...args: unknown[]): unknown;
};

export const logger = Named(null, function logger <T extends Log> ({
  formatError = e => e.stack,
  formatOne = x =>
    (typeof x === 'string') ? x :
    (x && (typeof x === 'object') && (x instanceof Error)) ? x.message :
    inspect(x, { depth: 10, colors: true }),
  format = (args: unknown[]) => joined(' ', args.map(formatOne)),
  //size   = stdout.getWindowSize() || [Number(env.COLUMNS)||80, Number(env.ROWS)||25],
  update = createLogUpdate(stdout, { defaultWidth: Infinity }),
  info   = (...args: unknown[]) => update(format(args)),
  log    = (...args: unknown[]) => update.persist(format(args)),
  error  = (...args: unknown[]) => update.persist(red(format(args))),
  warn   = (...args: unknown[]) => update.persist(yellow(format(args))),
  debug  = (...args: unknown[]) => update.persist(dim(format(args))),
  trace  = (...args: unknown[]) => console.trace(gray(5, format(args)+'\n')),
  ...rest
} = {}): T {
  return {
    info,
    log,
    error,
    warn,
    debug,
    trace,
    ...rest
  } as T
});

export function discourageConsole () {
  globalThis.console.log =
  globalThis.console.info =
  globalThis.console.warn =
  globalThis.console.error = (...args: unknown[]) => {
    const trace = stackTrace();
    stdout.write('\n'+
      ANSI.yellow('console.log')+' '+args.map(x=>inspect(x)).join(' ')+'\n '+
      ANSI.gray(8, trace.join('\n ')));
  };
}
