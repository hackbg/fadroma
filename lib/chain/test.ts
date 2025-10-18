import { expect } from '../tester/index.ts';
export type Context = unknown;
export type Test = (_: Context)=>unknown;
export const testChain = (chain: ChainTest) => expect(chain.name,
  chain.testLocal, chain.testFetch, chain.testGas, chain.testFungible,
  chain.testNFT, chain.testProgram, chain.testProject);
export type ChainTest = {
  name:          string,
  testLocal?:    Test,
  testFetch?:    Test,
  testGas?:      Test,
  testFungible?: Test,
  testNFT?:      Test,
  testProgram?:  Test,
  testProject?:  Test,
};
