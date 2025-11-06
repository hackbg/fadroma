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
export function FS <T extends FS> ({
  cwd = getCwd(), paths = {}, ...rest
}: Partial<T> = {}): T {
  return { cwd, paths, ...rest } as T
}

/** A filesystem operation. Needs current working directory. */
export type FSNode = (_: FS) => FS;

/** Specify a temporary directory. */
export const Temp = (prefix: string, ...contents: FSNode[]) => reflect(
  `FS(Temp(${prefix}))`,
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
export const Dir = (path: string, ...contents: FSNode[]) => reflect(
  `FS(Dir(${path}))`,
  async function makeDirectory (fs: FS = FS()) {
    const location = resolvePath(fs.cwd, path);
    await mkdir(location, { recursive: true });
    (fs.paths ||= {})[location] = { directory: true };
    const results = [];
    for (let index = 0; index < contents.length; index++) {
      if (!contents[index]) continue;
      results[index] = await contents[index]({ ...fs, cwd: location });
    }
    return results
  }, { path, contents });

/** Specify a binary data file. */
export const Bin = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => reflect(
  `FS(Bin(${path}))`,
  async function writeBinaryData (fs: FS = FS()) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const location = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(pipe(...steps)(value||''))||'';
    await writeFile(location, data as Bytes);
    fs.paths[location] = { file: true };
    return data;
  }, { path, value, steps });

/** Specify a text file. */
export const Text = <T = string|number|object|null> (
  path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>
) => {
  const toStep = step =>
    (typeof step === 'string') ? ((x: string) => x + step) : step;
  const build = pipe(...steps.map(toStep));
  return reflect(`FS(Text(${path}))`, async function writeText (fs: FS = FS()) {
    const full = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(build(value || '')) as string;
    await writeFile(full, data, 'utf8');
    fs.paths[full] = { file: true };
    return data;
  }, { path, value, steps });
};
