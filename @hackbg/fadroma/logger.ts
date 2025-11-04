import { inspect, stdout, logUpdate } from './deps.ts';
import { joined, ANSI } from './format.ts';
import { reflect } from './call.ts';
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

export const logger = reflect(null, function logger <T extends Log> ({
  formatError = e => e.stack,
  formatOne = x =>
    (typeof x === 'string') ? x :
    (x && (typeof x === 'object') && (x instanceof Error)) ? x.message :
    inspect(x, { depth: 10, colors: true }),
  format = (args: unknown[]) => joined(' ', args.map(formatOne)),
  info   = (...args: unknown[]) => logUpdate(format(args)),
  log    = (...args: unknown[]) => logUpdate.persist(format(args)),
  error  = (...args: unknown[]) => logUpdate.persist(red(format(args))),
  warn   = (...args: unknown[]) => logUpdate.persist(yellow(format(args))),
  debug  = (...args: unknown[]) => logUpdate.persist(dim(format(args))),
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
