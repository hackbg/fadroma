import { dir, text, markdown, json, js, toml } from './fs.ts';
/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };

export type Project =
  { gitignore?: string[]
  , readme?: boolean|Readme
  , dotenv?: boolean
  , direnv?: boolean } & Rust & ECMAScript;

export const gitignore = (...lines: string[]) =>
  text('.gitignore', ...lines);

export type Readme = { title?: string, sections?: [string, string] };
export const readme = ({ title }: Readme) =>
  markdown('README.md', { [String(title)]: {} });

export type Rust =
  { rust?:      boolean
  , bacon?:     boolean
  , mold?:      boolean
  , workspace?: boolean };

export const moldConfig = dir('.cargo', toml('config.toml'));

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

export type Crate =
  { name?:     string
  , version?:  string
  , deps?:     CrateDep[]
  , devDeps?:  CrateDep[]
  , features?: CrateFeature[] };

export type CrateDep = {};

export type CrateFeature = {};

export type ECMAScript =
  { js?:     boolean
  , esm?:    boolean
  , ts?:     boolean
  , node?:   boolean
  , deno?:   boolean
  , pnpm?:   boolean
  , eslint?: boolean };
export const tsConfig = json('tsconfig.json');
export const eslintConfig = js('eslint.config.js');
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
}) => json(path, {
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
})
