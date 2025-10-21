/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;
/** Soft optional. */
export type Maybe<T> = T|Falsy;
/** Thing, or promise of thing. */
export type MaybeAsync<T = unknown> = T|Promise<T>;
/** Function that may or may not be async. */
export type MaybeAsyncFn<T = unknown, A extends unknown[] = unknown[]> =
  (..._: A)=>MaybeAsync<T>;
/** An expected isomorphism. */
export type Step = <T = unknown, U = T> (_: T) => MaybeAsync<U>;

/** Output target, e.g. `process.stdout`. */
export type Write  = { write (...data: unknown[]): unknown };
/** Logging interface. */
export type Logger<I extends Id, L extends Console> = Identified<I> & { log: L };
/** Internal identifier. */
export type Id = string|number|bigint
/** Uniquely identified item. */
export type Identified<I extends Id> = { id: I };
/** Human-readable name. */
export type Name = string
/** Named item. */
export type Named = { /* The name. */ name: Name };
/** Human-readable info interface. */
export type Info = { summary (): string, details (): string };
/** Hash. */
export type Hash = string|Uint8Array;
/** Hashed item. */
export type Hashed = { /** The hash. */ hash: Hash };
/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };
/** TODO: Alias for various buffer types. */
export type Bytes = Uint8Array;
/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];
/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never;
/** Slice off the 1st arg of every function */
export type ToApi<I> = {
  [k in keyof I]: I[k] extends (...args: infer R) => infer T
    ? Method<I[k]>
    : I[k]
};
/** Type of chain API implementation. */
export type Impl<A extends Api, D extends Context> = {
  [k in keyof A]: A[k] extends (...args: infer R) => infer T
    ? ((deps: D, ...args: R) => T)
    : never
};

/** Start time and duration. */
export type Timed   = { /** Starting time in milliseconds. */
                        t0?: number
                      , /** Duration in milliseconds. */
                        tD?: number };
export const _FULL_WIDTH = "TODO";
export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);
export const logger = ({ to = console, name }): Logger =>
  Object.assign(to, { name });
/** Show a stringified object. */
export const see = (arg: unknown) => {
  const color = !NO_COLOR // FIXME move these to color.ts:
  const dim   = color ? '\x1b[38;5;245m' : ''
  const reset = color ? '\x1b[0m'        : ''
  console.debug(`${dim}${stringify(arg)}${reset}`)
  return arg
};
export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};
export const chunks = (...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  strs.flat().filter(Boolean).map(x=>x!.toString())
export const str = (...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  chunks(...strs).join('')
export const joined = (joiner: string, ...strs: Array<Falsy|Stringy|Array<Falsy|Stringy>>) =>
  chunks(...strs).join(joiner)
export const joiner = (x?: Stringy, y = ' ') => x ? (x.toString() + y) : ''
           , col1 = 8
           , pad1 = (x?: Stringy, c = '·') => joiner(x).padEnd(col1, c)
           , col2 = 48
           , pad2 = (x?: Stringy, c = ' ') => joiner(x).padEnd(col2, c);
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
const numbersWithoutZero = "123456789";
const randomNumeric = (): string => numbersWithoutZero[Math.floor(Math.random() * numbersWithoutZero.length)];
export const randomId = (length = 12): number => parseInt(Array.from({ length }) .map(() => randomNumeric()).join(""), 10);
export const formatMsec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(col1));
export const addZeros = (n: number|Uint128, z: number): Uint128 =>
  `${n}${[...Array(z)].map(() => '0').join('')}`;
export const toHex = (d: string|number|bigint, pad = 2) => {
  let hex = Number(d).toString(16)
  pad = typeof (pad) === "undefined" || pad === null ? pad = 2 : pad
  while (hex.length < pad) hex = "0" + hex
  return hex
}
export const pickRandom = <T>(set: Set<T>): T =>
  [...set][Math.floor(Math.random()*set.size)];
