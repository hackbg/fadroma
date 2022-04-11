# Hack.bg Toolbox [![NPM version](https://img.shields.io/npm/v/@hackbg/toolbox?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/toolbox)

Shorthands for doing various Unixy things from Node.js.
* Common functions from Node.js stdlib and extra utilities from NPM, reexported in common namespace.
* Several minimal single-purpose utility libraries, usable standalone or reexported.
* This establishes the baseline for a future port of dependent Node projects,
  such as [Fadroma](https://github.com/hackbg/fadroma), to [Deno](https://deno.land)

## Contents

<table>
<tr></tr>
<tr><td valign="top">

### `@hackbg/toolbox` [![NPM version](https://img.shields.io/npm/v/@hackbg/toolbox?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/toolbox)

Main package. Reexports all others + extra utilities.

</td><td>

</td></tr>
<tr></tr>
<tr><td valign="top">

### `@hackbg/dokeres` [![NPM version](https://img.shields.io/npm/v/@hackbg/dokeres?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/dokeres)

Docker utilities.

</td><td>

</td></tr>
<tr></tr>
<tr><td valign="top">

### `@hackbg/forkers` [![NPM version](https://img.shields.io/npm/v/@hackbg/forkers?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/forkers)

Web worker wrapper.

</td><td>

</td></tr>
<tr></tr>
<tr><td valign="top">

### `@hackbg/kabinet` [![NPM version](https://img.shields.io/npm/v/@hackbg/kabinet?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/kabinet)

File utilities.

</td><td>

</td></tr>
<tr></tr>
<tr><td>

### `@hackbg/komandi` [![NPM version](https://img.shields.io/npm/v/@hackbg/komandi?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/komandi)

Command runner.

</td><td>

</td></tr>
<tr></tr>
<tr><td valign="top">

### `@hackbg/konzola` [![NPM version](https://img.shields.io/npm/v/@hackbg/konzola?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/konzola)

Pretty console.

</td><td>

```typescript
import Konzola from '@hackbg/konzola'

const console = Konzola('some identifying prefix')

console.info('FYI')
console.warn('beware!')
console.error('oops :(')
console.debug({pretty: 'printed'})
console.trace({this: 'too'})
console.table([[123,456],[789,101112]])
```

</td></tr>
<tr></tr>
<tr><td valign="top">

### `@hackbg/runspec` [![NPM version](https://img.shields.io/npm/v/@hackbg/runspec?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/runspec)

Test runner.

</td><td>

```typescript
import runSpec from '@hackbg/runspec'

const Spec1 = {
  'test name' (assert) { assert(true) }
}

const Spec2 = {
  async 'other test' ({ deepEqual }) { deepEqual({}, {}) }
}

runSpec({ Spec1, Spec2 }, process.argv.slice(2))
```

</td></tr>

</table>
