import type { Fn, Bytes, Step, Async } from '../index.ts';
import { joinPath, resolvePath, getCwd, tmpdir, mkdtemp,
  writeFile, mkdir, rm } from '../deps.ts';
import { Pipe, Name } from '../format/function.ts';
/** A directory. */
export type Dir = {
  path:       string,
  paths?:     Record<string, unknown>,
  mkdir?:     typeof mkdir,
  mkdtemp?:   typeof mkdtemp,
  writeFile?: typeof writeFile,
  rimraf?:    Fn,
};
/** A filesystem operation. Needs current working directory. */
export type DirEntry<T extends Dir = Dir, U extends unknown[] = unknown[]> =
  Fn<[T, ...U]>;
/** Specify a directory.
  *
  * Form 1 (sync)
  *   - When called with no arguments, returns `{ cwd }`.
  *
  * Example:
  *     const { path } = Dir();
  *
  * Form 2 (deferred)
  *   - When called with string, returns async function that creates that path.
  *   - When called with string and one or more steps, the returned function
  *     also runs the steps sequentially to populate the created directory.
  *
  * Example:
  *     const makeEmptyDir = Dir('foo');
  *     await makeEmptyDir();
  *     // created "./foo/"
  *
  *     const makeDirWithFiles = Dir('foo', Txt('hello.txt', 'world'));
  *     await makeDirWithFiles({ cwd: '/path/to/somewhere/' });
  *     // created "/path/to/somewhere/foo/hello.txt" and wrote "world'
  **/
export function Dir (): Dir
export function Dir <D extends Dir> (..._: (string|DirEntry<D>)[]): Fn<[D], Async<D>>;
export function Dir <D extends Dir> (...opts: unknown[]): unknown {
  // Synchronous form.
  if (opts.length === 0) return { path: getCwd() };
  // Build relative path.
  let path = '';
  while (typeof opts[0] === 'string') path = joinPath(path, opts.shift() as string);
  // Return function that creates and populates it.
  const props = { path, contents: opts };
  return Name(`Dir(${path}))`, makeDirectory, props) as DirEntry<D>;
  async function makeDirectory (dir: string|D, ...args: unknown[]): Promise<D> {
    if (typeof dir !== 'object') dir = {} as D;
    dir       ??= {} as D;
    dir.path  ??= getCwd();
    dir.paths ??= {};
    dir.paths[resolvePath(dir.path)] = {};
    (dir.mkdir ??= mkdir)(path, { recursive: true });
    dir.path = path;
    return await Pipe(...args as DirEntry<D>[])(dir, args) as D;
    //await runInDir(path, args as DirEntry<D>[], dir, context);
    //return dir;
  }
}
/** Specify a temporary directory. */
export function Temp <D extends Dir> (prefix: string = '', ...ops: DirEntry<D>[]) {
  const props = { prefix, ops };
  const fn = Name(`Temp(${prefix})`, inTemporaryDirectory, props);
  return fn;
  async function inTemporaryDirectory (dir: D = Dir() as D, ...context: unknown[]): Promise<D> {
    dir.mkdtemp ??= mkdtemp;
    const path = await mkdtemp(resolvePath(tmpdir(), `fadroma`, `${prefix}-`));
    dir.paths ??= {};
    dir.paths[path] = fn;
    dir.path = path;
    dir.rimraf = () => rm(path, { recursive: true });
    const create = Pipe(...ops as DirEntry<D>[]);
    const result = await create(dir, context) as D;
    await dir.rimraf();
    return result;
  }
}
/** Specify a text file. */
export function Txt <T = string|number|object|null> (
  path: string, value?: T|T[], ...steps: Array<T|Step<T>>
): DirEntry {
  return Name(`Txt(${path})`, async function writeTxt (dir: Dir) {
    const full = resolvePath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    dir.paths ??= {};
    dir.paths[full] ??= null;
    dir.writeFile ??= writeFile;
    await dir.writeFile(full, data as string, 'utf8');
    dir.paths[full] = data;
    return dir;
  }, { path, value, steps });
}
/** Specify a binary data file. */
export function Bin (path: string, value?: number|Bytes, ...steps: Step<Bytes>[]) {
  return Name(`Bin(${path})`, async function writeBinaryData (dir: Dir = Dir()) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const full = resolvePath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    dir.paths ??= {};
    dir.paths[full] ??= null;
    dir.writeFile ??= writeFile;
    await dir.writeFile(full, data as Bytes);
    dir.paths[full] = data;
    return dir;
  }, { path, value, steps });
}
