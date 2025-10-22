export * from './codegen/es.ts';
export * from './codegen/rs.ts';

import { text, markdown } from './backend/fs.ts';
import type { ECMAScript } from './codegen/es.ts';
import type { Rust } from './codegen/rs.ts';

/** Semantic version. */
export type Semver = string; // TODO
/** Versioned component. */
export type Versioned = { /* The version. */ version: Semver };

export type Project =
  { gitignore?: string[]
  , readme?: boolean|Readme
  , dotenv?: boolean
  , direnv?: boolean } & Rust & ECMAScript;

export const gitignore = (...lines: string[]) =>
  text('.gitignore', ...lines);

export type Readme = { title?: string, sections?: [string, string] };
export const readme = ({ title }: Readme) =>
  markdown('README.md', { [String(title)]: {} });
