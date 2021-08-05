# Fadroma Public Beta

## Value proposal
A portable development environment improves
the accessibility and reliability of interacting
with WASM-based blockchains.
A toolkit of reusable smart contract primitives
makes it easier to build and deploy smart contracts,
thus advancing the technological state of the WASM
blockchain ecosystem, and thus its economic viability.

## Objective
Provide a unified development experience
for Cosmos-based smart contracts,
throughout code, terminal and GUI.

## Feature roadmap

### Delivery

* **TODO:** Publish JS packages to NPM
* **TODO:** Publish Rust crates to Cargo
* **WIP:** Install the whole toolkit with `nix-shell https://fadroma.tech/nix`

### GUI
* [ ] Package as Electron and Web app, posslbly other platforms
      with corresponding capabilities 
* [ ] Embed [Monaco](https://github.com/microsoft/monaco-editor)-based editor
      with targeted IDE utilities to provide a familiar text editing experience.
      Becoming an IDE is not a goal for Fadroma, however well-provisioned fields
      for inputing code snippets can be useful in different contexts.
* [ ] Automatically generate a unified admin dashboard containing
      documentation, monitoring tools, deployment and admin actions,
      cronjobs, to be used as main project deliverable
* [ ] Reliably start/stop localnet from GUI and CLI - aim to become GUI for node operators
    * [ ] need to mock out Dockerode
* [ ] Transaction explorer for arbitrary instance of supported chain
    * [ ] Maybe embed an existing one?
    * [ ] `secretcli q tx` and `secretcli q compute tx` in the same view
    * [ ] platform and connection selector

### Contract development and testing
* [ ] View rich test reports, allow tests to be re-ran/edited from GUI
* [ ] View test coverage reports
* [ ] Render diagrams from docs and unit tests, including inter-contract communication
* [ ] Use profiling-instrumented builds in JS-based integration tests
* [ ] Gas profiling - calculate cost of each opcode without having to wait for block timings. Compile a crypto-less `cosmwasm-vm` if necessary.
* [ ] Improvements to `cargo doc` (really `rustc`) to support literate programming (pull apart doc comments from attribute macros)

### Contract operation
* [ ] Drop compiled contract blobs into the GUI and have them expose their methods.
      Pass them each other's addresses to test inter-contract communication in a sandbox.
* [ ] Time travel: rewind/force next block
* [ ] Spawn terminals with different secretcli configs
* [ ] Drag and drop multisig transaction signer
  * [ ] Support system keystore in the same way as `secretcli` does
        to securely sign transactions with the user's mainnet/testnet private keys

### Language
* [ ] Write contracts with the same syntax for different backing versions of CosmWasm (Secret Network - 0.10.1, Terra - 0.15.0), saving the user the repeated generics and the effort to figure out storage and ownership
    * [ ] `struct Contract` 
    * [ ] Storage field primitive
    * [ ] Attribute macro for canonize/humanize

### Distribution
* [ ] **Versioning scheme:** calendar versions for editions (21.08),
      and semantic versioning for all components.
      API stability (v1.0.0 of components) planned for subsequent edition
* [ ] Publish up-to-date **documentation** at https://fadroma.tech
* [ ] Decide **contribution policy and governance mechanisms**
      that allow the community to have their needs met while
      preserving Hack.bg's prerogative on the design and direction of the project
* [ ] Decide **license**. My proposal: dual AGPLv3 + paid commercial,
      in order to make all improvements to the codebase public yet
      allow commecrial users to keep their source code private.
