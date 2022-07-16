<div align="center">

# Hack.bg Toolbox

[![NPM version](https://img.shields.io/npm/v/@hackbg/toolbox?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/toolbox)

The big box of everything that came in handy during the
development of [Fadroma](https://fadroma.tech), the
distributed application framework by [Hack.bg](https://hack.bg).

---

This repo also establishes a baseline for a future port of
dependent Node projects, such as Fadroma, to [Deno](https://deno.land) -
should that be on our radars once again.

Read on for a list of what's inside.

## [**`@hackbg/dokeres`**](./dokeres/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/dokeres?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/dokeres)

**Docker utilities.**

## [**`@hackbg/forkers`**](./forkers/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/forkers?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/forkers)

**Web worker wrapper.**

## [**`@hackbg/kabinet`**](./kabinet/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/kabinet?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/kabinet)

**Filesystem manipulation.**

## [**`@hackbg/komandi`**](./komandi/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/komandi?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/komandi)

**Simple command runner.**

## [**`@hackbg/konzola`**](./konzola/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/konzola?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/konzola)

**Pretty console output.**

## [**`@hackbg/portali`**](./portali/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/portali?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/portali)

**Network port utilities**

## [**`@hackbg/runspec`**](./runspec/README.md)

[![NPM version](https://img.shields.io/npm/v/@hackbg/runspec?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/runspec)

**Minimal test runner and reporter.**

</div>

---

### **Miscellaneous helpers and reexports:**
  * Generate random values in different formats (TODO `@hackbg/formati`)
  * ISO `timestamp` but in FS-friendly format
  * `pick` keys from object
  * Mark values of object destructuring as `required`
  * Reexports `exponential-backoff`, `open`, `bech32`, `signal-exit`
  * Reexports `stderr` and `env` from `process`
  * Reexports `execFile/execFileSync/spawn/spawnSync` - TODO unified `run()` or `shell()`
