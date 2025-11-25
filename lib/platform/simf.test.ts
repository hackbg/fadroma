#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test } from '../index.ts';
import { Simf } from './simf.ts';
const { the } = Test;
export default Test.suite(import.meta, 'Simf',
  the('Program',
    the('Define',     () => Simf('simf/example/01.simf')),
    the('Entrypoint', () => Simf({}, 'simf/example/01.simf')),
    the('Deploy',     async () => {
      const program = Simf('simf/example/01.simf');
      await program.build();
      await program.deposit();
      await program.withdraw();
    })));
