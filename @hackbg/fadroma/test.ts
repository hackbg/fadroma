#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite }  from "./tester.ts";
import testTester  from './tester.test.ts';
import testSpawn   from './spawn.test.ts';
import testService from './service.test.ts';
import testCodegen from './codegen.test.ts';
export default suite(import.meta, 'Fadroma',
  testTester,
  testSpawn,
  testService,
  testCodegen);
