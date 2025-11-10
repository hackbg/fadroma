#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test, traceConsole } from "./@hackbg/fadroma/index.ts";
import testFadroma from "./@hackbg/fadroma/test.ts";
import testBtc     from "./@fadroma/btc/btc.test.ts";
import testSimf    from "./@fadroma/simf/simf.test.ts";
//import testSolWeb3 from "./@fadroma/sol-web3/test.ts";
//import testSolKit  from "./@fadroma/sol-kit/test.ts";
//import testSolRust from "./@fadroma/sol-rs/test.ts";
//import testTm      from "./@fadroma/tm/test.ts";
//import testCw      from "./@fadroma/cw/test.ts";
//import testNamada  from "./@fadroma/namada/test.ts";
traceConsole();
export default Test.suite(import.meta, 'Fadroma (full)',
  testFadroma, testBtc, testSimf,
  //testSolRust,
  //testSolWeb3,
  //testSolKit,
  //testTm,
  //testCw,
  //testNamada
);
