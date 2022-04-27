#!/usr/bin/env bash
PHASE=$1
CRATE=$2
REF=$3
OUTPUT=$4

: "${PHASE?Need to set PHASE}"
: "${CRATE?Need to set CRATE}"
: "${REF?Need to set REF}"
: "${OUTPUT?Need to set OUTPUT}"

WORKSPACE=/src
TEMP=/tmp/fadroma-build-$CRATE
REF_SANITIZED="$(echo "$REF" | tr '/' '_')"
BUILD_DIR="$TEMP/$REF_SANITIZED"
TEMP=/tmp/fadroma-build-$CRATE
USER=${USER:-1000}
GROUP=${GROUP:-1000}

phase1 () {
  set -aem
  echo "Build phase 1: Preparing source repository for $CRATE@$REF"
  # Create a non-root user.
  groupadd -g$GROUP $GROUP || true
  useradd -m -g$GROUP -u$USER build || true
  # The local registry is stored in a Docker volume mounted at /usr/local.
  # This makes sure it is accessible to non-root users.
  umask 0000
  mkdir -p "$BUILD_DIR" /tmp/target /usr/local/cargo/registry
  umask 0022
  chown -R $USER /usr/local/cargo/registry
  chown -R $USER /src
  chown $USER /output
  # Copy the source into the build dir
  git --version
  echo "Cleaning untracked files..."
  cp -rT "$WORKSPACE" "$BUILD_DIR"
  cd "$BUILD_DIR"
  git stash -u
  git reset --hard --recurse-submodules
  git clean -f -d -x
  echo "Checking out $REF in $BUILD_DIR..."
  git checkout "$REF"
  echo "Preparing submodules..."
  git submodule update --init --recursive
  git log -1
  # As a non-root user,
  # execute a release build,
  # then optimize it with Binaryen.
  echo "Building $CRATE from $REF in $(pwd)"
  su build -c "bash $0 phase2 $CRATE $REF"
}

phase2 () {
  echo "Build phase 2: Compiling and optimizing contract for $CRATE@$REF"
  set -aemu

  cargo --version
  rustc --version
  wasm-opt --version
  sha256sum --version | head -n1

  export RUSTFLAGS='-C link-arg=-s'
  export CARGO_TARGET_DIR='/tmp/target'
  export PLATFORM='wasm32-unknown-unknown'
  export LOCKED='' # '--locked'
  cargo build -p $CRATE --release --target $PLATFORM $LOCKED --verbose
  echo 'Build complete'

  export OUTPUT="$(echo "$CRATE" | tr '-' '_').wasm"
  export COMPILED="$CARGO_TARGET_DIR/$PLATFORM/release/$OUTPUT"
  export REF_SANITIZED="$(echo "$REF" | tr '/' '_')"
  export TAGGED_OUTPUT="$CRATE@$REF_SANITIZED.wasm"
  export OPTIMIZED="$WORKSPACE/artifacts/$TAGGED_OUTPUT"
  wasm-opt -Oz $COMPILED -o $OPTIMIZED
  echo 'Optimization complete'

  export CHECKSUM="$OPTIMIZED.sha256"
  sha256sum -b $OPTIMIZED > $CHECKSUM
  echo 'Checksum calculated:'

  cat $CHECKSUM
}

$PHASE
