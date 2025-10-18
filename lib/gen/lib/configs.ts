import { dir, file, text, markdown, json, js, ts, toml } from './formats.ts';

export const gitignore =
  (...lines) => text(gitignore, lines);

export const readme =
  ({ name }) => markdown('README.md', { [name]: {} });

export const packageJson = ({
  name,
  version          = '0.0.0',
  private          = true,
  legacy           = false,
  scripts          = [],
  dependencies     = [],
  devDependencies  = [],
  peerDependencies = [],
  exports          = null,
  path             = 'package.json',
} = {}) => json({ path }, {
  name,
  version,
  private,
  type:             legacy ? "script" : "module",
  scripts:          Object.fromEntries(scripts.filter(Boolean)),
  dependencies:     Object.fromEntries(dependencies.filter(Boolean)),
  devDependencies:  Object.fromEntries(devDependencies.filter(Boolean)),
  peerDependencies: Object.fromEntries(peerDependencies.filter(Boolean)),
})

export const tsConfig =
  json('tsconfig.json'))

export const eslintConfig =
  js('eslint.config.js'))

export const moldConfig =
  dir('.cargo', toml('config.toml'));

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
