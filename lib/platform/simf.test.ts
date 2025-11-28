#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { Test } from '../index.ts';
import { resolvePath } from '../deps.ts';
import { Simf } from './simf.ts';
const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm");
const path = resolvePath(import.meta.dirname, 'simf/example/01.simf');
export default Test.suite(import.meta, 'Simf',
  the('Wasm', async () => Simf.Wasm(await Deno.readFile(wasm)),
    has('build', is('function'))),
  the('Program',
    the('Define',     () => Simf(path)),
    the('Entrypoint', () => Simf({}, path)),
    the('Deploy',     async () => {
      const program = Simf(path);
      await program.build();
      await program.deposit();
      await program.withdraw();
    })));
