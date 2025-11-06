#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite }   from "./context/tester.ts";
import testCodegen from './context/codegen.test.ts';
import testCommand from './context/command.test.ts';
import testDom     from './context/dom.test.ts';
import testFs      from './context/fs.test.ts';
import testHttp    from './context/http.test.ts';
import testLogger  from './context/logger.test.ts';
import testPort    from './context/port.test.ts';
import testService from './context/service.test.ts';
import testSpawn   from './context/spawn.test.ts';
import testTcp     from './context/tcp.test.ts';
import testTester  from './context/tester.test.ts';
export default suite(import.meta, 'Fadroma',
  testTester, testLogger, testDom, testCommand,
  testPort, testTcp, testHttp,
  testSpawn, testService,
  testFs, testCodegen,
);
