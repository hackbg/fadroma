#!/usr/bin/env -S deno run --allow-env
import { suite } from '@fadroma/tester';
import testTester from './lib/tester/test.ts';
import Solana from './lib/solana/test.ts';
import Simplicity from './lib/simf/test.ts';
import { testChain } from './lib/chain/test.ts';
export default suite(import.meta, null,
  testTester,
  testChain(Solana),
  testChain(Simplicity));
