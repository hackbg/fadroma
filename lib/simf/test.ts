import * as _ from './index.ts';
import { expect } from '../../lib/tester/index.ts';
export const name = 'Simplicity';
export default {
  name,
  testLocal:    expect('Localnet', expect('Connect'), expect('Subscribe')),
  testFetch:    expect('Fetch',    expect('Block'),   expect('Account'), expect('TX')),
  testGas:      expect('Gas',      expect('Drop'),    expect('Send')),
  testFungible: expect('Fungible', expect('Deploy'),  expect('Transact')),
  testNFT:      expect('NFT',      expect('Deploy'),  expect('Transact')),
  testProgram:  expect('Program',  expect('Deploy'),  expect('Invoke')),
  testProject:  expect('Project',
    expect('Init'), expect('Build'), expect('Deploy'), expect('Test'),
    expect('SDK', expect('CLI'), expect('GUI'))),
}
