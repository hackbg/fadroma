import { inspect, stdout } from './deps.ts';
import { joined, ANSI } from './format.ts';
import { reflect } from './call.ts';
const { red, yellow, dim } = ANSI;

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
  log    = (...args: unknown[]) => output.write('\n'+format(args)),
  error  = (...args: unknown[]) => output.write(red('\n'+format(args))),
  warn   = (...args: unknown[]) => output.write(yellow('\n'+format(args))),
  debug  = (...args: unknown[]) => output.write(dim('\n'+format(args))),
  trace  = (...args: unknown[]) => console.trace(dim('\n'+format(args))),
  ...rest
} = {}): T {
  return { log, error, warn, debug, trace, ...rest } as T
});
