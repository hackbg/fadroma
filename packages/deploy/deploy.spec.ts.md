# Fadroma Deploy Specification

This package implements **uploading contracts from the filesystem**,
as well as **keeping track of contracts instantiated through the Fadroma Core API**.

Both actions are meant to be *idempotent*:
* Contract instances are only deployed *once*.
* While you can upload the same code to a chain multiple times, getting different code IDs,
  it only makes sense to upload it *once*.

Therefore, caching is implemented in the form of:
* **Deploy receipts**: records of one or more deployed contract instances.
* **Upload receipts**: records of a single uploaded contract binary.

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

This package concerns itself chiefly with the handling of deploy and upload receipts,
and defines the following entities:

## [Uploading contract binaries](./upload.spec.ts)

* `FSUploader`: upload compiled code to the chain from local files.
* **TODO:** `FetchUploader`, which supports uploading code from remote URLs.

```typescript
import './upload.spec.ts.md'
```

## [Storing deployed contract instances](./deploy-base.spec.ts)

* `DeployConfig`: configure deployer through environment variables.
* `Deployer`: a subclass of `Deployment` which stores deploy receipts
  in a specific `DeployStore` and can load data from them into itself.

```typescript
import './deploy-base.spec.ts.md'
```

## [Deploy store variants](./deploy-variants.spec.ts)

Several of those are currently supported for historical and compatibility reasons.

* `YAML1.YAMLDeployments_v1` and `YAML2.YAMLDeploymentss_v2` are ad-hoc
  storage formats used by the original deployer implementations.
* `JSON1.JSONDeployments_v1` is the first version of the stable deploy receipt API.

```typescript
import './deploy-store.spec.ts.md'
```

## [Deploy logging and errors]('./deploy-events.spec.ts.md)

```typescript
import './deploy-events.spec.ts.md'
```
