import { textFormat, json } from '../service.ts';

/** Specify a JS file. */
export const js = textFormat((_: unknown) => {
  throw new Error('unimplemented') });

/** Specify a TS file. */
export const ts = textFormat((_: unknown) => {
  throw new Error('unimplemented') });

export type ECMAScript =
  { js?:     boolean
  , esm?:    boolean
  , ts?:     boolean
  , node?:   boolean
  , deno?:   boolean
  , pnpm?:   boolean
  , eslint?: boolean };

export const packageJson = ({
  name,
  path             = 'package.json',
  version          = '0.0.0',
  isPrivate        = true,
  legacy           = false,
  scripts          = [],
  dependencies     = [],
  devDependencies  = [],
  peerDependencies = [],
  main             = undefined,
  exports          = undefined,
}) => json(path, () => ({
  name,
  type: legacy ? "script" : "module",
  main,
  version,
  "private": isPrivate,
  exports,
  scripts:          Object.fromEntries(scripts.filter(Boolean)),
  dependencies:     Object.fromEntries(dependencies.filter(Boolean)),
  devDependencies:  Object.fromEntries(devDependencies.filter(Boolean)),
  peerDependencies: Object.fromEntries(peerDependencies.filter(Boolean)),
}))

export const tsConfig = json('tsconfig.json');

export const eslintConfig = js('eslint.config.js');
