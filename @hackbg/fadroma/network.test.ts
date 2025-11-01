#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite, expect }  from "./tester.ts";
import testZeroMQ from './network/zmq.test.ts';
export default testSuite(import.meta, 'Network',
  expect('TCP'),
  expect('HTTP'),
  testZeroMQ)
