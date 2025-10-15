import { Case, env, cwd } from '../deps.ts'
import type { Id, Identified } from './core.ts'
export type Logger<I extends Id, L extends Console> = Identified<I> & { log: L };
export type Stringy = string|{toString():string}
export const stringify = (
  obj: unknown, indent?: number, shift?: number, shiftFirst = true
) => {
  let json = JSON.stringify(obj, getStringifier(), indent)
  if (indent && indent > 0) {
    const spaces = Array(shift).fill(' ').join('')
    json = json.split('\n')
      .map((line, i)=>(shiftFirst||i>0)?`${spaces}${line}`:line)
      .join('\n')
  }
  return json
}
export const getStringifier = () => {
  const visited = new Set()
  return function stringifier (_key: unknown, value: unknown) {
    // TODO: Stringification registry!
    //if (value instanceof BN) return value.toString()
    //if (value instanceof PK) return value.toString()
    //if (value instanceof Keypair) return value.publicKey.toString()
    if (visited.has(value))  return '<circular>'
    if (typeof value === 'object') visited.add(value)
    return value
  }
}
export const joiner = (x?: Stringy, y = ' ') => x ? (x.toString() + y) : '',
  col1 = 8,  pad1 = (x?: Stringy, c = '·') => joiner(x).padEnd(col1, c),
  col2 = 48, pad2 = (x?: Stringy, c = ' ') => joiner(x).padEnd(col2, c);
export const formatMsec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(col1));
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
export const see = (arg: unknown) => {
  const color = !('NO_COLOR' in env)
  const dim   = color ? '\x1b[38;5;245m' : ''
  const reset = color ? '\x1b[0m'        : ''
  console.debug(`${dim}${stringify(arg)}${reset}`)
  return arg
}
export const camelize = <T extends object>(object: T) => {
  const returned = {}
  for (const [key, value] of Object.entries(object)) {
    Object.assign(returned, { [Case.camel(key) as keyof T]: value as T[keyof T] })
  }
  return returned
}
