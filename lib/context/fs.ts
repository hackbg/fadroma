import type { Fn, Bytes, Step, Async } from '../index.ts';
import { joinPath, tmpdir, zipSync } from '../deps.ts';
import { realpathSync } from '../deps.ts';
import { mkdir, rm, mkdtemp, writeFile, resolvePath, cwd } from '../deps.ts';
import { Pipe, Name, chunked } from '../format.ts';
import { Log } from './log.ts';
/** A function that created an entry in a directory. */
export type DirEntry<D extends Dir = Dir, U extends unknown[] = unknown[]> =
  Fn<[D, ...U], Async<D>>;
/** A directory. */
export type Dir = {
  path:       string,
  tree?:      Record<string, unknown>,
  mkdir?:     (_: string) => Promise<unknown>,
  mkdtemp?:   (_?: string) => Promise<unknown>,
  rimraf?:    (_?: string) => Promise<unknown>,
  writeFile?: (_: string, __: string|Bytes, enc?: 'utf8') => Promise<unknown>,
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
  return Name(`Dir(${path})`, makeDirectory, props) as DirEntry<D>;
  async function makeDirectory (dir: string|D = '', ...args: unknown[]): Promise<D> {
    dir = LocalFS(dir, path);
    await dir.mkdir(path);
    const result = await Pipe(...entries)(dir, ...args) as D;
    return result;
  }
}
/** Specify a temporary directory. */
export function Temp <D extends Dir> (
  prefix: string = '', ...ops: DirEntry<D>[]
): DirEntry<D> {
  const props = { prefix, ops };
  return Name(`Temp(${prefix})`, inTemporaryDirectory, props);
  async function inTemporaryDirectory (dir: string|D, ...context: unknown[]): Promise<D> {
    dir = LocalFS(dir);
    dir = LocalFS(dir, await dir.mkdtemp(joinPath(tmpdir(), `fadroma`, `${prefix}-`)));
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
    dir = LocalFS(dir);
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    await dir.writeFile(full, dir.tree[full] = data as string, 'utf8');
    return dir;
  }, { path, value, steps });
}
/** Specify a binary data file. */
export function Bin (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
): DirEntry {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  return Name(`Bin(${path})`, async function writeBinFile (dir: Dir) {
    dir = LocalFS(dir);
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    await dir.writeFile(full, dir.tree[full] = data as Bytes);
    return dir;
  }, { path, value, steps });
}
/** Specify a ZIP archive. */
export function Zip <D extends Dir> (name: string, ...entries: DirEntry<D>[]) {
  return Name(`Zip(${entries.length})`, async function writeZipFile (
    dir: D, ...args: unknown[]
  ) {
    const context = ZippedFS(dir);
    for (const entry of entries) await entry(context, ...args);
    const data = zipSync(context.tree as any);
    if (dir) await dir.writeFile(joinPath(dir.path, name), data);
    Log().log('Wrote', name)
    return Object.assign(data, { name, tree: context.tree });
  }, { entries })
}
function ZippedFS <D extends Dir> (dir: string|D, tree = {}) {
  dir = LocalFS(dir);
  return {
    ...dir,
    mkdir: function zipMkdir (path: string) {
      tree[joinPath(dir.path, path)] ??= {};
    },
    mkdtemp: function zipMkdtemp (..._: unknown[]) {
      throw new Error('mkdtemp not supported in zip')
    },
    writeFile: function zipWrite (path: string, data: unknown) {
      tree[joinPath(dir.path, path)] ??= data;
    },
    rimraf: function zipRimraf (_: string) {
      throw new Error('rimraf in zip: not implemented')
    }
  }
}
function LocalFS <D extends Dir> (dir: string|D, path: string = ''): D {
  dir ??= {} as D;
  if (typeof dir !== 'object') dir = { path: joinPath(dir, path) } as D;

  dir.path ??= path;
  dir.tree ??= {};
  dir.tree[dir.path] = {};

  const opts = { recursive: true };
  dir.mkdir ??= async (sub: string) => mkdir(resolvePath(cwd(), sub), opts);
  dir.rimraf ??= async (sub: string) => rm(joinPath(...[dir.path, sub].filter(Boolean)), opts);
  dir.mkdtemp ??= async (p) => mkdtemp(p);
  dir.writeFile ??= async (p, q, r) => writeFile(p, q, r);

  return dir
};
/** Define a Markdown file. */
export const Markdown = (name: string, ...args: (string|unknown)[]): DirEntry =>
  Txt(name, chunked('\n\n')(...args));
