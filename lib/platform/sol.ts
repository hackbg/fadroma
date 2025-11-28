import type { ProjectOptions, ProgramOptions } from './types.ts';
import { Dir, Toml, Ts } from '../../context.ts';
export function Solana () {}
export interface Solana {}
export namespace Solana {
  export type Project = {};
  export type Program = {};
  export type ProjectOptions = BaseProjectOptions & {
    solana?: boolean|Semver,
    web3?:   boolean,
    kit?:    boolean,
    codama?: boolean,
  };
  export type ProgramOptions = CrateOptions & {
    idl?:    IDL,
    notIdl?: NotIDL,
    solana?: true|Semver,
    anchor?: true|Semver|null
  };
  export type IDL    = { /* TODO */ };
  export type NotIDL = { /* TODO */ };
}
Solana.Workspace = () => toml('Cargo.toml', {
  "workspace": {
    resolver: "2", members: [ "programs/*" ]
  },
  "profile.release": {
    "codegen-units": 1, "overflow-checks": true, "lto": "fat",
  },
  "profile.release.build-override": {
    "codegen-units": 1, "incremental": "false", "opt-level": 3,
  }
})
Solana.AnchorToml = (options: Solana.ProjectOptions) => Toml('Anchor.toml', {
  "toolchain": {
    "solana_version":  opts.solana,
    "package_manager": opts.pnpm ? "pnpm" : "npm",
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
});
Solana.Project = (options: Solana.ProjectOptions) => Dir(
  Gitignore(),
  Readme({ title: name }),
  When(!!opts.node,    packageJson({ name, legacy: opts.legacy })),
  When(!!opts.ts,      tsConfig),
  When(opts.bacon,     baconConfig),
  When(opts.eslint,    eslintConfig),
  When(opts.mold,      moldConfig),
  When(opts.workspace, Solana.Workspace()),
  When(!!opts.anchor,  Solana.AnchorToml(options)),
  Dir('programs',      Solana.Program({ name, idl: opts.idl, notIdl: opts.notIdl })),
  Dir('test',          Ts("test.ts"), dir("accounts"))));
}
Solana.Program = (opts: Solana.ProgramOptions) => Dir(
  CargoToml(Pick('name', 'deps', 'devDeps', 'features')(opts)),
  Dir('src', Rs('lib.rs')));
