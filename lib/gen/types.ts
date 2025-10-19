export type { Bytes, Step } from './deps.ts';

/** Context for executing filesystem operations: current working directory. */
export type FSContext = string;
/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FSContext) => FSContext;

export type Readme = { title?: string, sections?: [string, string] };
export type Semver = { /*TODO*/ };

export type ProjectOptions = { gitignore?: string[]
                             , readme?: boolean|Readme
                             , dotenv?: boolean
                             , direnv?: boolean
                             , rust?:   RustOptions
                             , es?:     ESOptions };

export type RustOptions    = { bacon?:  boolean
                             , mold?:   boolean
                             , workspace?: boolean };

export type CrateOptions   = { name?:     string
                             , version?:  string
                             , deps?:     CargoDep[]
                             , devDeps?:  CargoDep[]
                             , features?: CargoFeature[] };

export type ESOptions      = { esm?:    boolean
                             , ts?:     boolean
                             , node?:   boolean
                             , deno?:   boolean
                             , pnpm?:   boolean
                             , eslint?: boolean };

export type CargoDep     = {};
export type CargoFeature = {};
