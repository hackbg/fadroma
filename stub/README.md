This directory contains various stub module, or module stubs.

Their purpose: to enable loading Fadroma code in non-server-side environments.

Some of them are loaded through `vite.config.ts`; others are
provided when instantiating WASM modules.

Currently, they just return undefined.

A more appropriate behaviour would be for them to
always throw a "wrong environment" error.
