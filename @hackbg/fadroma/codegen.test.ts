#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the }  from "./tester.ts";
export default suite(import.meta, 'Codegen',
  '.gitignore',
  'README',

  the('ES',
    the('node/npm/pnpm'),
    the('tsc'),
    the('deno'),
    the('eslint')),

  the('Rust',
    the('cargo', 'workspace'),
    the('bacon'),
    the('mold')));
