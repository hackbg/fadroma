#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-read --allow-write=/tmp/fadroma
import { Test, traceConsole } from "./context.ts";
import testCodegen from './context/codegen.test.ts';
import testCommand from './context/command.test.ts';
import testDom     from './context/dom.test.ts';
import testFs      from './context/fs.test.ts';
import testHttp    from './context/http.test.ts';
import testLog     from './context/log.test.ts';
import testPort    from './context/port.test.ts';
import testService from './context/service.test.ts';
import testTcp     from './context/tcp.test.ts';
import testTester  from './context/tester.test.ts';
traceConsole();
export default Test.suite(import.meta, 'Core',
  testTester, testLog, testDom, testCommand,
  testPort, testTcp, testHttp, testService, testFs, testCodegen);
