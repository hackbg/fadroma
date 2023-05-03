* Fadroma Web Dashboard
  * Show list of deployment and contracts in selected deployment
  * Render generated and written documentation from project and dependencies
  * Allow deployments and operations to be run from the browser
  * Render source of smart contracts but don't allow editing for now
  * Embedded instance of official transaction explorer
  * `secretcli q tx` and `secretcli q compute tx` in the same view
  * Platform and connection selector
  * Drop compiled contract blobs into GUI and have them expose their methods.
    Pass them each other's addresses to test inter-contract communication in a sandbox.
  * Drag and drop multisig transaction signer
    * Support system keystore in the same way as `secretcli` does
      to securely sign transactions with the user's mainnet/testnet private keys
* Fadroma Test Track
  * View and publish rich test and coverage reports, allow tests to be re-ran/edited from GUI
  * Render interaction diagrams from logs of test runs to display inter-contract communication
  * Use profiling-instrumented builds in JS-based integration tests to get full-stack coverage
  * Gas profiling - calculate cost of each opcode without having to wait for block timings. Compile a crypto-less `cosmwasm-vm` if necessary.
  * See if literate programming can be extended to `cargo doc`/`rustc`...
    * separate doc comments from attribute macros in the parser?
  * Time travel: rewind/force next block
  * Spawn terminals with different secretcli configs for hammer tuning
