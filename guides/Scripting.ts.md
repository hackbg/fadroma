# Scripting Fadroma deployments

The commands described in the [getting started guide](../README.md) can also be called from
scripts. This is useful if you're trying to combine them in a novel way. This document describes
the internal Fadroma Ops API which powers those commands; it's assumed that you're already familiar
with the [Fadroma Agent API](../agent/README.md), so if you're not, read that first, then come back.

## Compile API

See [/ops/build.md](../ops/build.md).

## Upload API

The client package, `@fadroma/agent`, exposes a base `Uploader` class,
which the global `fetch` method to obtain code from any supported URL
(`file:///` or otherwise).

This `fetch`-based implementation only supports temporary, in-memory
upload caching: if you ask it to upload the same contract many times,
it will upload it only once - but it will forget all about that
as soon as you refresh the page.

The backend package, `@hackbg/fadroma`, provides `FSUploader`.
This extension of `Uploader` uses Node's `fs` API instead, and
writes upload receipts into the upload state directory for the
given chain (e.g. `state/$CHAIN/uploads/`).

Let's try uploading an example WASM binary:

* Uploading with default configuration (from environment variables):

* Passing custom options to the uploader:

## Deploy receipts

By default, the list of contracts in each deployment created by Fadroma
is stored in `state/${CHAIN_ID}/deploy/${DEPLOYMENT}.yml`.

The deployment currently selected as "active" by the CLI
(usually, the latest created deployment) is symlinked at
`state/${CHAIN_ID}/deploy/.active.yml`.
