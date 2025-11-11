#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { suite, the }  from "./tester.ts";
export default suite(import.meta, 'Codegen',
  '.gitignore', 'README',
  the('ES', 'node/npm/pnpm', 'tsc', 'deno', 'eslint'),
  the('Rust', the('cargo', 'workspace'), 'bacon', 'mold'));
