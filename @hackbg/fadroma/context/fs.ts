import type { Bytes, Step } from '../index.ts';
import { tmpdir, mkdtemp, writeFile, resolvePath, mkdir, getCwd } from '../deps.ts';
import { pipe, reflect } from '../format/function.ts';

/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths: Record<string, unknown>
};
/** Define a filesystem context. */
export function FS ({
  cwd = getCwd(), paths = {}, ...rest
} = {}) {
  return { cwd, paths, ...rest }
}

/** A filesystem operation. Needs current working directory. */
export type FSNode = (_: FS) => FS;

/** Specify a temporary directory. */
export const tmp = (prefix: string, ...contents: FSNode[]) => reflect(
  `temporary ${prefix}`,
  async function inTemporaryDirectory (fs: FS = FS()) {
    const temp = await mkdtemp(resolvePath(tmpdir(), `fadroma`, `${prefix}-`));
    fs.paths[temp] ??= {};
    const cwd = fs.cwd;
    fs.cwd = temp;
    const result = await Promise.all(contents.map((x: FSNode)=>x&&x({ ...fs, cwd: temp })));
    fs.cwd = cwd;
    return result
  }, { prefix, contents });

/** Specify a directory. */
export const dir = (path: string, ...contents: FSNode[]) => reflect(
  `mkdir ${path}`,
  async function makeDirectory (fs: FS = FS()) {
    const location = resolvePath(fs.cwd, path);
    await mkdir(location, { recursive: true });
    (fs.paths ||= {})[location] = { directory: true };
    return await Promise.all(contents.map((x: FSNode)=>x({ ...fs, cwd: location })));
  }, { path, contents });

/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => reflect(
  `data at ${path}`,
  async function writeBinaryData (fs: FS = FS()) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const location = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(pipe(...steps)(value||''))||'';
    await writeFile(location, data as Bytes);
    fs.paths[location] = { file: true };
    return data;
  }, { path, value, steps });

/** Specify a text file. */
export const text = <T = string|number|object|null> (
  path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>
) => {
  const toStep = step=>(typeof step === 'string')?((x: string) => x + step):step;
  const build = pipe(...steps.map(toStep));
  return reflect(`text at ${path}`, async function writeText (fs: FS = FS()) {
    const full = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(build(value || '')) as string;
    await writeFile(full, data, 'utf8');
    fs.paths[full] = { file: true };
    return data;
  }, { path, value, steps });
};
