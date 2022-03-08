#!/usr/bin/env bash
set -aemu
CARGO_NET_GIT_FETCH_WITH_CLI=true
CARGO_TERM_VERBOSE=true
CARGO_HTTP_TIMEOUT=240
LOCKED=
Temp=/tmp/fadroma-build
if [ -z "${Ref+empty}" ]; then
  BuildDir="$TmpDir/$Ref"
  echo "Building $Crate from $Ref in $BuildDir"
  mkdir -p "$BuildDir"
  cp -rT "$Workspace" "$BuildDir"
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
/build.sh $Crate $Ref
