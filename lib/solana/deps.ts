export {
  pick
} from '@hackbg/fadroma';

export type {
  Name, Named, Semver, MaybeAsync,
} from '@hackbg/fadroma';

export {
  when, dir, toml, ts, rs, gitignore, readme, cargoToml,
  packageJson, tsConfig, eslintConfig, baconConfig, moldConfig
} from '@fadroma/gen';

export type {
  CargoDep, CargoFeature,
} from '@fadroma/gen';

export {
  expect, forbid, call, renamed
} from '@fadroma/tester';

export {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ACCOUNT_SIZE,
  ExtensionType, getMintLen,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToInstruction,
  createApproveInstruction,
  getMinimumBalanceForRentExemptAccount
} from '@solana/spl-token';

export * as Anchor from "@coral-xyz/anchor";
export { Program, workspace } from "@coral-xyz/anchor";
export { ok, deepStrictEqual as equal } from 'node:assert';

export type IDL    = {}; // TODO
export type NotIDL = {}; // TODO
