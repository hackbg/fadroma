#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run
import { testSuite, expect }  from "./tester.ts";
export default testSuite(import.meta, 'Codegen',
  expect('Generator', '.gitignore', 'README',
    expect('ES',
      expect('node/npm/pnpm'),
      expect('tsc'),
      expect('deno'),
      expect('eslint')),
    expect('Rust',
      expect('cargo', 'workspace'),
      expect('bacon'),
      expect('mold'))));
