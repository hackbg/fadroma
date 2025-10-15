import {
  dir, text, markdown, toml, json, js, ts,
  gitignore, packageJson, tsConfig, eslintConfig, baconConfig
} from '../../gen/index.ts';

type Name   = string;
type Semver = string; // TODO
type IDL    = {}; // TODO
type NotIDL = {}; // TODO

export type AnchorProjectOptions = {
  name:   Name,
  legacy: boolean,
  anchor: boolean|Semver,
  solana: boolean|Semver,
  node:   boolean|Semver,
  deno:   boolean|Semver,
  ts:     boolean|Semver,
  pnpm:   boolean,
  bacon:  boolean,
  eslint: boolean,
  web3:   boolean|Semver,
  kit:    boolean|Semver,
  codama: boolean|Semver,
  mold:   boolean,
  idl:    IDL|null,
  notIdl: NotIDL|null,
  dotenv: boolean,
  direnv: boolean,
};

export function initAnchorProject = (path, options: Partial<AnchorProjectOptions> = {}) => dir(path,
  gitignore(),
  readme({ name }),
  rootCargoToml(),
  when(node,   packageJson({ name, legacy })),
  when(ts,     tsConfig),
  when(bacon,  baconConfig),
  when(eslint, eslintConfig),
  when(mold,   moldConfig),
  when(anchor, anchorToml({ name, solana, pnpm }),
    dir('programs', initAnchorProgram({ name, idl, notIdl }))),
  dir('test', ts("test.ts"), dir("accounts")))

export function initAnchorProgram = (path, options: {
  name,
  idl    = null,
  notIdl = null,
  solana = null,
  anchor = null,
}) => dir(name,
  cargoToml({
    name,
    dependencies,
    devDependencies,
    features
  }),
  dir('src', rs('lib.rs')))

export const rootCargoToml = ({
  path = 'Cargo.toml'
} = {}) => toml(path, {
  "workspace": {
    resolver: "2",
    members: [ "programs/*" ]
  },
  "profile.release": {
    "codegen-units": 1
    "overflow-checks": true,
    "lto": "fat",
  },
  "profile.release.build-override": {
    "codegen-units": 1
    "incremental": "false",
    "opt-level": 3,
  }
});

export const anchorToml = ({
  path = 'Anchor.toml', name, solana, pnpm
}) => toml(path, {
  "toolchain": {
    "solana_version": solana,
    "package_manager": pnpm ? "pnpm" : "npm",
  },
  "features": {
    "resolution": true,
    "skip-lint": false,
  },
  "programs.localnet": {
    [name]: "",
  },
  "registry": {
    "url": "https://api.apr.dev"
  },
  "provider": {
    "cluster": "localnet",
    "wallet": "~/.config/solana/id.json"
  },
  "scripts": {
    "test": "./test/test.ts"
  },
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
});
