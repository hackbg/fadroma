#!/usr/bin/env -S deno run --allow-env --allow-net --allow-run
import { suite }   from '@fadroma/tester';
import testTester  from './lib/tester/test.ts';
import testBtc     from './lib/btc/test.ts';
import testSimf    from './lib/simf/test.ts';
import testSolWeb3 from './lib/sol-web3/test.ts';
import testSolKit  from './lib/sol-kit/test.ts';
import testSolRust from './lib/sol-rs/test.ts';
import testTm      from './lib/tm/test.ts';
import testCw      from './lib/cw/test.ts';
import testNamada  from './lib/namada/test.ts';
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
