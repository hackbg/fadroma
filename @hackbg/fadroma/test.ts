#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite }  from "./context/tester.ts";
import testTester  from './context/tester.test.ts';
import testSpawn   from './context/spawn.test.ts';
import testService from './context/service.test.ts';
import testCodegen from './context/codegen.test.ts';
export default suite(import.meta, 'Fadroma',
  testTester,
  testSpawn,
  testService,
  testCodegen);
