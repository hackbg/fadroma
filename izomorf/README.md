<div style="text-align:center">

# `@hackbg/izomorf`

Shim for publishing isomorphic TypeScript libraries to NPM,
in response to the current multilevel fragmentation of the JS packaging landscape.

Modifies package.json during publication of TypeScript packages
to make TS/ESM/CJS portability more seamless.

</div>

---

## Requirements

* [PNPM](https://pnpm.io)
  * [ ] TODO: Make optional

## Installation

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

* Update deps:

```shell
pnpm i
```

## Usage

* **Edit your package.** Fix a bug, implement a feature, or break the API 😭

* **Increment version** in your `package.json`:

```diff
-  "version": "1.0.0"
+  "version": "1.0.1"
```

* **Commit**:

```shell
fix(@1.0.1): don't crash on launch
```

* **Do a dry run** to check if your package can be released:

```shell
pnpm run release:dry
```

* **Release** into the wild:

```shell
pnpm run release:wet
```

* **Push** your commit (the newly created `npm/$PACKAGE/$VERSION` tag was automatically pushed).

```shell
git push
```
