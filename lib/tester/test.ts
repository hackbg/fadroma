#!/usr/bin/env -S deno run --allow-env
import { suite, expect, todo } from './index.ts';
export default suite({ ...import.meta }, expect('Tester',
  expect('Reporting',
    expect('Result category', todo()),
    expect('Result set',      todo(),
      expect('Step counter',  todo()))),
  expect('Execution',
    expect('Suite',  todo()),
    expect('Expect', todo()),
    expect('Forbid', todo()),
    expect('Matrix', todo()))));
