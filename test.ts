#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-write
import { suite } from "@hackbg/fadroma";
import testFadroma from "./lib/@hackbg/fadroma/test.ts";
import testBtc     from "./lib/@fadroma/btc/test.ts";
import testSimf    from "./lib/@fadroma/simf/test.ts";
//import testSolWeb3 from "./lib/@fadroma/sol-web3/test.ts";
//import testSolKit  from "./lib/@fadroma/sol-kit/test.ts";
//import testSolRust from "./lib/@fadroma/sol-rs/test.ts";
//import testTm      from "./lib/@fadroma/tm/test.ts";
//import testCw      from "./lib/@fadroma/cw/test.ts";
//import testNamada  from "./lib/@fadroma/namada/test.ts";
export default suite(import.meta, null,
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
