import type { Fn, Bytes, Step } from '../index.ts';
import { tmpdir, mkdtemp, writeFile, resolvePath, mkdir, getCwd } from '../deps.ts';
import { pipe, Named } from '../format/function.ts';

/** Define a filesystem context. */
export function FS <T extends FS> ({
  cwd = getCwd(), paths = {}, ...rest
}: Partial<T> = {}): T {
  return { cwd, paths, ...rest } as T
}
/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths?: Record<string, FSNode|unknown>
};
/** A filesystem operation. Needs current working directory. */
export type FSNode<T = unknown> = Fn<[FS, T?], FS>;

/** Specify a directory.
  *
  * Form 1: synchronous.
  *   - When called with no arguments, returns `{ cwd }`.
  *   - When called with one or more objects, returns `{ cwd, ...merged }`.
  *
  * Example:
  *     const { cwd } = Dir();
  *     const { cwd, foo } = Dir({ foo: true });
  *
  * Form 2: returns async function.
  *   - When called with string, returns function that creates that path
  *     if it does not exist.
  *   - When called with string and one or more steps, the returned function
  *     will runs those steps sequentially the created directory.
  *
  * Example:
  *     const makeEmptyDir = Dir('foo');
  *     await makeEmptyDir();
  *     // created "./foo/"
  *
  *     const makeDirWithFiles = Dir('foo', Text('hello.txt', 'world'));
  *     await makeDirWithFiles({ cwd: '/path/to/somewhere/' });
  *     // created "/path/to/somewhere/foo/hello.txt" and wrote "world'
  *     */
export function Dir (): FS;
export function Dir <T> (path: string, ...ops: FSNode<T>[]): FSNode<T>;
export function Dir <T> (...args: unknown[]): FS|FSNode<T> {
  if (args.length === 0) return { cwd: getCwd() } as FS;
  const [path, ...ops] = args as [string, ...FSNode<T>[]];
  const props = { directory: true, path, ops };
  const fn = Named(`FS(Dir(${path}))`, makeDirectory, props);
  return fn as FSNode<T>;
  async function makeDirectory (fs: FS = FS(), context: T) {
    fs.paths ??= {};
    const cwd = resolvePath(fs.cwd, path);
    fs.paths[cwd] = fn;
    await mkdir(cwd, { recursive: true });
    fs.cwd = cwd;
    await runInDir(cwd, ops, fs, context);
    return fs;
  }
}

const runInDir = async (cwd, ops, fs, ...rest) => {
  const results = [];
  for (let index = 0; index < ops.length; index++) {
    if (!ops[index]) continue;
    results[index] = await ops[index]({ ...fs, cwd }, ...rest);
  }
  return results
}

/** Specify a temporary directory. */
export function Temp <T> (prefix: string, ...ops: FSNode<T>[]) {
  const props = { directory: true, prefix, ops };
  const fn = Named(`FS(Temp(${prefix}))`, inTemporaryDirectory, props);
  return fn;
  async function inTemporaryDirectory (fs: FS = FS(), context: T) {
    fs.paths ??= {};
    const temp = await mkdtemp(resolvePath(tmpdir(), `fadroma`, `${prefix}-`));
    fs.paths[temp] = fn;
    const cwd = fs.cwd;
    fs.cwd = temp;
    await runInDir(cwd, ops, fs, context);
    return fs;
  }
}

/** Specify a binary data file. */
export function Bin (path: string, value?: number|Bytes, ...steps: Step<Bytes>[]) {
  return Named(`FS(Bin(${path}))`, async function writeBinaryData (fs: FS = FS()) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const location = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(pipe(...steps)(value||''))||'';
    await writeFile(location, data as Bytes);
    fs.paths ??= {};
    fs.paths[location] = data;
    return fs;
  }, { path, value, steps });
}

/** Specify a text file. */
export function Text <T = string|number|object|null> (
  path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>
) {
  return Named(`FS(Text(${path}))`, async function writeText (fs: FS = FS()) {
    const full = resolvePath(fs.cwd, path);
    const build = pipe(...steps.map(toStep) as Step<T>[]);
    const data = await Promise.resolve(build(value || '')) as string;
    await writeFile(full, data, 'utf8');
    fs.paths ??= {};
    fs.paths[full] = data;
    return fs;
  }, { path, value, steps });
}

const toStep = <T>(step: T|Step<T>) =>
  (typeof step === 'string') ? ((x: string) => x + step) : step;
