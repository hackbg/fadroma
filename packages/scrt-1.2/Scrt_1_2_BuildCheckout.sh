#!/usr/bin/env bash
set -aemu

git --version

: "${CRATE?Need to set CRATE}"
: "${REF?Need to set REF}"

TEMP=/tmp/fadroma-build-$CRATE
export BUILD_DIR="$TEMP/$REF"
mkdir -p "$BUILD_DIR"
echo "Building $CRATE from $REF in $BUILD_DIR"

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
