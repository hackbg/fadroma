# Writing client classes

Client classes let you invoke the methods of deployed smart contracts
from JavaScript or TypeScript applications, such as your dApp's frontend.

## Where to write client classes

### Option A: Polyglot packages

It might be tempting to add `package.json` and `MyContract.ts` in your contract's
crate directory, making it a "polyglot package" (Cargo sees a `Cargo.toml` and consumes
the directory as a Rust crate, while Node sees a `package.json` and consumes it as a JavaScript package in the same directory).

This is suitable if your project repository consists of multiple smart contracts that aren't
necessarily going to be used together, e.g. a company-wide monorepo or a public repository of
contracts that can be mixed and matched.

### Option B: Client library

However, if your repository corresponds to a single dApp project consisting of
multiple contracts that will work together, it might be wiser to have a single
API client package containing client classes for your whole smart contract system.

Either way, the setup is the same; if going with Option A, you'll need to do it
once per contract, and if going with Option B, you'll only do it once.

## Package setup (JavaScript)

The first thing any NPM package needs is a `package.json`.

```json
{
  "name": "my-contract-client",
  "type": "module",
  "main": "MyContractClient.js",
  "dependencies": {
    "@fadroma/client": "^3"
  }
}
```

## Package setup (TypeScript)

TypeScript is a strange beast. Even though it has native support for the
`import` and `export` keywords, its support for ES modules is still less
than ideal.

We provide some extra tools for seamless publishing of TypeScript
packages without extra compile steps during development.

```json
{
  "name": "my-contract-client",
  "type": "module",
  "main": "./dist/cjs/MyContractClient.js",
  "exports": {
    "ganesha": "./MyContractClient.ts",
    "require": "./dist/cjs/MyContractClient.js",
    "default": "./dist/esm/MyContractClient.js"
  },
  "dependencies": {
    "@fadroma/client": "^3"
  },
  "devDependencies": {
    "typescript": "^4.7"
  }
}
```

## Writing a client class (JavaScript)

## Writing a client class (TypeScript)
