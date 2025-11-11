#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, is, has } from "./tester.ts";
import { Log } from "./log.ts";
export default suite(import.meta, 'Log', () => { return Log() },
  is('object'),
  has('log',   'function'),
  has('info',  'function'),
  has('warn',  'function'),
  has('error', 'function'));
