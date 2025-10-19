import type { Readme, FSContext, FSOp, Bytes, Step } from './types.ts';
import { pipe, writeFile, joinPath, mkdir } from './deps.ts';

/** Point-free NOP. */
export const identity = <T>(x: T): T => x;

/** Specify a condition. */
export const when = (condition: boolean, ...fns: Step<unknown>[]) =>
  Object.assign(function when <T> (context: T) {
    return (condition ? pipe(...fns) : identity)(context)
  }, { condition, fns });

/** Specify a temporary directory. */
export const tmpdir = () => { throw new Error("TODO") };

/** Specify a directory. */
export const dir = (
  path: string, ...contents: FSOp[]
) => Object.assign(async function makeDirectory (cwd: FSContext) {
  const location = joinPath(cwd, path);
  await mkdir(location, { recursive: true });
  return await Promise.all(contents.map((x: FSOp)=>x(location)));
}, { path });

/** Specify a binary data file. */
export const data = (
  path: string, value?: number|Bytes, ...steps: Step<Bytes>[]
) => Object.assign(async function writeBinaryData (cwd: FSContext) {
  value = (typeof value === 'number') ? new Uint8Array(value) : value
  const data = await Promise.resolve(pipe(...steps)(value)) as Bytes;
  await writeFile(joinPath(cwd, path), data);
  return data;
}, { path, value, steps });

/** Specify a text file. */
export const text = (
  path: string, value?: string|string[], ...steps: Array<(_:unknown)=>unknown>
) => Object.assign(async function writeText (cwd: FSContext) {
  const data = await Promise.resolve(pipe(...steps)(value || '')) as string;
  await writeFile(joinPath(cwd, path), data, 'utf8');
  return data;
}, { path, value, steps });

/** Specify a JSON file. */
export const json     = <T>(path: string, ...steps: Step<T>[]) => text(path,
  ...steps, (x: unknown) => JSON.stringify(x));

/** Specify a Markdown file. */
export const markdown = <T>(path: string, ...steps: Step<T>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a YAML file. */
export const yaml = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a TOML file. */
export const toml = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a Rust file. */
export const rust = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a JS file. */
export const js = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

/** Specify a TS file. */
export const ts = (path: string, ...steps: Step<unknown>[]) => text(path,
  ...steps, (_: unknown) => { throw new Error('unimplemented') });

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

export * from './types.ts';
