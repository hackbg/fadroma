#!/usr/bin/env -S deno run --allow-env
import { testSuite, expect } from '@hackbg/fadroma';
export default testSuite(import.meta, 'Tendermint',
  expect('Localnet', expect('Connect'), expect('Subscribe')),
  expect('Fetch', expect('Block'), expect('Account'), expect('TX')),
  expect('Gas', expect('Drop'), expect('Send')),
  expect('Fungible', expect('Deploy'), expect('Mint/burn'), expect('Send'), expect('Allowance'), expect('Decimals')),
  expect('NFT', expect('Deploy'), expect('Transact')),
  expect('Program', expect('Deploy'), expect('Invoke')));
