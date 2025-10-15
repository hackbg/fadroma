import { FS, Path } from './deps.ts';

export const when = (condition, ...fns) => Object.assign(function when (data) {
  return condition ? pipe(...fns)(data) : data
}, { condition, fns });

export type FSContext = {
  cwd: string
};

export const dir = ({ path }) =>
  (context: FSContext) => {
    context.cwd = Path.join(context.cwd, path);
    return context;
  }

export const file = ({ path, encoding = 'utf8' }, ...steps) =>
  (context: FSContext) => {
    const location = Path.join(context.cwd, path);
    const content  = pipe(...steps)(context);
    return FS.writeFile(location, content, encoding).then(context);
  }

export const json = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const markdown = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const yaml = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const toml = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const rust = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const js = ({ path }, ...steps) =>
  file({ path }, ...steps);

export const ts = ({ path }, ...steps) =>
  file({ path }, ...steps);

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
  exports          = null
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
