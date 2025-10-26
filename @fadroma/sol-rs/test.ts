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
