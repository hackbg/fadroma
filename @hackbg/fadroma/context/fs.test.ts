#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-read=/tmp/fadroma --allow-write=/tmp/fadroma
import { Dir, Temp } from './fs.ts';
import { suite, the, is, has }  from "./tester.ts";
export default suite(import.meta, 'FS',
  the('Dir',
    the('Current', () => { return Dir() },
      is('object'),   has('path')),
    the('Create',  () => { return Dir('test') },
      is('function'), has('path'))),
    the('Temp',    () => { return Temp() },
      is('function'), has('prefix'),
      the('Write', t  => { return t() },
      is('object'),   has('rimraf'))));
