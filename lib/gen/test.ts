import { dir, file, json } from './index.ts';
import { main, expect, todo } from '../tester/index.ts';
export default main('Generator',
  expect('Directory',       todo),
  expect('Text file',       todo,
    expect('.gitignore',    todo)),
  expect('JSON',            todo,
    expect('package.json',  todo),
    expect('tsconfig.json', todo)),
  expect('TOML',
    expect('bacon.toml',    todo),
    expect('for mold',      todo)),
  expect('Markdown',        todo,
    expect('README',        todo)),
  expect('JS/TS',           todo,
    expect('ESLint',        todo)));
