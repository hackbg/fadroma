import { pipe, writeFile, joinPath, mkdir } from '../deps.ts';
/** Point-free NOP. */
export const identity = <T>(x: T): T => x;
/** Specify a condition. */
export const when = (condition: boolean, ...fns: Array<(_:unknown)=>unknown>) =>
  Object.assign(function when <T> (context: T) {
    return (condition ? pipe(...fns) : identity)(context)
  }, { condition, fns });
/** Context for executing FS operations: path of current working directory. */
export type FSContext = string;
export type FSOp = (_: FSContext) => FSContext;
/** Specify a temporary directory. */
export const tmpdir = () => { throw new Error("TODO") }
/** Specify a directory. */
export const dir = (path: string, ...contents: FSOp[]) =>
  (cwd: FSContext) => {
    const location = joinPath(cwd, path);
    return mkdir(location, { recursive: true })
      .then(()=>Promise.all(contents.map((x: FSOp)=>x(location))))
      .then(()=>cwd);
  }
/** Specify a binary data file. */
export const data = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  (cwd: FSContext) => Promise.resolve(pipe(...steps)(cwd))
    .then(data=>writeFile(joinPath(cwd, path), data))
    .then(()=>cwd);
/** Specify a text file. */
export const text = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  (cwd: FSContext) => Promise.resolve(pipe(...steps)(cwd))
    .then((data: string)=>writeFile(joinPath(cwd, path), data, 'utf8'))
    .then(()=>cwd);
/** Specify a JSON file. */
export const json = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (x: unknown) => JSON.stringify(x));
/** Specify a Markdown file. */
export const markdown = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
/** Specify a YAML file. */
export const yaml = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
/** Specify a TOML file. */
export const toml = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
/** Specify a Rust file. */
export const rust = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
/** Specify a JS file. */
export const js = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
/** Specify a TS file. */
export const ts = (path: string, ...steps: Array<(_:unknown)=>unknown>) =>
  text(path, ...steps, (_: unknown) => { throw new Error('unimplemented') });
