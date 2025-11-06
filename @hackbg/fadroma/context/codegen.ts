import type { Returns, Async, Step } from '../index.ts';
import { Dir, Text } from './fs.ts';
/** A Git repository. */
export type Project = Rust & ECMAScript & {
  gitignore?: string[], readme?: boolean|Readme, dotenv?: boolean, direnv?: boolean };
/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };
/** Define the project's Git ignorelist. */
export const gitignore = (...lines: string[]) => Text('.gitignore', ...lines);
/** A README document. */
export type Readme = { title?: string, sections?: [string, string] };
/** Define the project's README. */
export const readme = ({ title }: Readme) =>
  Md('README.md', `# ${title}`);
/** Define text file format. */
export const textFormat = <T = string|number|object|null>
  (format: Returns<string>) =>
    (path: string, value?: T|T[]|Step<T>, ...steps: Array<T|Step<T>>) =>
      Text(path, value, ...steps, format as (_:T)=>Async<T>);
/** Define JSON file. */
export const Json = textFormat((x: unknown) => JSON.stringify(x));
/** Define Md file. */
export const Md = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define YAML file. */
export const Yaml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define TOML file. */
export const Toml = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Define Rust file. */
export const Rust = textFormat((_: unknown) => { throw new Error('unimplemented') });
/** Rust tools config. */
export type Rust = { rust?: boolean, bacon?: boolean, mold?: boolean, workspace?: boolean };
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
/** Cargo package manifest */
export type Crate = Versioned & {
  name: string, deps: CrateDep[], devDeps: CrateDep[], features: CrateFeature[] };
/** Cargo dependency */
export type CrateDep = Versioned & { name: string, features: CrateFeature[] };
/** Cargo feature */
export type CrateFeature = { name: string, features: string[] };
/** Define JavaScript file. */
export const Js = textFormat((_: unknown) => {
  throw new Error('unimplemented') });
/** Define TypeScript file. */
export const Ts = textFormat((_: unknown) => {
  throw new Error('unimplemented') });
/** JS/TS config. */
export type ECMAScript =
  { js?: boolean, esm?: boolean, ts?: boolean, node?: boolean, deno?: boolean
  , pnpm?: boolean, eslint?: boolean };
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
