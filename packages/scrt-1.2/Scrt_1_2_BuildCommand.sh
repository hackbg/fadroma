#!/usr/bin/env bash
set -aemu

cargo --version
rustc --version
wasm-opt --version
sha256sum --version | head -n1

: "${CRATE?Need to set CRATE}"
: "${REF?Need to set REF}"

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
export OPTIMIZED="artifacts/$TAGGED_OUTPUT"
wasm-opt -Oz $COMPILED -o $OPTIMIZED
echo 'Optimization complete'

export CHECKSUM="$OPTIMIZED_PATH.sha256"
cd `dirname $OPTIMIZED`
sha256sum -b `basename $OPTIMIZED` > $CHECKSUM
echo 'Checksum calculated:'

cat $CHECKSUM
