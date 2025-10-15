import * as Namada from '../lib/namada/namada.ts';

export const name = 'Namada';

export const testLocalnet  = expect('Localnet',  TODO)
export const testConnect   = expect('Connect',   TODO)
export const testSubscribe = expect('Subscribe', TODO)

export const testGetBlock       = expect('Get block',   TODO)
export const testGetAccount     = expect('Get account', TODO)
export const testGetTransaction = expect('Get tx',      TODO)

export const testFTCreate    = expect('Create',    TODO)
export const testFTMint      = expect('Mint',      TODO)
export const testFTBurn      = expect('Burn',      TODO)
export const testFTTransfer  = expect('Transfer',  TODO)
export const testFTAllowance = expect('Allowance', TODO)
export const testFTDecimals  = expect('Decimals',  TODO)

export const testNFTCreate   = expect('Create',   TODO)
export const testNFTTransfer = expect('Transfer', TODO)

export const testProgram = expect('Program',
  expect('Deploy', TODO),
  expect('Invoke', TODO))

export const testProject = testStack

export const testStack = (stack: SolanaStack) => expect(stack.name,
  expect('Init',   TODO),
  expect('Build',  TODO),
  expect('Deploy', TODO),
  expect('Test',   TODO),
  expect('SDK',    TODO,
    expect('CLI',  TODO),
    expect('GUI',
      expect('DOM',   TODO),
      expect('React', TODO),
      expect('Vue',   TODO))))

