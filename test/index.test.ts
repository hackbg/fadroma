#!/usr/bin/env -S deno run --coverage -I --allow-env --allow-net --allow-run --allow-read --allow-write=/tmp/fadroma
import The      from '../library/Test.ts';
import Tester   from './tester.test.ts';
import Library  from './library.test.ts';
import Watch    from './watcher.test.ts';
import Platform from './platform.test.ts';
export default The(import.meta, 'Fadroma', Tester, Library, Watch, Platform);
