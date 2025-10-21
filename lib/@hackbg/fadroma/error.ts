import { cwd } from './deps.ts';
import type { Stringy } from './string.ts';

export const formatError = (e: Error, name?: Stringy) => {
  const [head, ...tail] = (e?.stack||'').split('\n')
  const stack = tail.map(x=>x
    .replace('('+cwd()+'/', '(')
    .replace('./node_modules/.pnpm/', ''))
  e.message = e.message.split('Logs:')[0].trim()
  if (name) e.message = name + ': ' + e.message
  e.stack = [head, name?`    ${name}`:null, ...stack].filter(Boolean).join('\n')
  return e
};

class Oops extends Error {
  // Todos are handled differently by the tester.
  todo?: boolean

  // Throw a TODO.
  static TODO (info: unknown) {
    throw new this(info as string, { todo: true })
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
