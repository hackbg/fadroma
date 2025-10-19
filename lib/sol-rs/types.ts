import type { Semver, BaseProjectOptions, CrateOptions, BaseESOptions }
  from './deps.ts';

export type ProjectOptions = { solana?: boolean|Semver
                             , es?:     ESOptions } & BaseProjectOptions;

export type ProgramOptions = { idl?:      IDL
                             , notIdl?:   NotIDL
                             , solana?:   true|Semver
                             , anchor?:   true|Semver|null } & CrateOptions;

export type ESOptions      = { web3?:   boolean
                             , kit?:    boolean
                             , codama?: boolean } & BaseESOptions;

export type IDL            = { /* TODO */ };

export type NotIDL         = { /* TODO */ };
