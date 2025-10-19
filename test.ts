#!/usr/bin/env -S deno run --allow-env
import { suite }    from '@fadroma/tester';
import testTester   from './lib/tester/test.ts';
import testBtc      from './lib/btc/test.ts';
import testSimf     from './lib/simf/test.ts';
import _testSolWeb3 from './lib/sol-web3/test.ts';
import _testSolKit  from './lib/sol-kit/test.ts';
import _testSolRust from './lib/sol-rs/test.ts';
import _testTm      from './lib/tm/test.ts';
import _testCw      from './lib/cw/test.ts';
import _testNamada  from './lib/namada/test.ts';
export default suite(import.meta, null,
  testTester,
  testBtc,
  testSimf,
  //testSolRust,
  //testSolWeb3,
  //testSolKit,
  //testTm,
  //testCw,
  //testNamada
);
