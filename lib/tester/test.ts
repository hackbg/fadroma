#!/usr/bin/env -S deno run --allow-env
import { suite, expect } from './index.ts';
export default suite(import.meta, 'Tester',
  expect('Category'),
  expect('Context'),
  expect('Counter'),
  expect('Result'),
  expect('Suite'),
  expect('Expect'),
  expect('Forbid'),
  expect('Matrix'));
