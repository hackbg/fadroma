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
  su build -c "/Scrt_1_2_BuildCheckout.sh"
}

# As a non-root user,
# execute a release build,
# then optimize it with Binaryen.
build () {
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
