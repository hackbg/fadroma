#!/usr/bin/env -S deno run --allow-env
import { suite }   from '@fadroma/tester';
import testTester  from './lib/tester/test.ts';
import testSolWeb3 from './lib/sol-web3/test.ts';
import testSolRust from './lib/sol-rs/test.ts';
import testBtc     from './lib/btc/test.ts';
import testSimf    from './lib/simf/test.ts';
export default suite(import.meta, null,
  testTester,
  testSolWeb3,
  testSolRust,
  testBtc,
  testSimf);
