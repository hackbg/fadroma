import { suite, expect, matrix, todo } from '../../lib/tester/index.ts';
import * as Solana from './index.ts';

export const name = 'Solana';

export const testLocalnet  = expect('Localnet',  todo)
export const testConnect   = expect('Connect',   todo)
export const testSubscribe = expect('Subscribe', todo)

export const testGetBlock       = expect('Get block',   todo)
export const testGetAccount     = expect('Get account', todo)
export const testGetTransaction = expect('Get tx',      todo)

export const testFTCreate    = expect('Create',    todo)
export const testFTMint      = expect('Mint',      todo)
export const testFTBurn      = expect('Burn',      todo)
export const testFTTransfer  = expect('Transfer',  todo)
export const testFTAllowance = expect('Allowance', todo)
export const testFTDecimals  = expect('Decimals',  todo)

export const testNFTCreate   = expect('Create',   todo)
export const testNFTTransfer = expect('Transfer', todo)

export const testProgram = expect('Program',
  expect('Deploy', todo),
  expect('Invoke', todo))
export const testProject = ({ stacks = [Anchor, Codama, Solitude] }) =>
  matrix('Stack', stacks, testProjectStack)
export const testProjectStack = (stack: SolanaStack) =>
  expect(stack.name,
    expect('Init',      stack.init),
    expect('Build',     stack.build),
    expect('Deploy',    stack.deploy),
    expect('Test',      stack.test),
    expect('SDK',       stack.sdk,
      expect('CLI',     stack.cli),
      expect('GUI',
        expect('DOM',   stack.dom),
        expect('React', stack.react),
        expect('Vue',   stack.vue))))

export type TestCase = (context: TestContext) => (TestContext|Promise<TestContext>)
export type TestContext = {
  report?: Tester
}
export type SolanaStack = {
  name:   string,
  init:   TestCase,
  build:  TestCase,
  deploy: TestCase,
  test:   TestCase,
  sdk:    TestCase,
  cli:    TestCase,
  dom:    TestCase,
  react:  TestCase,
  vue:    TestCase,
}
export const Anchor: SolanaStack = {
  name:  'Anchor/Web3.js',
  init:   todo(),
  build:  todo(),
  deploy: todo(),
  test:   todo(),
  sdk:    todo(),
  cli:    todo(),
  dom:    todo(),
  react:  todo(),
  vue:    todo(),
}
export const Codama: SolanaStack = {
  name:  'Codama + Solana-Kit',
  init:   todo(),
  build:  todo(),
  deploy: todo(),
  test:   todo(),
  sdk:    todo(),
  cli:    todo(),
  dom:    todo(),
  react:  todo(),
  vue:    todo(),
}
export const Solitude: SolanaStack = {
  name:  'Solitude',
  init:   todo(),
  build:  todo(),
  deploy: todo(),
  test:   todo(),
  sdk:    todo(),
  cli:    todo(),
  dom:    todo(),
  react:  todo(),
  vue:    todo(),
}

export default suite(import.meta.main || import.meta.url, matrix('Solana', [
  Anchor,
  // Codama,
  // Solitude,
]), testSolanaStack)

export function testSolanaStack () {}
