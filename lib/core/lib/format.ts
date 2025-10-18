import { NO_COLOR, yellow } from './color.ts'

export const _FULL_WIDTH = "TODO";
export const formatMsec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(col1));

import type { Stringy } from '../types.ts';
export const chunks = (...strs: Array<Stringy|Array<Stringy>>) =>
  strs.flat().filter(Boolean).map(x=>x.toString())
export const str = (...strs: Array<Stringy|Array<Stringy>>) =>
  chunks(...strs).join('')
export const joined = (joiner: string, ...strs: Array<Stringy|Array<Stringy>>) =>
  chunks(...strs).join(joiner)

export const joiner = (x?: Stringy, y = ' ') => x ? (x.toString() + y) : ''
           , col1 = 8
           , pad1 = (x?: Stringy, c = '·') => joiner(x).padEnd(col1, c)
           , col2 = 48
           , pad2 = (x?: Stringy, c = ' ') => joiner(x).padEnd(col2, c);

import type { Write } from '../types.ts';
export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);

import type { Named } from '../types.ts';
/** Rename a function. */
export const renamed = <N extends Named> (name: string, fn: N): N =>
  name ? Object.defineProperty(fn, 'name', { configurable: true, value: name })
       : fn;

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
};

export const getStringifier = () => {
  const visited = new Set()
  return function stringifier (_key: unknown, value: unknown) {
    // TODO: Stringification registry:
    //if (value instanceof BN) return value.toString()
    //if (value instanceof PK) return value.toString()
    //if (value instanceof Keypair) return value.publicKey.toString()
    if (visited.has(value))  return '<circular>'
    if (typeof value === 'object') visited.add(value)
    return value
  }
};

export const see = (arg: unknown) => {
  const color = !NO_COLOR // FIXME move these to color.ts:
  const dim   = color ? '\x1b[38;5;245m' : ''
  const reset = color ? '\x1b[0m'        : ''
  console.debug(`${dim}${stringify(arg)}${reset}`)
  return arg
};

import { Case } from '../deps.ts';
export const camelize = <T extends object>(object: T) => {
  const returned = {}
  for (const [key, value] of Object.entries(object)) {
    Object.assign(returned, { [Case.camel(key) as keyof T]: value as T[keyof T] })
  }
  return returned
};
