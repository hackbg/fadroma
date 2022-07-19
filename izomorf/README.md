<div style="text-align:center">

# `@hackbg/izomorf`

Shim for publishing isomorphic TypeScript libraries to NPM,
in response to the current multilevel fragmentation of the JS packaging landscape.

Modifies package.json during publication of TypeScript packages
to make TS/ESM/CJS portability more seamless.

</div>

---

## Setup

* Requires [PNPM](https://pnpm.io)

  * [ ] TODO: Make optional

* Add to your `package.json`:

```json
{
  "devDependencies": {
    "@hackbg/izomorf": "latest"
  },
  "scripts": {
    "clean":       "izomorf clean",
    "release:dry": "npm run clean && izomorf dry",
    "release:wet": "npm run clean && izomorf wet --access=public"
  }
}
```

## Usage

* Edit package
* Test if your package can be released: `pnpm run release:dry`
* Increment version in package.json, commit
* Release into the wild: `pnpm run release:wet`

And/or add `pnpm run release:dry` to your CI.
