#!/usr/bin/env -S deno run --allow-env
import { entrypoint } from '@hackbg/fadroma';
import { suite } from '@fadroma/tester';
import testTester from './lib/tester/test.ts';
import Solana from './lib/solana/test.ts';
import Simplicity from './lib/simf/test.ts';
import { testChain } from './lib/chain/test.ts';
export default entrypoint(import.meta, suite('Fadroma',
  testTester,
  testChain(Solana),
  testChain(Simplicity)));
