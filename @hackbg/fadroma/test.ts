#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite, expect }  from "./tester.ts";
import testTester from './tester.test.ts';
import testSpawn  from './spawn.test.ts';
import testZeroMQ from './network/zmq.test.ts';
export default testSuite(import.meta, 'Fadroma',
  testTester,
  testSpawn,
  expect('Container', 'Pull', 'Run', 'Kill', 'Build'),
  expect('Network', 'TCP', 'HTTP', testZeroMQ),
  expect('Generator', '.gitignore', 'README',
    expect('ES',
      expect('node/npm/pnpm'),
      expect('tsc'),
      expect('deno'),
      expect('eslint')),
    expect('Rust',
      expect('cargo', 'workspace'),
      expect('bacon'),
      expect('mold')))
);
