#!/usr/bin/env bash
set -aem

WORKSPACE=/src
BUILD_DIR="$WORKSPACE"
CRATE=$1
REF=$2

fix_user_and_group () {
  USER=${USER:-1000}
  GROUP=${GROUP:-1000}
  # Create a non-root user.
  groupadd -g$GROUP $GROUP || true
  useradd -m -g$GROUP -u$USER build || true
  # The local registry is stored in a Docker volume mounted at /usr/local.
  # This makes sure it is accessible to non-root users.
  mkdir -p /usr/local/cargo/registry
  chown -R $USER /usr/local/cargo/registry
  chown -R $USER /src
  chown $USER /output
}

checkout_ref () {
  TEMP=/tmp/fadroma-build-$CRATE
  export BUILD_DIR="$TEMP/$REF"
  echo "Building $CRATE from $REF in $BUILD_DIR"
  mkdir -p "$BUILD_DIR"
  cp -rT "$WORKSPACE" "$BUILD_DIR"
  cd "$BUILD_DIR"
  echo "Cleaning untracked files..."
  git stash -u
  git reset --hard --recurse-submodules
  git clean -f -d -x
  echo "Checking out $REF in $BUILD_DIR..."
  git checkout "$REF"
  echo "Preparing submodules..."
  git submodule update --init --recursive
  git log -1
}

# As a non-root user,
# execute a release build,
# then optimize it with Binaryen.
build () {
  OUTPUT=`echo "$CRATE" | tr '-' '_'`
  REF_SANITIZED=`echo "$REF" | tr '/' '_' `
  FINAL_OUTPUT="$CRATE@$REF_SANITIZED.wasm"
  cd /src
  mkdir -p /tmp/target
  chmod ugo+rwx /tmp/target
  su build -c "cd $BUILD_DIR && /Scrt_1_2_BuildCommand.sh"
}

fix_user_and_group

if [ "$REF" == "HEAD" ]; then
  echo "Building $CRATE from working tree..."
else
  checkout_ref
fi

build
