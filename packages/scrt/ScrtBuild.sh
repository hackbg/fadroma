#!/usr/bin/env bash
set -aemu

# The Cargo package that contains the contract.
Package=$1

# The commit to build.
Ref=$2

# Create a non-root user.
USER=${USER:-1000}
GROUP=${GROUP:-1000}
groupadd -g$GROUP $GROUP || true
useradd -m -g$GROUP -u$USER build || true

# The local registry is stored in a Docker volume mounted at /usr/local.
# This makes sure it is accessible to non-root users.
mkdir -p /usr/local/cargo/registry
chown -R $USER /usr/local/cargo/registry
chown -R $USER /contract
chown $USER /output

# As a non-root user,
# execute a release build,
# then optimize it with Binaryen.
echo "Building $Package..."
cd /contract
Output=`echo "$Package" | tr '-' '_'`
FinalOutput="$Package@$Ref.wasm"
su build -c "env RUSTFLAGS='-C link-arg=-s' \
  cargo build -p $Package --release --target wasm32-unknown-unknown --locked --verbose \
  && wasm-opt -Oz ./target/wasm32-unknown-unknown/release/$Output.wasm -o /output/$FinalOutput \
  && cd /output/ && sha256sum -b $FinalOutput > $FinalOutput.sha256"

