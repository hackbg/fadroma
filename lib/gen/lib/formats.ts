import type { Bytes, Step } from '../deps.ts';
import { pipe, writeFile, joinPath, mkdir } from '../deps.ts';
import type { FSContext, FSOp } from '../types.ts';

/** Point-free NOP. */
export const identity = <T>(x: T): T => x;

/** Specify a condition. */
export const when = (condition: boolean, ...fns: Step<unknown>[]) =>
  Object.assign(function when <T> (context: T) {
    return (condition ? pipe(...fns) : identity)(context)
  }, { condition, fns });

/** Specify a temporary directory. */
export const tmpdir = () => { throw new Error("TODO") };

/** Specify a directory. */
export const dir = (
  path: string, ...contents: FSOp[]
) => Object.assign(async function makeDirectory (cwd: FSContext) {
  const location = joinPath(cwd, path);
  await mkdir(location, { recursive: true });
  return await Promise.all(contents.map((x: FSOp)=>x(location)));
}, { path });

/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => Object.assign(async function writeBinaryData (cwd: FSContext) {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  const data = await Promise.resolve(pipe(...steps)(value)) as Bytes;
  await writeFile(joinPath(cwd, path), data);
  return data;
}, { path, value, steps });

/** Specify a text file. */
export const text = (
  path: string, value?: string|string[], ...steps: Array<(_:unknown)=>unknown>
) => Object.assign(async function writeText (cwd: FSContext) {
  const data = await Promise.resolve(pipe(...steps)(value || '')) as string;
  await writeFile(joinPath(cwd, path), data, 'utf8');
  return data;
}, { path, value, steps });

/** Specify a JSON file. */
export const json     = <T>(path: string, ...steps: Step<T>[]) => text(path,
  ...steps, (x: unknown) => JSON.stringify(x));

/** Specify a Markdown file. */
export const markdown = <T>(path: string, ...steps: Step<T>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a YAML file. */
export const yaml = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a TOML file. */
export const toml = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a Rust file. */
export const rust = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a JS file. */
export const js = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a TS file. */
export const ts = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });
