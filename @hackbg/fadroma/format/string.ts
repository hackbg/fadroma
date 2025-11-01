import type { Falsy, Bytes } from '../format.ts';
import { Case } from '../deps.ts';
import { NO_COLOR } from './ansi.ts';
import { call, identity } from '../call.ts';

/** String, or something with a `toString` method. */
export type Stringy = string|{ toString(): string };

export const UTF8 = {
  encoder: new TextEncoder(),
  decoder: new TextDecoder(),
  encode (x: string): Uint8Array {
    return UTF8.encoder.encode(x)
  },
  encodeInto (x: string, bytes: ArrayBufferView, offset = 0) {
    const encoded = UTF8.encode(x);
    for (let index = 0; index < encoded.length; index++) bytes[offset + index] = encoded[index];
    return encoded.length
  },
  decode (x: Bytes|Array<number>): string {
    if (!(x instanceof Uint8Array)) x = new Uint8Array(x);
    return UTF8.decoder.decode(x); // TODO optimize
  },
}

export const chunks = (...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  strs.flat().filter(Boolean).map(x=>x!.toString());

export const str = (...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  chunks(...strs).join('');

export const joined = (joiner: string, ...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  chunks(...strs).join(joiner);
export const glued  = call(joined, '');
export const spaced = call(joined, ' ');
export const lines  = call(joined, '\n');

export const
  joiner = (x?: Stringy, y = ' ') => x ? (x.toString() + y) : '',
  col1 = 8,  pad1 = (x?: Stringy, c = '·') => joiner(x).padEnd(col1, c),
  col2 = 48, pad2 = (x?: Stringy, c = ' ') => joiner(x).padEnd(col2, c);

export const see = (arg: unknown) => {
  const color = !NO_COLOR // FIXME move these to color.ts:
  const dim   = color ? '\x1b[38;5;245m' : ''
  const reset = color ? '\x1b[0m'        : ''
  console.debug(`${dim}${stringify(arg)}${reset}`)
  return arg
};

/** Stringify an object with optional custom indentation,
  * and also without failing on bigint and circular refs. */
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
/** A stringifier that doesn't fail on bigint and circular refs. */
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
export const camelize = <T extends object>(object: T) => {
  const returned = {}
  for (const [key, value] of Object.entries(object)) {
    Object.assign(returned, { [Case.camel(key) as keyof T]: value as T[keyof T] })
  }
  return returned
};

/* Wrap string at whitespace.
 *
 * word-wrap <https://github.com/jonschlinkert/word-wrap>
 * Copyright (c) 2014-2023, Jon Schlinkert.
 * Released under the MIT License. */
export function wordWrap (str: string, {
  width = 50,
  indent = '  ',
  newline = '\n' + indent,
  escape = identity,
  cut = false,
  trim = false
} = {}) {
  if (str == null) return str;
  let regexString = '.{1,' + width + '}';
  if (cut !== true) regexString += '([\\s\u200B]+|$)|[^\\s\u200B]+?([\\s\u200B]+|$)';
  const re = new RegExp(regexString, 'g');
  const lines = str.match(re) || [];
  let result = indent + lines.map(function(line: string) {
    if (line.slice(-1) === '\n') line = line.slice(0, line.length - 1);
    return escape(line);
  }).join(newline);
  if (trim === true) result = trimTabAndSpaces(result);
  return result;
  function trimEnd (str: string) {
    let lastCharPos = str.length - 1;
    let lastChar = str[lastCharPos];
    while(lastChar === ' ' || lastChar === '\t') {
      lastChar = str[--lastCharPos];
    }
    return str.substring(0, lastCharPos + 1);
  }
  function trimTabAndSpaces (str: string) {
    const lines = str.split('\n');
    const trimmedLines = lines.map((line) => trimEnd(line));
    return trimmedLines.join('\n');
  }
};
