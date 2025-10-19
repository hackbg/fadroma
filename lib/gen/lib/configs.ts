import type { Readme } from '../types.ts';
import { dir, text, markdown, json, js, toml } from './formats.ts';

export const gitignore =
  (...lines: string[]) => text('.gitignore', ...lines);

export const readme =
  ({ title }: Readme) => markdown('README.md', { [String(title)]: {} });

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

export const tsConfig = json('tsconfig.json');

export const eslintConfig = js('eslint.config.js');

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
