#!/usr/bin/env -S deno run --allow-env
import { expect, suite } from '@hackbg/fadroma';
import * as SolWeb3 from './index.ts';
export default suite(import.meta, 'Solana (Web3)',
  expect('Localnet', expect('Connect'), expect('Subscribe')),
  expect('Fetch', expect('Block'), expect('Account'), expect('TX')),
  expect('Gas', expect('Drop'), expect('Send')),
  expect('Fungible', expect('Deploy'), expect('Mint/burn'), expect('Send'), expect('Allowance'), expect('Decimals')),
  expect('NFT', expect('Deploy'), expect('Transact')),
  expect('Program', expect('Deploy'), expect('Invoke')));
