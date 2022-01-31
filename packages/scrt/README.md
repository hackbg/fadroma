# Fadroma Ops for Secret Network

## About `PatchedSigningCosmWasmClient_*`

SecretJS ~0.16-0.17 might experience
intermittent breakage with the default
broadcast mode and total with the non-default.
These classes provide a workaround. (Todo link)

* remark from code comment, todo review

```
  /** This assumes broadcastMode is set to BroadcastMode.Sync
    * (which it is, via the constructor of the base ScrtAgentJS class).
    *
    * This, in turn, assumes the logs array is empty and just a tx hash is returned.
    * The tx hash is then queried to get the full transaction result -
    * or, if the transaction didn't actually commit, to retry it. */
```
