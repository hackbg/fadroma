import type {
  Name, Named, Semver, IDL, NotIDL, CargoDep, CargoFeature
} from './deps.ts';
export type ProjectOptions = Named & {
  name:      Name,
  legacy:    boolean,
  anchor:    boolean|Semver,
  solana:    boolean|Semver,
  node:      boolean|Semver,
  deno:      boolean|Semver,
  ts:        boolean|Semver,
  pnpm:      boolean,
  bacon:     boolean,
  eslint:    boolean,
  web3:      boolean|Semver,
  kit:       boolean|Semver,
  codama:    boolean|Semver,
  mold:      boolean,
  idl:       IDL|null,
  notIdl:    NotIDL|null,
  dotenv:    boolean,
  direnv:    boolean,
  programs?: ProgramOptions[],
};

export type ProgramOptions = Named & {
  name:      Name,
  idl:       IDL|null,
  notIdl:    IDL|null,
  solana:    Semver,
  anchor:    Semver|null,
  deps?:     CargoDep[],
  devDeps?:  CargoDep[],
  features?: CargoFeature[]
};

