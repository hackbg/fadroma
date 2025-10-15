import { writeFile, joinPath } from './deps.ts';

export const when = (condition, ...fns) => Object.assign(function when (data) {
  return condition ? pipe(...fns)(data) : data
}, { condition, fns });

export type FSContext = {
  cwd: string
};

export const dir = ({ path }) =>
  (context: FSContext) => {
    context.cwd = pathJoin(context.cwd, path);
    return context;
  }

export const tmpdir => { throw new Error("TODO") }

export const file = ({ path, encoding = 'utf8' }, ...steps) =>
  (context: FSContext) => {
    const location = pathJoin(context.cwd, path);
    const content  = pipe(...steps)(context);
    return writeFile(location, content, encoding).then(context);
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

