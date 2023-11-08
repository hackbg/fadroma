# Configuration

---

**Status:** Needs update, some are OOD/contradictory.

---

|Env var|Description|
|-|-|
|**`FADROMA_ARTIFACTS`**            |**Path to directory.** project artifact cache|
|**`FADROMA_BUILD_DOCKERFILE`**     |**Path to a Dockerfile.** dockerfile to build image if missing|
|**`FADROMA_BUILD_IMAGE`**          |**Docker image tag.** image to run|
|**`FADROMA_BUILD_PODMAN`**         |**Boolean.** whether to use podman instead of docker|
|**`FADROMA_BUILD_QUIET`**          |**Boolean.** less log output|
|**`FADROMA_BUILD_RAW`**            |**Boolean.** run the build script in the current environment instead of container|
|**`FADROMA_BUILD_SCRIPT`**         |**Path to script.** build implementation|
|**`FADROMA_BUILD_STATE`**          |**Path to directory.** Checksums of compiled contracts by version (default: `wasm`)|
|**`FADROMA_BUILD_VERBOSE`**        |**Boolean.** more log output|
|**`FADROMA_DEPLOY_STATE`**         |**Path to directory.** Receipts of instantiated (deployed) contracts (default: `state/deployments.csv`)|
|**`FADROMA_DEVNET_CHAIN_ID`**      |**string**: chain ID (set to reconnect to existing devnet)|
|**`FADROMA_DEVNET_HOST`**          |**string**: hostname where the devnet is running|
|**`FADROMA_DEVNET_KEEP_RUNNING`**  |**boolean**: don't pause the container when your script exits|
|**`FADROMA_DEVNET_PLATFORM`**      |**string**: what kind of devnet to instantiate (e.g. `scrt_1.9`)|
|**`FADROMA_DEVNET_PORT`**          |**string**: port on which to connect to the devnet|
|**`FADROMA_DEVNET_REMOVE_ON_EXIT`**|**boolean**: automatically remove the container and state when your script exits|
|**`FADROMA_DOCKER`**               |**Either host:port pair or path to socket.** non-default docker socket address (default: `/var/run/docker.sock`)|
|**`FADROMA_PROJECT`**              |**Path to directory.** root of project|
|**`FADROMA_PROJECT`**              |**Path to script.** Project command entrypoint (default: `ops.ts`)|
|**`FADROMA_REBUILD`**              |**Boolean.** builds always run, artifact cache is ignored|
|**`FADROMA_ROOT`**                 |**Path to directory.** Root directory of project (default: current working directory)|
|**`FADROMA_UPLOAD_STATE`**         |**Path to directory.** Receipts of uploaded contracts (default: `state/uploads.csv`)|
