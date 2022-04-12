import dotenv from 'dotenv'
dotenv.config()

import { config } from './Config'
config.fromEnv(process.env as any)

export * from '@hackbg/toolbox'
export * from './Core'
export * from './Config'
export * from './Build'
export * from './Schema'
export * from './Devnet'
export * from './Chain'
export * from './Agent'
export * from './Bundle'
export * from './Upload'
export * from './Deploy'
export * from './Migrate'
export * from './Client'
export * from './Print'
export * from './Mocknet'
