#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-write
import { testSuite } from "./@hackbg/fadroma/tester.ts";
import testFadroma from "./@hackbg/fadroma/test.ts";
import testBtc     from "./@fadroma/btc/test.ts";
import testSimf    from "./@fadroma/simf/test.ts";
//import testSolWeb3 from "./@fadroma/sol-web3/test.ts";
//import testSolKit  from "./@fadroma/sol-kit/test.ts";
//import testSolRust from "./@fadroma/sol-rs/test.ts";
//import testTm      from "./@fadroma/tm/test.ts";
//import testCw      from "./@fadroma/cw/test.ts";
//import testNamada  from "./@fadroma/namada/test.ts";
export default testSuite(import.meta, 'Fadroma (full)',
  testFadroma,
  testBtc,
  testSimf,
  //testSolRust,
  //testSolWeb3,
  //testSolKit,
  //testTm,
  //testCw,
  //testNamada
);
