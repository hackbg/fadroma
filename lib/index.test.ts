#!/usr/bin/env -S deno run --coverage -I --allow-env --allow-net --allow-run --allow-read --allow-write=/tmp/fadroma
import The      from "./tester.ts";
import Context  from './context.test.ts';
import Format   from './format.test.ts';
import Platform from './platform.test.ts';
import Tester   from './tester.test.ts';
import Watch    from './watcher.test.ts';
export default The(import.meta, 'Fadroma',
  Tester,
  Format,
  Context,
  Watch,
  Platform);
