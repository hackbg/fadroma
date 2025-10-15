import * as Solana from './index.ts';
import { expect, todo } from '../tester/index.ts';

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

export const testProject = testMatrix([Anchor, Codama, Solitude], testStack)

export const testStack = (stack: SolanaStack) => expect(stack.name,
  expect('Init',   todo),
  expect('Build',  todo),
  expect('Deploy', todo),
  expect('Test',   todo),
  expect('SDK',    todo,
    expect('CLI',  todo),
    expect('GUI',
      expect('DOM',   todo),
      expect('React', todo),
      expect('Vue',   todo))))
