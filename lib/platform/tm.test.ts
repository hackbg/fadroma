
import { expect } from '../deps.ts';

export const testChain = (chain: ChainTest) => expect(chain.name,
  chain.testLocal, chain.testFetch, chain.testGas, chain.testFungible,
  chain.testNFT, chain.testProgram, chain.testProject);

export type ChainTestCase = (_: Context)=>unknown;

export type ChainTest = {
  name:          string,
  testLocal?:    ChainTestCase,
  testFetch?:    ChainTestCase,
  testGas?:      ChainTestCase,
  testFungible?: ChainTestCase,
  testNFT?:      ChainTestCase,
  testProgram?:  ChainTestCase,
  testProject?:  ChainTestCase,
};
import { testSuite, expect } from '@hackbg/fadroma';
export default testSuite(import.meta, 'Tendermint',
  expect('Localnet', expect('Connect'), expect('Subscribe')),
  expect('Fetch', expect('Block'), expect('Account'), expect('TX')),
  expect('Gas', expect('Drop'), expect('Send')),
  expect('Fungible', expect('Deploy'), expect('Mint/burn'), expect('Send'), expect('Allowance'), expect('Decimals')),
  expect('NFT', expect('Deploy'), expect('Transact')),
  expect('Program', expect('Deploy'), expect('Invoke')));
