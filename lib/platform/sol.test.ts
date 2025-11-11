#!/usr/bin/env -S deno run --allow-env
import { expect, testSuite } from '@hackbg/fadroma';
import * as SolKit from './index.ts';
export default testSuite(import.meta, 'Solana (Kit)',
  expect('Localnet', expect('Connect'), expect('Subscribe')),
  expect('Fetch', expect('Block'), expect('Account'), expect('TX')),
  expect('Gas', expect('Drop'), expect('Send')),
  expect('Fungible', expect('Deploy'), expect('Mint/burn'), expect('Send'), expect('Allowance'), expect('Decimals')),
  expect('NFT', expect('Deploy'), expect('Transact')),
  expect('Program', expect('Deploy'), expect('Invoke')));
#!/usr/bin/env -S deno run --allow-env
import { expect, testSuite } from '@hackbg/fadroma';
import * as SolRs from './index.ts';
export default testSuite(import.meta, 'Solana (Rust)',
  expect('Init'), expect('Build'), expect('Deploy'), expect('Test'),
  expect('SDK', expect('Test'), expect('CLI'), expect('GUI')));
//import * as _ from './index.ts';
//import { expect, matrix } from '../../lib/tester/index.ts';
//export const stacks = [
  //['Anchor (RS+TS)',             {}],
  //['Anchor (RS) + Kit + Codama', {}],
  //['AnchorRS from IDL (mocker)', {}],
  //['AnchorRS from IDL + NonIDL', {}],
//] as const;
import { expect, testSuite } from '@hackbg/fadroma';
import * as SolWeb3 from './index.ts';
export default testSuite(import.meta, 'Solana (Web3)',
  expect('Localnet', expect('Connect'), expect('Subscribe')),
  expect('Fetch', expect('Block'), expect('Account'), expect('TX')),
  expect('Gas', expect('Drop'), expect('Send')),
  expect('Fungible', expect('Deploy'), expect('Mint/burn'), expect('Send'), expect('Allowance'), expect('Decimals')),
  expect('NFT', expect('Deploy'), expect('Transact')),
  expect('Program', expect('Deploy'), expect('Invoke')));
