import type { Stringy } from '../types.ts';
import { cwd } from '../deps.ts';

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
