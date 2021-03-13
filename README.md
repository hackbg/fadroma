# fadroma

CosmWasm utility library.

* `rs/` contains the `contract!` macro, which bulldozes all the repetitive
  boilerplate code around writing CosmWasm contracts, and lets you
  define the skeleton of your actual contract logic in a terse syntax.

* `js/` contains, among other things, the `SecretNetwork.withSchema`
  class constructor, which allows contract methods (as specified by the
  JSON schemas exported by the contracts) to be called from JS again
  with the minimum amount of boilerplate code.
