import { readFileSync } from 'fs';

export const loadSchemas = (base, schemas = {}) => Object.entries(schemas).reduce((output, [name, path]) => Object.assign(output, {
  [name]: loadJSON(path, base),
}), {});

export const loadJSON = (path, base) => JSON.parse(
  base ? readFileSync(new URL(path, base))
    : readFileSync(path),
);
