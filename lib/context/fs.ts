import type { Async, Fn, Bytes, Step } from '../index.ts';
import { Base16, Pipe, Name, chunked } from '../format.ts';
import { joinPath, tmpdir, zipSync, mkdir, rm, mkdtemp, writeFile,
  resolvePath, cwd } from '../deps.ts';
import { Log } from './log.ts';
/** A directory, with optional implementations of methods for writing to it. */
export type Dir = {
  path:       string,
  tree?:      Record<string, unknown>,
  mkdir?:     (_: string) => Promise<unknown>,
  mkdtemp?:   (_?: string) => Promise<unknown>,
  rimraf?:    (_?: string) => Promise<unknown>,
  writeFile?: (_: string, __: string|Bytes, enc?: 'utf8') => Promise<unknown>,
};
export namespace Dir {
  /** A function that created an entry in a directory. */
  export type Entry<D extends Dir = Dir, U extends unknown[] = unknown[]> =
    Fn<[D, ...U], Async<D>>;
}
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
export const Dir: {
  /** Specify contents of directory.. */
  <D extends Dir> (...entries: Dir.Entry<D>[]):
    Dir.Entry<D>;
  /** Specify contents of subdirectory. */
  <D extends Dir> (subpath: string, ...entries: Dir.Entry<D>[]):
    Dir.Entry<D>;
} = function Dir <D extends Dir> (...opts: unknown[]): Dir.Entry<D> {
  let path = '';
  while (typeof opts[0] === 'string') path = joinPath(path, opts.shift() as string);
  const entries = opts as Dir.Entry<D>[];
  const props = { path, entries };
  return Name(`Dir(${path})`, makeDirectory, props) as Dir.Entry<D>;
  async function makeDirectory (dir: string|D = '', ...args: unknown[]): Promise<D> {
    dir = LocalFS(dir, path);
    await dir.mkdir(path);
    const result = await Pipe(...entries)(dir, ...args) as D;
    return result;
  }
}
/** Specify a temporary directory, optionally running some ops in it.
  *
  * If no ops are passed this returns the created dir;
  * if ops are passed, runs them piped then deletes the dir. */
export function Temp <D extends Dir> (
  prefix: string = '', ...ops: Dir.Entry<D>[]
): Dir.Entry<D> {
  const props = { prefix, ops };
  return Name(`Temp(${prefix})`, inTemporaryDirectory, props);
  async function inTemporaryDirectory (dir: string|D, ...context: unknown[]): Promise<D> {
    const path = joinPath(tmpdir(), 'fadroma', `${prefix}-${Base16.random(8)}`);
    dir = LocalFS(dir)
    dir = await LocalFS(dir).mkdir(path) as D;
    const result = await Pipe(...ops as Dir.Entry<D>[])(dir, context) as D;
    if (ops.length > 0) await dir.rimraf();
    return result;
  }
}
/** Create temporary directory. */
Temp.make = async function tempMake (prefix: string = '') {
  return (await Temp(prefix)()).path
}
/** Specify a text file. */
export function Txt <T = string|number|object|null> (
  path: string, value?: T|T[], ...steps: Array<T|Step<T>>
): Dir.Entry {
  return Name(`Txt(${path})`, writeTxtFile, { path, value, steps });
  async function writeTxtFile <D extends Dir> (dir: string|D) {
    dir = LocalFS(dir);
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    await dir.writeFile(full, dir.tree[full] = data as string, 'utf8');
    return dir;
  }
}
/** Define text file format. */
export const textFormat =
  <T = string|number|object|null> (format: Fn.Returns<string>) =>
    (path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>) =>
      Txt(path, value, ...steps, format as (_:T)=>Async<T>);
/** Specify a binary data file. */
export function Bin (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
): Dir.Entry {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  return Name(`Bin(${path})`, writeBinFile, { path, value, steps });
  async function writeBinFile (dir: Dir) {
    dir = LocalFS(dir);
    const full = joinPath(dir.path, path);
    const data = await Pipe(...steps as Fn[])(value||'') || '';
    await dir.writeFile(full, dir.tree[full] = data as Bytes);
    return dir;
  }
}
/** Specify a ZIP archive. */
export function Zip <D extends Dir> (name: string, ...entries: Dir.Entry<D>[]) {
  return Name(`Zip(${entries.length})`, writeZipFile, { entries })
  async function writeZipFile (dir?: D, ...args: unknown[]) {
    const context = ZippedFS(dir);
    for (const entry of entries) await entry(context, ...args);
    const data = zipSync(context.tree as any);
    if (dir) await dir.writeFile(joinPath(dir.path, name), data);
    Log().log('Wrote', name)
    return Object.assign(data, { name, tree: context.tree });
  }
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

  dir.path ||= path;
  dir.tree ||= {};
  dir.tree[dir.path] = {};

  const opts = { recursive: true };
  dir.mkdir ??= async (sub: string) => {
    const path = resolvePath(cwd(), sub);
    await mkdir(path, opts)
    return LocalFS(dir, path);
  };
  dir.rimraf ??= async (sub: string) => rm(joinPath(...[dir.path, sub].filter(Boolean)), opts);
  dir.mkdtemp ??= async (p) => mkdtemp(p);
  dir.writeFile ??= async (p, q, r) => writeFile(p, q, r);

  return dir
};
/** Define a Markdown file. */
export const Markdown = (name: string, ...args: (string|unknown)[]): Dir.Entry =>
  Txt(name, chunked('\n\n')(...args));
/** An application project. */
export type Project = Name & Rust & ECMAScript & {
  gitignore?: string[]|boolean,
  dotenv?: string|boolean,
  direnv?: string|boolean,
  readme?: string|boolean,
};
/** Define a project. */
export const Project = (name: string, ...ops: Dir.Entry[]) =>
  Name(name, Dir(name, Readme(name, `Generated by @hackbg/fadroma.`), ...ops));
/** Define the project's README. */
export const Readme = (title: string, ...sections: string[]) =>
  Markdown('README.md', chunked('\n\n')(`# ${title}`, ...sections));
/** Define the project's Git ignorelist. */
export const gitignore = (...lines: string[]) => Txt('.gitignore', ...lines);
/** Define JSON file. */
export const Json = textFormat((x: unknown) => JSON.stringify(x));
/** Define YAML file. */
export const Yaml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define TOML file. */
export const Toml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define Rust file. */
export const Rust = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Rust environment. */
export interface Rust {
  rust?:      boolean,
  bacon?:     boolean,
  mold?:      boolean,
  workspace?: boolean,
};
/** Cargo package manifest. */
export namespace Rust {
  /** Cargo crate. */
  export type Crate = Versioned & {
    name: string, deps: CrateDep[], devDeps: CrateDep[], features: CrateFeature[]
  };
  /** Cargo dependency. */
  export type CrateDep = Versioned & {
    name: string, features: CrateFeature[]
  };
  /** Cargo feature. */
  export type CrateFeature = {
    name: string, features: string[]
  };
};
/** Add Mold to a project. */
export const Mold = Dir('.cargo', Toml('config.toml'));
/** Add Bacon to a project. */
export const Bacon = ({ watch = [ "programs/*" ], jobs = [] }) => Toml('bacon.toml', {
  "default_job": jobs[0][0],
  "env.CARGO_TERM_COLOR": "always",
  "keybindings": Object.fromEntries(jobs.map(([name, key, _])=>[key, name])),
  jobs: {},
  ...Object.fromEntries(jobs.map(([name, _, command])=>[name, {
    need_stdout: false,
    command,
    watch,
  }]))
});
/** JS/TS environment. */
export interface ECMAScript {
  js?:     boolean,
  esm?:    boolean,
  ts?:     boolean,
  node?:   boolean,
  deno?:   boolean,
  pnpm?:   boolean,
  eslint?: boolean
};
/** Define JavaScript file. */
export const Js = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define TypeScript file. */
export const Ts = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define NPM package manifest. */
export const PackageJson = ({
  name,
  path             = 'package.json',
  version          = '0.0.0',
  isPrivate        = true,
  legacy           = false,
  scripts          = [],
  dependencies     = [],
  devDependencies  = [],
  peerDependencies = [],
  main             = undefined,
  exports          = undefined,
}) => Json(path, ()=>({
  name,
  type: legacy ? "script" : "module",
  main,
  version,
  "private": isPrivate,
  exports,
  scripts:          Object.fromEntries(scripts.filter(Boolean)),
  dependencies:     Object.fromEntries(dependencies.filter(Boolean)),
  devDependencies:  Object.fromEntries(devDependencies.filter(Boolean)),
  peerDependencies: Object.fromEntries(peerDependencies.filter(Boolean)),
}))
export const tsConfig     = Json('tsconfig.json');
export const eslintConfig = Js('eslint.config.js');
/** Semantic version. */
export type Semver = string;
/** Versioned component. */
export type Versioned<V = Semver> = {
  /* The version. */ version: V
};
