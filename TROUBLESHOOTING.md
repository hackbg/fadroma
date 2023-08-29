# Troubleshooting

## Devnet

### `ECONNRESET`

If you can see the devnet container in `docker ps`,
but Fadroma fails to connect to it with an `ECONNRESET`
message, it might be the case that routing to the container
is borked.

For example, the routing used by Mullvad VPN is known to
conflict with the routing used by Docker. **If you use Mullvad
and get `ECONNRESET`, try enabling the *"Local network sharing"*
option in Mullvad's settings.**

From the CLI, you can do that with:

```sh
mullvad lan set allow
```
