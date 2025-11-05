import type { Fn, Returns, Async, Bytes, Step } from '../index.ts';
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
export const fsContext = ({
  cwd = getCwd(), paths = {}, ...rest
} = {}) => ({ cwd, paths, ...rest });
/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };
export type Project = {
  gitignore?: string[],
  readme?: boolean|Readme,
  dotenv?: boolean,
  direnv?: boolean
} & Rust & ECMAScript;
/** A filesystem operation. Needs current working directory. */
export type FSItem = (_: FS) => FS;
/** Define the project's Git ignorelist. */
export const gitignore = (...lines: string[]) => text('.gitignore', ...lines);
/** A README document. */
export type Readme = { title?: string, sections?: [string, string] };
/** Define the project's README. */
export const readme = ({ title }: Readme) =>
  markdown('README.md', `# ${title}`);
/** Specify a temporary directory. */
export const tmp = (
  prefix: string, ...contents: FSItem[]
) => reflect(
  `temporary ${prefix}`,
  async function inTemporaryDirectory (fs: FS = fsContext()) {
    const temp = await mkdtemp(resolvePath(tmpdir(), `fadroma`, `${prefix}-`));
    fs.paths[temp] ??= {};
    const cwd = fs.cwd;
    fs.cwd = temp;
    const result = await Promise.all(contents.map((x: FSItem)=>x&&x({ ...fs, cwd: temp })));
    fs.cwd = cwd;
    return result
  }, { prefix, contents });
/** Specify a directory. */
export const dir = (
  path: string, ...contents: FSItem[]
) => reflect(
  `mkdir ${path}`,
  async function makeDirectory (fs: FS = fsContext()) {
    const location = resolvePath(fs.cwd, path);
    await mkdir(location, { recursive: true });
    (fs.paths ||= {})[location] = { directory: true };
    return await Promise.all(contents.map((x: FSItem)=>x({ ...fs, cwd: location })));
  }, { path, contents });
/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => reflect(
  `data at ${path}`,
  async function writeBinaryData (fs: FS = fsContext()) {
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
  return reflect(`text at ${path}`, async function writeText (fs: FS = fsContext()) {
    const full = resolvePath(fs.cwd, path);
    const data = await Promise.resolve(build(value || '')) as string;
    await writeFile(full, data, 'utf8');
    fs.paths[full] = { file: true };
    return data;
  }, { path, value, steps });
};
/** Specify a text file format. */
export const textFormat = <T = string|number|object|null>
  (format: Returns<string>) =>
    (path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>) =>
      text(path, value, ...steps, format as (_:T)=>Async<T>);
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
/** Rust tools config. */
export type Rust =
  { rust?:      boolean
  , bacon?:     boolean
  , mold?:      boolean
  , workspace?: boolean };
/** Add Mold to a project. */
export const moldConfig = dir('.cargo',
  toml('config.toml'));
/** Add Bacon to a project. */
export const baconConfig = ({
  watch = [ "programs/*" ], jobs = []
}) => toml('bacon.toml', {
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
/** Cargo package manifest */
export type Crate =
  { name:     string
  , version:  string
  , deps:     CrateDep[]
  , devDeps:  CrateDep[]
  , features: CrateFeature[] };
/** Cargo dependency */
export type CrateDep =
  { name:     string
  , version:  string
  , features: CrateFeature[] };
/** Cargo feature */
export type CrateFeature =
  { name:     string
  , features: string[] };
/** Specify a JS file. */
export const js = textFormat((_: unknown) => {
  throw new Error('unimplemented') });
/** Specify a TS file. */
export const ts = textFormat((_: unknown) => {
  throw new Error('unimplemented') });
/** JS/TS config. */
export type ECMAScript =
  { js?:     boolean
  , esm?:    boolean
  , ts?:     boolean
  , node?:   boolean
  , deno?:   boolean
  , pnpm?:   boolean
  , eslint?: boolean };
/** Specify a NPM package manifest. */
export const packageJson = ({
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
}) => json(path, ()=>({
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
export const tsConfig = json('tsconfig.json');
export const eslintConfig = js('eslint.config.js');
