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
