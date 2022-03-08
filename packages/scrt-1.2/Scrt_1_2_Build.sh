#!/usr/bin/env bash
set -aem
Crate=$1
Ref=$2
CARGO_NET_GIT_FETCH_WITH_CLI=true
CARGO_TERM_VERBOSE=true
CARGO_HTTP_TIMEOUT=240
LOCKED=
Temp=/tmp/fadroma-build
if [ -z "${Ref+empty}" ]; then
  BuildDir="$Temp/$Ref"
  echo "Building $Crate from $Ref in $BuildDir"
  mkdir -p "$BuildDir"
  cp -rT "$Workspace" "$BuildDir"
  cd "$BuildDir"
  echo "Cleaning untracked files..."
  git stash -u
  git reset --hard --recurse-submodules
  git clean -f -d -x
  echo "Checking out $Ref in $BuildDir..."
  git checkout "$Ref"
  echo "Preparing submodules..."
  git submodule update --init --recursive
else
  echo "Building $Crate from working tree..."
fi
git log -1

# Create a non-root user.
USER=${USER:-1000}
GROUP=${GROUP:-1000}
groupadd -g$GROUP $GROUP || true
useradd -m -g$GROUP -u$USER build || true

# The local registry is stored in a Docker volume mounted at /usr/local.
# This makes sure it is accessible to non-root users.
mkdir -p /usr/local/cargo/registry
chown -R $USER /usr/local/cargo/registry
chown -R $USER /src
chown $USER /output

# As a non-root user,
# execute a release build,
# then optimize it with Binaryen.
echo "Building $Crate..."
cd /src
Output=`echo "$Crate" | tr '-' '_'`
FinalOutput="$Crate@$Ref.wasm"
LOCKED=
su build -c "env RUSTFLAGS='-C link-arg=-s' \
  cargo build -p $Crate --release --target wasm32-unknown-unknown $LOCKED --verbose \
  && wasm-opt -Oz ./target/wasm32-unknown-unknown/release/$Output.wasm -o /output/$FinalOutput \
  && cd /output/ && sha256sum -b $FinalOutput > $FinalOutput.sha256"
