#!/usr/bin/env bash
set -aemu
# The Cargo package that contains the contract
Package=$1
Tag=$2
# Switch to non-root user
USER=${USER:-1000}
GROUP=${GROUP:-1000}
groupadd -g$GROUP $GROUP || true
useradd -m -g$GROUP -u$USER build || true
# The local registry is stored in a Docker volume mounted at /usr/local.
# This makes sure it is accessible to non-root users, which is the whole point:
mkdir -p /usr/local/cargo/registry
chown -R $USER /usr/local/cargo/registry
chown $USER /output
# Execute a release build then optimize it with Binaryen
echo "Building $Package as user build ($USER:$GROUP)..."
Output=`echo "$Package" | tr '-' '_'`
su build -c "env RUSTFLAGS='-C link-arg=-s' \
  cargo build -p $Package --release --target wasm32-unknown-unknown --locked --verbose \
  && wasm-opt -Oz ./target/wasm32-unknown-unknown/release/$Output.wasm -o /output/$Package@$Tag.wasm \
  && cd /output/ && sha256sum -b *.wasm > checksums.sha256.txt"
