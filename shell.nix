{
  pkgs ? import <nixpkgs> {
    overlays = [
      (import (builtins.fetchTarball
      https://github.com/mozilla/nixpkgs-mozilla/archive/master.tar.gz ))
    ];
  }
}:

pkgs.mkShell {

  name = "fadroma";

  nativeBuildInputs = with pkgs; [
    nodejs-14_x
    yarn
    (rustChannelOfTargets "nightly" "2021-08-04" ["wasm32-unknown-unknown"])
    binaryen
    wabt
    wasm-pack
    wasm-bindgen-cli
  ];

  shellHook = ''
    export RUST_BACKTRACE=1
    export RUSTFLAGS="-Zmacro-backtrace"
    #rustup component add llvm-tools-preview rls rust-analysis rust-src
    export PATH="$PATH:$HOME/.cargo/bin"
  '';

}
