import { dir, toml } from '../service.ts';

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
  { name:     string
  , version:  string
  , deps:     CrateDep[]
  , devDeps:  CrateDep[]
  , features: CrateFeature[] };

export type CrateDep =
  { name:     string
  , version:  string
  , features: CrateFeature[] };

export type CrateFeature =
  { name:     string
  , features: string[] };
