#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite, expect }  from "./tester.ts";
import testTester  from './tester.test.ts';
import testSpawn   from './spawn.test.ts';
import testNetwork from './network.test.ts';
import testService from './service.test.ts';
import testCodegen from './codegen.test.ts';
export default testSuite(import.meta, 'Fadroma',
  testTester, testSpawn, testService, testCodegen, testNetwork);
