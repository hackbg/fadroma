# `@hackbg/toolbox` contribution guidelines

* Development SHOULD be conducted using [PNPM Workspaces](https://pnpm.io/workspaces).
* Each package MUST contain a `release` script in its `package.json` with one of the following:
  * JavaScript packages: `npm publish --access public`
  * TypeScript packages: `izdatel` (see [`@hackbg/izdatel`](./izdatel))
* Package versions MUST conform to [Semantic Versioning 2.0.0](https://semver.org/).
* A corresponding Git tag MUST be created for every version published to NPM.
