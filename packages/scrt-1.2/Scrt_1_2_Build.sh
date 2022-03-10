#!/usr/bin/env bash
set -aem

Workspace=/src
BuildDir="$Workspace"
Crate=$1
Ref=$2
Output=`echo "$Crate" | tr '-' '_'`
FinalOutput="$Crate@$Ref.wasm"
LOCKED=
CARGO_NET_GIT_FETCH_WITH_CLI=true
CARGO_TERM_VERBOSE=true
CARGO_HTTP_TIMEOUT=240
LOCKED=
USER=${USER:-1000}
GROUP=${GROUP:-1000}
Temp=/tmp/fadroma-build-$Crate

if [ "$Ref" == "HEAD" ]; then
  echo "Building $Crate from working tree..."
else
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
  git log -1
fi

# Create a non-root user.
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
cd /src
mkdir -p /tmp/target
chmod ugo+rwx /tmp/target
su build -c "\
  cd $BuildDir \
  && env RUSTFLAGS='-C link-arg=-s' CARGO_TARGET_DIR=/tmp/target \
    cargo build -p $Crate --release --target wasm32-unknown-unknown $LOCKED --verbose \
  && echo 'Build complete' && pwd && ls -al \
  && wasm-opt -Oz /tmp/target/wasm32-unknown-unknown/release/$Output.wasm -o /output/$FinalOutput \
  && echo 'Optimization complete' \
  && cd /output/ && sha256sum -b $FinalOutput > $FinalOutput.sha256 \
  && echo 'Checksum calculated' && cat $FinalOutput.sha256"
