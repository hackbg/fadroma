import * as Solana     from './lib/solana/test.ts';
import * as Tendermint from './lib/tm/test.ts';
import * as CosmWasm   from './lib/cw/test.ts';
import * as Namada     from './lib/namada/test.ts';
import * as Scrt       from './lib/scrt/test.ts';
import { entrypoint } from './lib/core/index.ts';

export default entrypoint(import.meta.main || import.meta.url,
  async function main (..._argv) {
    Error.stackTraceLimit = Infinity;
    return new TestRunner().run(await testSuite())
  })

export const testMatrix = (variants, test) => () =>
  Promise.all(variants.map(variant=>test(variant)))

const testSuite = testMatrix([Solana, Tendermint, Namada], testChain)

const testChain = ({
  name,
  testLocalnet, testSubscribe, testConnect,
  testGetBlock, testGetAccount, testGetTransaction,

  testFTCreate, testFTMint, testFTBurn,
  testFTTransfer, testFTAllowance, testFTDecimals,
  testNFTCreate, testNFTTransfer,

  testProgram, testProject,
}) => expect(name,
  testLocalnet,
  expect('Public RPC', testSubscribe, testConnect,
    testGetBlock, testGetAccount, testGetTransaction),
  expect('Authorized RPC',
    expect('Fungible',    testFTCreate,
      expect('Mint',      testFTMint),
      expect('Burn',      testFTBurn),
      expect('Transfer',  testFTTransfer),
      expect('Allowance', testFTAllowance),
      expect('Decimals',  testFTDecimals)),
    expect('NFT',         testNFTCreate,
      expect('Transfer',  testNFTTransfer))),
  expect('Program', testProgram), // TODO: IPC! Test with program that
  expect('Project', testProject)) // can recursively call itself.
