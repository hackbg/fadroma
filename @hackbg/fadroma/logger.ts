import { inspect, stdout } from './deps.ts';
import { joined, ANSI } from './format.ts';
import { reflect } from './call.ts';
const { red, yellow, dim, gray } = ANSI;

/** Logging interface. */
export type Log = {
  log   (...args: unknown[]): unknown;
  debug (...args: unknown[]): unknown;
  warn  (...args: unknown[]): unknown;
  error (...args: unknown[]): unknown;
  trace (...args: unknown[]): unknown;
};

export const logger = reflect(null, function logger <T extends Log> ({
  output = stdout,
  format = (args: unknown[]) => joined(' ', args.map(x=>(typeof x === 'string') ? x : inspect(x, { depth: 10, colors: true }))),
  log    = (...args: unknown[]) => output.write(format(args)+'\n'),
  error  = (...args: unknown[]) => output.write(red(format(args)+'\n')),
  warn   = (...args: unknown[]) => output.write(yellow(format(args)+'\n')),
  debug  = (...args: unknown[]) => output.write(dim(format(args)+'\n')),
  trace  = (...args: unknown[]) => console.trace(gray(5, format(args)+'\n')),
  ...rest
} = {}): T {
  return { log, error, warn, debug, trace, ...rest } as T
});
