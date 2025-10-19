#!/usr/bin/env -S deno run --allow-env
import { expect, suite } from '@fadroma/tester';
export default suite(import.meta, 'Bitcoin',
  expect('Localnet'),
  expect('Read'),
  expect('Write'))
