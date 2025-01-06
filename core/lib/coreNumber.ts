import { Format } from '../deps.ts'

/** A 128-bit integer. */
export type Uint128 = number|string|bigint

/** A 256-bit integer. */
export type Uint256 = number|string|bigint

/** A 128-bit decimal fraction. */
export type Decimal128 = number|string

/** A 256-bit decimal fraction. */
export type Decimal256 = number|string

export const base16 = Format.base16
