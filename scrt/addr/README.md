# Fadroma Addressing for Secret Network

## Overview

Contracts accept API calls in `HumanAddr`
yet they need to store addresses as `CanonicalAddr`
to be resilient against address format changes.

This library handles conversion between the two address types
by implementing the `Humanize` and `Canonize` traits, each of
which has a single corresponding method `humanize`/`canonize`
which takes `&deps.api` and returns a StdResult containing the
converted struct.

## TODO

The `humanize` and `canonize` methods need to be implemented manually,
except for the minimal case (`HumanAddr.canonize`/`CanonicalAddr.humanize`).

* [ ] An attribute macro to mark address fields in structs
      and automatically derive the corresponding
      `humanize`/`canonize` implementations.
