import type { Fn, Bytes, Step, Async } from '../index.ts';
import { tmpdir, mkdtemp, writeFile, joinPath, resolvePath, relativePath, mkdir, getCwd } from '../deps.ts';
import { Pipe, Named } from '../format/function.ts';

/** Specify a directory.
  *
  * Form 1: synchronous.
  *   - When called with no arguments, returns `{ cwd }`.
  *
  * Example:
  *     const { cwd } = Dir();
  *
  * Form 2: returns async function.
  *   - When called with string, returns async function that creates that path.
  *   - When called with string and one or more steps, the returned function
  *     also runs the steps sequentially to populate the created directory.
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
export function Dir (): Dir
export function Dir <D extends Dir> (..._: (string|DirEntry<D>)[]): Fn<[D], Async<D>>;
export function Dir <D extends Dir> (...args: unknown[]): unknown {
  // Synchronous form.
  if (args.length === 0) return { path: getCwd() };
  // Build relative path.
  let path = '';
  while (typeof args[0] === 'string') path = joinPath(path, args.shift() as string);
  // Return function that creates and populates it.
  const props = { directory: true, path, contents: args };
  return Named(`Dir(${path}))`, makeDirectory, props) as DirEntry<D>;
  async function makeDirectory (dir: D = Dir() as D, ...context: unknown[]): Promise<D> {
    dir.paths ??= {};
    path = resolvePath(dir.path, path);
    dir.paths[relativePath(dir.path, path)] = props;
    await mkdir(path, { recursive: true });
    dir.path = path;
    await runInDir(path, args as DirEntry<D>[], dir, context);
    return dir;
  }
}

/** A directory. */
export type Dir = { path: string, paths?: Record<string, unknown> };
/** A filesystem operation. Needs current working directory. */
export type DirEntry<T extends Dir = Dir, U extends unknown[] = unknown[]> =
  Fn<[T, ...U], Async<T>>;

async function runInDir (path: string, ops: DirEntry[], dir: Dir, ...rest: unknown[]) {
  const results = [];
  for (let index = 0; index < ops.length; index++) {
    if (!ops[index]) continue;
    results[index] = await ops[index]({ ...dir, path }, ...rest);
  }
  return results
}

/** Specify a temporary directory. */
export function Temp <D extends Dir> (prefix: string, ...ops: DirEntry<D>[]) {
  const props = { directory: true, prefix, ops };
  const fn = Named(`Temp(${prefix})`, inTemporaryDirectory, props);
  return fn;
  async function inTemporaryDirectory (dir: Dir = Dir(), ...context: unknown[]) {
    const temp = await mkdtemp(resolvePath(tmpdir(), `fadroma`, `${prefix}-`));
    const cwd = dir.path;
    dir.paths ??= {};
    dir.paths[temp] = fn;
    dir.path = temp;
    await runInDir(cwd, ops, dir, ...context);
    return dir;
  }
}

/** Specify a binary data file. */
export function Bin (path: string, value?: number|Bytes, ...steps: Step<Bytes>[]) {
  return Named(`Bin(${path})`, async function writeBinaryData (dir: Dir = Dir()) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const location = resolvePath(dir.path, path);
    const data = await Promise.resolve(Pipe(...steps)(value||''))||'';
    await writeFile(location, data as Bytes);
    dir.paths ??= {};
    dir.paths[location] = data;
    return dir;
  }, { path, value, steps });
}

/** Specify a text file. */
export function Text <T = string|number|object|null> (
  path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>
): DirEntry {
  return Named(`Text(${path})`, async function writeText (dir: Dir = Dir()) {
    const full = resolvePath(dir.path, path);
    const build = Pipe(...steps.map(toStep) as Step<T>[]);
    const data = await Promise.resolve(build(value || '')) as string;
    await writeFile(full, data, 'utf8');
    dir.paths ??= {};
    dir.paths[full] = data;
    return dir;
  }, { path, value, steps });
}

const toStep = <T>(step: T|Step<T>) =>
  (typeof step === 'string') ? ((x: string) => x + step) : step;
