import type { Step, Bytes, Fn } from '../index.ts';
import { writeFile, resolvePath, mkdir, getCwd } from '../deps.ts';
import { pipe, reflect } from '../call.ts';
/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths: Record<string, unknown>
};
/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FS) => FS;
/** Define a filesystem context. */
export const fsContext = ({
  cwd = getCwd(), paths = {}, ...rest
} = {}) => ({ cwd, paths, ...rest });
/** Specify a temporary directory. */
export const tmpdir = () => { throw new Error("TODO") };
/** Specify a directory. */
export const dir = (
  path: string, ...contents: FSOp[]
) => reflect(`mkdir ${path}`, async function makeDirectory (fs: FS = fsContext()) {
  const location = resolvePath(fs.cwd, path);
  await mkdir(location, { recursive: true });
  (fs.paths ||= {})[location] = { directory: true };
  return await Promise.all(contents.map((x: FSOp)=>x({ ...fs, cwd: location })));
}, { path });
/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => Object.assign(async function writeBinaryData (fs: FS = fsContext()) {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  const location = resolvePath(fs.cwd, path);
  const data = await Promise.resolve(pipe(...steps)(value)) as Bytes;
  await writeFile(location, data);
  fs.paths[location] = { file: true };
  return data;
}, { path, value, steps });
/** Specify a text file. */
export const text = (
  path: string, value?: string|string[], ...steps: Step<string>[]
) => Object.assign(async function writeText (fs: FS = fsContext()) {
  const location = resolvePath(fs.cwd, path);
  const data = await Promise.resolve(pipe(...steps)(value || '')) as string;
  await writeFile(location, data, 'utf8');
  fs.paths[location] = { file: true };
  return data;
}, { path, value, steps });
/** Specify a text file format. */
export const textFormat = format =>
  <T>(path: string, ...steps: Step<T>[]) =>
    text(path, ...steps, format);
/** Specify a JSON file. */
export const json = textFormat((x: unknown) => JSON.stringify(x));
/** Specify a Markdown file. */
export const markdown = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a YAML file. */
export const yaml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a TOML file. */
export const toml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a Rust file. */
export const rust = textFormat((_: unknown) => { throw new Error('unimplemented') });
