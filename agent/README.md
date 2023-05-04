<div align="center">

# Fadroma Agent

[![](https://img.shields.io/npm/v/@fadroma/agent?color=%2365b34c&label=%40fadroma%2Fagent&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/agent)

Base layer for isomorphic dAPI clients.

Defines the core operational model and type vocabulary
of the Fadroma dApp framework.

All other NPM packages in the Fadroma ecosystem
build upon this one, and either:

* Provide platform-specific implementations of these abstractions
  (such as an Agent that is specifically for the Secret Network,
  or a Builder that executes builds specifically in a Docker container), or

* Build atop the abstract object model to deliver new features with
  the appropriate degree of cross-platform support.

The `@fadroma/agent` package itself is written in a platform-independent way
(basic [isomorphic JavaScript](https://en.wikipedia.org/wiki/Isomorphic_JavaScript)).
and should contain no Node-specifics or other engine-specific features.

See https://fadroma.tech for more info.

</div>
