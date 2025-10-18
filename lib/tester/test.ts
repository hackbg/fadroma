#!/usr/bin/env -S deno run --allow-env
import { suite, expect } from './index.ts';
export default suite(import.meta, 'Tester',
  expect('Reporting',
    expect('Categories'),
    expect('Result set',
      expect('Step counter'))),
  expect('Execution',
    expect('Suite'),
    expect('Expect'),
    expect('Forbid'),
    expect('Matrix')));
