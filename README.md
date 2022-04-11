# Hack.bg Toolbox

Shorthands for doing various Unixy things from Node.js.
* Common functions from Node.js stdlib and extra utilities from NPM, reexported in common namespace.
* Several minimal single-purpose utility libraries, usable standalone or reexported.
* This establishes the baseline for a future port of dependent Node projects,
  such as [Fadroma](https://github.com/hackbg/fadroma), to [Deno](https://deno.land).

## How to publish

```sh
git clone ...
pnpm -r i
#pnpm -r build #if ts
$EDITOR ...
$EDITOR package.json -> version!
pnpm -r i
#pnpm -r build #if ts
git commit ...
git tag ...
git push
git push --tags
pnpm -r publish --access public
```
