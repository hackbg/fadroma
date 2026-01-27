#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test } from "./index.ts";
export default Test.suite(import.meta, 'Format',
  'ANSI', 'Bit', 'Borsh', 'Byte', 'Error', 'Function', 'Hash', 'Number',
  'Stream', 'String', 'Time');
