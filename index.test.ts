#!/usr/bin/env -S deno run --coverage -I --allow-env --allow-net --allow-run --allow-read --allow-write=/tmp/fadroma
import The      from "../lib/tester.ts";
import Context  from './context.test.ts';
import Format   from './format.test.ts';
import Tester   from './tester.test.ts';
import Watch    from '../watch/watcher.test.ts';
import Platform from '../platform/platform.test.ts';
export default The(import.meta, 'Fadroma', Library, Platform, Watcher);
  Tester,
  Format,
  Context,
  Watch,
  Platform);
