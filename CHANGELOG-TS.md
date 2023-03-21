# Changelog - Fadroma TypeScript Packages

## 2022-07-08

* `@fadroma/client-scrt` v4.0.1
  * **FIX:** Move all modules into single file.
    As of v4.7, TypeScript still can't output isomorphic ESModules correctly.
* `@fadroma/client-scrt-grpc` v5.0.0
  * **FIX:** Move all modules into single file.
  * **BREAKING CHANGE:** decode `Uint8Array`s in TX error result.
    Response with undecoded data moved to `error.result.original`.

## 2022-05-25

First stable release of Fadroma Client.

* `@fadroma/client`: Fadroma Client 2.0.1
* `@fadroma/client-scrt`: Fadroma Client SCRT (Base) 2.0.0
* `@fadroma/client-scrt-grpc`: Fadroma Client SCRT (gRPC API) 2.0.0
