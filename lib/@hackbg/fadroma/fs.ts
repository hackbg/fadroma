import { writeFile, resolvePath, mkdir, getCwd } from './deps.ts';
import { pipe } from './call.ts';

export const fsContext = ({
  cwd   = getCwd(),
  paths = {}
} = {}) => ({ cwd, paths });

/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths: Record<string, unknown>
};

/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FS) => FS;

/** Specify a temporary directory. */
export const tmpdir = () => { throw new Error("TODO") };

/** Specify a directory. */
export const dir = (
  path: string, ...contents: FSOp[]
) => Object.assign(async function makeDirectory ({ cwd, paths }: FS) {
  const location = resolvePath(cwd, path);
  await mkdir(location, { recursive: true });
  paths[location] = { directory: true };
  return await Promise.all(contents.map((x: FSOp)=>x(location)));
}, { path });

/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => Object.assign(async function writeBinaryData ({ cwd, paths }: FS) {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  const location = resolvePath(cwd, path);
  const data = await Promise.resolve(pipe(...steps)(value)) as Bytes;
  await writeFile(location, data);
  paths[location] = { file: true };
  return data;
}, { path, value, steps });

/** Specify a text file. */
export const text = (
  path: string, value?: string|string[], ...steps: Array<(_:unknown)=>unknown>
) => Object.assign(async function writeText ({ cwd, paths }: FS) {
  const location = resolvePath(cwd, path);
  const data = await Promise.resolve(pipe(...steps)(value || '')) as string;
  await writeFile(location, data, 'utf8');
  paths[location] = { file: true };
  return data;
}, { path, value, steps });

const writeFormat = format => <T>(path: string, ...steps: Step<T>[]) =>
  text(path, ...steps, format);
/** Specify a JSON file. */
export const json = writeFormat((x: unknown) => JSON.stringify(x));
/** Specify a Markdown file. */
export const markdown = writeFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a YAML file. */
export const yaml = writeFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a TOML file. */
export const toml = writeFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a Rust file. */
export const rust = writeFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a JS file. */
export const js = writeFormat((_: unknown) => { throw new Error('unimplemented') });
/** Specify a TS file. */
export const ts = writeFormat((_: unknown) => { throw new Error('unimplemented') });
