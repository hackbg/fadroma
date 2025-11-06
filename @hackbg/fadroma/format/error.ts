import type { Stringy } from '../index.ts';
import { getCwd } from '../deps.ts';
import { bold, gray } from './ansi.ts';

export const formatError = (e: Error, name?: Stringy) => {
  const [head, ...tail] = (e?.stack||'').split('\n')
  const stack = tail.map(x=>x
    .replace('('+getCwd()+'/', '(')
    .replace('./node_modules/.pnpm/', ''))
  e.message = e.message.split('Logs:')[0].trim()
  if (name) e.message = name + ': ' + e.message
  e.stack = [head, name?`    ${name}`:null, ...stack].filter(Boolean).join('\n')
  return e
};

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

/** Format the test summary. */
export const alignTrace = (line: string) => {
  line = line.replace('file://'+getCwd(), '.');
  line = line.replace(getCwd(), '.');
  line = line.split(' (')
    .map((x,i)=>(i===0)?bold(gray(2, x.padEnd(32))):gray(3, x))
    .join(gray(3, ' ('));
  return line
}

/** Add originating test step to stack trace.
  *
  * Since there is a degree of indirection when composing curried functions
  * (the code is defined from one place but executed from another),
  * without this helper the real stack gets lost. */
export const addStepStack = (
  step: { name?: string, stack?: string[] }, error: Error
) => {
  if (typeof error !== 'object') error = new Error(error);
  error.stack ||= ''
  if (step.stack) error.stack += '\n  From:\n' + step.stack.join('\n')
  return error
}

export const withInfiniteStack = async (fn, ...args) => {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;
  const result = await fn(...args);
  Error.stackTraceLimit = stackTraceLimit;
  return result;
}

export function stackTrace (slice = 3): string[] {
  return new Error().stack.split('\n').slice(slice).map(x=>alignTrace(x.trim()));
}
