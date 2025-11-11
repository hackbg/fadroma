#!/usr/bin/env -S deno run --coverage --allow-import --allow-env --allow-net --allow-run --allow-read --allow-write=/tmp/fadroma
import Format   from './format.test.ts';
import Context  from './context.test.ts';
import Platform from './platform.test.ts';
import Watch    from './watch.test.ts';
import { Test, traceConsole } from "./context.ts";
traceConsole();
export default Test.suite(import.meta, 'Fadroma', Format, Context, Platform, Watch);
