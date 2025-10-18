#!/usr/bin/env -S deno run --allow-env
import { entrypoint } from './lib/core/index.ts';
import { suite, expect, matrix } from './lib/tester/index.ts';
import testTester from './lib/tester/test.ts';
import * as Solana from './lib/solana/test.ts';
import * as Simplicity from './lib/simf/test.ts';
export default entrypoint(import.meta, suite(
  testTester,
  matrix('Chain', [
    Solana,
  ])));
  //matrix('Chain', [
    //Solana,
    //// Tendermint,
    //// CosmWasm,
    //// Namada,
    //// Scrt
  //], testChain))
export const testChain = ({
  name,
  testLocalnet, testSubscribe, testConnect,
  testGetBlock, testGetAccount, testGetTransaction,
  testFTCreate, testFTMint, testFTBurn,
  testFTTransfer, testFTAllowance, testFTDecimals,
  testNFTCreate, testNFTTransfer,
  testProgram, testProject,
}) => expect(name,
  testLocalnet,
  expect('Public RPC',
    testSubscribe,
    testConnect,
    testGetBlock,
    testGetAccount,
    testGetTransaction),
  expect('Authorized RPC',
    expect('Fungible',    testFTCreate,
      expect('Mint',      testFTMint),
      expect('Burn',      testFTBurn),
      expect('Transfer',  testFTTransfer),
      expect('Allowance', testFTAllowance),
      expect('Decimals',  testFTDecimals)),
    expect('NFT',         testNFTCreate,
      expect('Transfer',  testNFTTransfer))),
  expect('Program', testProgram),  // TODO: IPC! Test with program that
  expect('Project', testProject)); // can recursively call itself.
//import * as Tendermint  from './lib/tm/test.ts';
//import * as CosmWasm    from './lib/cw/test.ts';
//import * as Namada      from './lib/namada/test.ts';
//import * as Scrt        from './lib/scrt/test.ts';
