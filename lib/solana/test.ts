import * as _ from './index.ts';
import { expect, matrix } from '../../lib/tester/index.ts';
export const stacks = [
  ['Anchor (RS+TS)',             {}],
  ['Anchor (RS) + Kit + Codama', {}],
  ['AnchorRS from IDL (mocker)', {}],
  ['AnchorRS from IDL + NonIDL', {}],
] as const;
export default {
  name: 'Solana',
  testLocal:    expect('Localnet', expect('Connect'), expect('Subscribe')),
  testFetch:    expect('Fetch',    expect('Block'),   expect('Account'), expect('TX')),
  testGas:      expect('Gas',      expect('Drop'),    expect('Send')),
  testFungible: expect('Fungible', expect('Deploy'), expect('Mint/burn'),
    expect('Send'), expect('Allowance'), expect('Decimals')),
  testNFT:      expect('NFT',      expect('Deploy'),  expect('Transact')),
  testProgram:  expect('Program',  expect('Deploy'),  expect('Invoke')),
  //testProject:  matrix('Project',  stacks, ([name, stack]) =>
    //expect(name, expect('Init'), expect('Build'), expect('Deploy'), expect('Test'),
    //expect('SDK', expect('CLI'), expect('GUI')))),
};
