import type { Fn, Str } from '../index.ts';
import { bold, gray } from './Ansi.ts';
import process from 'node:process'; // destructuring this import breaks in Vite

export function Err (message: string, ...args: object[]) {
  return Object.assign(new Error(message), ...args)
}

export function formatError (e: Error, name?: Str) {
  const [head, ...tail] = (e?.stack||'').split('\n');
  const stack = tail.map(x=>x
    .replace('('+process.cwd()+'/', '(')
    .replace('./node_modules/.pnpm/', ''));
  e.message = e.message.split('Logs:')[0].trim();
  if (name) e.message = name + ': ' + e.message;
  name = name ? `    ${name}` : null;
  e.stack = [head, name, ...stack].filter(Boolean).join('\n');
  return e;
}
/** Set `Error.stackTraceLimit` to `Infinity`,
  * run a function, then restore its previous value. */
export async function withInfiniteStack <F extends Fn> (
  fn: F, ...args: Parameters<F>
): Promise<ReturnType<F>> {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  const result = await fn(...args);
  Error.stackTraceLimit = stackTraceLimit;
  return result as ReturnType<F>;
}
/** Generate a stack trace. */
export function stackTrace (slice = 3, length?: number): string[] {
  return new Error().stack.split('\n')
    .slice(slice, length)
    .map(x=>alignTrace(x.trim()));
}
/** Relativize paths in stack trace, colorize, and reduce indent. */
export function alignTrace (line: string) {
  line = line.replace('file://'+process.cwd(), '.');
  line = line.replace(process.cwd(), '.');
  const format = (x: string, i: number) => (i===0)
    ? bold(gray(2, x.padEnd(36))) : gray(4, x);
  line = line.split(' (').map(format).join(gray(4, ' ('));
  return line
}

/** Extended error class. */
class Oops extends Error {
  // Todos are handled differently by the tester.
  todo?: boolean
  constructor (message: string, args?: object) {
    super(message);
    args && Object.assign(this, args);
  }
  // Throw a TODO.
  static TODO (info: unknown) {
    throw new this(info as string, { todo: true })
  }
  static required = <T>(...info: string[]): T => {
    throw new Error('Missing required value: ' + info.join(' '));
  }
  static requiredLate = (...info: string[]) => () => {
    throw new Error('Missing required value: ' + info.join(' '));
  }
  /** Define an error subclass. */
  static define <T extends unknown[]> (
    /** Name of error class. Prepended to parent. */
    name: string,
    /** How to generate the error message from the arguments passed to the constructor. */
    getMessage: (string|((...args: T)=>string)) = (...args: T) => args.join(' '),
    /** Whether there are any further construction steps such as assigning properties. */
    construct?: (self: Error, ...args: T) => any
  ) {
    const fullName = `${this.name}_${name}`
    class OopsError extends this {
      name = fullName
      constructor (...args: T) {
        super((typeof getMessage === 'string') ? getMessage : getMessage(...args))
        if (construct) construct(this, ...args)
      }
    }
    return Object.defineProperty(OopsError, 'name', { value: fullName })
  }
}

export { Oops as Error }
