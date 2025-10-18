#!/usr/bin/env -S deno run --allow-env
import { suite, expect, todo } from './index.ts';
import { entrypoint } from './deps.ts';
export default entrypoint(import.meta, suite('Tester',
  expect('Reporting',
    expect('Categories', todo()),
    expect('Result set', todo(),
      expect('Step counter', todo()))),
  expect('Execution',
    expect('Suite',  todo()),
    expect('Expect', todo()),
    expect('Forbid', todo()),
    expect('Matrix', todo()))));
