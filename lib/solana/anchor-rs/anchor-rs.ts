import type {
  Name, Named, Semver, IDL, NotIDL, CargoDep, CargoFeature
} from '../deps.ts';
import {
  pick, when, dir, toml, gitignore, readme, ts, packageJson,
  tsConfig, eslintConfig, rs, cargoToml, baconConfig, moldConfig,
} from '../deps.ts';

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

export const initProject = (opts: ProjectOptions) => (path: string) => dir(path,
  gitignore(),
  readme({ title: name }),
  when(opts.node,   packageJson({ name, legacy: opts.legacy })),
  when(opts.ts,     tsConfig),
  when(opts.bacon,  baconConfig),
  when(opts.eslint, eslintConfig),
  when(opts.mold,   moldConfig),
  dir('test', ts("test.ts"), dir("accounts")),
  toml('Cargo.toml', {
    "workspace": {
      resolver: "2", members: [ "programs/*" ]
    },
    "profile.release": {
      "codegen-units": 1, "overflow-checks": true, "lto": "fat",
    },
    "profile.release.build-override": {
      "codegen-units": 1, "incremental": "false", "opt-level": 3,
    }
  }),
  when(opts.anchor,
    toml('Anchor.toml', {
      "toolchain": {
        "solana_version": opts.solana, "package_manager": opts.pnpm ? "pnpm" : "npm",
      },
      "features": { "resolution": true, "skip-lint": false, },
      "programs.localnet": { [name]: "", },
      "registry": { "url": "https://api.apr.dev" },
      "provider": { "cluster": "localnet", "wallet": "~/.config/solana/id.json" },
      "scripts": { "test": "./test/test.ts" },
      "test": {
        "startup_wait":  5000,
        "shutdown_wait": 2000,
        "upgradeable":   true
      },
      "test.validator": {
        "bind_address": "127.0.0.1",
        "url": "https://api.devnet.solana.com",
        "ledger": ".anchor/test-ledger",
        "rpc_port": "8899"
      }
    }),
    dir('programs', initProgram({ name, idl: opts.idl, notIdl: opts.notIdl }))));

export const initProgram = (path: string, opts: ProgramOptions) => dir(path,
  cargoToml(pick('name', 'deps', 'devDeps', 'features')(opts)),
  dir('src', rs('lib.rs')));
