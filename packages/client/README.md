# Fadroma Client

Base layer for isomorphic contract clients.

1. User selects chain by instantiating a `Chain` object.
2. User authorizes agent by obtaining an `Agent` instance from the `Chain`.
3. User interacts with contract by obtaining an instance of the
   appropriate `Client` subclass from the authorized `Agent`.
