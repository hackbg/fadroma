import type { Fn, Bytes, Step, Async } from '../index.ts';
import { joinPath, tmpdir, mkdtemp, writeFile, mkdir, rm, zipSync } from '../deps.ts';
import { Pipe, Name } from '../format/function.ts';
import { Log } from './log.ts';
/** A function that created an entry in a directory. */
export type DirEntry<D extends Dir = Dir, U extends unknown[] = unknown[]> =
  Fn<[D, ...U], Async<D>>;
/** A directory. */
export type Dir = {
  path:       string,
  tree?:      Record<string, unknown>,
  mkdir?:     typeof mkdir,
  mkdtemp?:   typeof mkdtemp,
  writeFile?: typeof writeFile,
  rimraf?:    Fn,
};
/** Specify a directory.
  *
  * Takes an optional subpath, then one or more callbacks.
  *
  * Returns function which creates directory at specified subpath,
  * then pipes it through the callbacks.
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
export function Dir <D extends Dir> (...entries: DirEntry<D>[]):
  DirEntry<D>;
export function Dir <D extends Dir> (subpath: string, ...entries: DirEntry<D>[]):
  DirEntry<D>;
export function Dir <D extends Dir> (...opts: unknown[]):
  DirEntry<D>
{
  let path = '';
  while (typeof opts[0] === 'string') path = joinPath(path, opts.shift() as string);
  const entries = opts as DirEntry<D>[];
  const props = { path, entries };
  return Name(`Dir(${path}))`, makeDirectory, props) as DirEntry<D>;
  async function makeDirectory (dir: string|D = '', ...args: unknown[]): Promise<D> {
    dir = dirContext(dir, path);
    await dir.mkdir(path, { recursive: true });
    const result = await Pipe(...entries)(dir, ...args) as D;
    return result;
  }
}
function dirContext <D extends Dir>(dir: string|D, path: string = ''): D {
  dir ??= {} as D;
  if (typeof dir !== 'object') dir = { path: joinPath(dir, path) } as D;
  dir.path ??= path;
  dir.tree ??= {};
  dir.tree[dir.path] = {};

  dir.mkdir     ??= mkdir;
  dir.writeFile ??= writeFile;
  dir.mkdtemp   ??= mkdtemp;
  dir.rimraf    ??= (sub: string) => rm(
    joinPath(...[dir.path, sub].filter(Boolean)),
    { recursive: true }
  );
  return dir
};
/** Specify a ZIP archive. */
export function Zip <D extends Dir> (name: string, ...entries: DirEntry<D>[]) {
  return Name(`Zip(${entries.length})`, async function writeZipFile (dir?: D, ...args: unknown[]) {
    const context = zipContext();
    for (const entry of entries) await entry(context, ...args);
    const data = zipSync(context.tree);
    if (dir) await dir.writeFile(joinPath(dir.path, name), data);
    Log().log('Wrote', name)
    return Object.assign(data, { name, tree: context.tree });
  }, { entries })
}
function zipContext (tree = {}) {
  return {
    tree,
    mkdir: function zipMkdir (path: string) {
      tree[path] ??= {};
    },
    mkdtemp: function zipMkdtemp (..._: unknown[]) {
      throw new Error('mkdtemp not supported in zip')
    },
    writeFile: function zipWrite (path: string, data: unknown) {
      tree[path] ??= data;
    },
    rimraf: function zipRimraf (_: string) {
      throw new Error('rimraf in zip: not implemented')
    }
  }
}
/** Specify a temporary directory. */
export function Temp <D extends Dir> (prefix: string = '', ...ops: DirEntry<D>[]) {
  const props = { prefix, ops };
  const fn = Name(`Temp(${prefix})`, inTemporaryDirectory, props);
  return fn;
  async function inTemporaryDirectory (dir: string|D, ...context: unknown[]): Promise<D> {
    dir = dirContext(dir);
    const path = await mkdtemp(joinPath(tmpdir(), `fadroma`, `${prefix}-`));
    dir.tree[path] = fn;
    const result = await Pipe(...ops as DirEntry<D>[])(dir, context) as D;
    await dir.rimraf();
    return result;
  }
}
/** Specify a text file. */
export function Txt <T = string|number|object|null> (
  path: string, value?: T|T[], ...steps: Array<T|Step<T>>
): DirEntry {
  return Name(`Txt(${path})`, async function writeTxtFile <D extends Dir> (dir: string|D) {
    dir = dirContext(dir);
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    dir.tree ??= {};
    dir.tree[full] ??= null;
    dir.writeFile ??= writeFile;
    await dir.writeFile(full, data as string, 'utf8');
    dir.tree[full] = data;
    return dir;
  }, { path, value, steps });
}
/** Specify a binary data file. */
export function Bin (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
): DirEntry {
  return Name(`Bin(${path})`, async function writeBinFile (dir: Dir) {
    value = (typeof value === 'number') ? new Uint8Array(value) : value
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    dir.tree ??= {};
    dir.tree[full] ??= null;
    dir.writeFile ??= writeFile;
    await dir.writeFile(full, data as Bytes);
    dir.tree[full] = data;
    return dir;
  }, { path, value, steps });
}
