import { suite, expect, matrix } from './lib/tester/index.ts';
import * as Solana from './lib/solana/test.ts';
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
export default suite(import.meta.main || import.meta.url, matrix('Chain', [
  Solana,
  // Tendermint,
  // CosmWasm,
  // Namada,
  // Scrt
], testChain))
//import * as Tendermint  from './lib/tm/test.ts';
//import * as CosmWasm    from './lib/cw/test.ts';
//import * as Namada      from './lib/namada/test.ts';
//import * as Scrt        from './lib/scrt/test.ts';
