#!/usr/bin/env nix-shell
{pkgs?import<nixpkgs>{}}: let

  # Define a Nix shell.
  sh = name: nativeBuildInputs: opts:  pkgs.mkShell ({ inherit name nativeBuildInputs; } // opts);

  # Fetch a source from GitHub.
  gh = owner: repo: rev: sha256: pkgs.fetchFromGitHub { inherit owner repo rev sha256; };

  # Build a package.
  pkg = p: (pkgs.callPackage p {});

  # Build a Rust package.
  rs = p: (pkgs.rustPlatform.buildRustPackage p);

  # Build a Rust package from GitHub.
  #
  # Examples:
  #
  #   (rs-gh "starkware-bitcoin" "simply" "3e1d0589"
  #     "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="
  #     "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")
  #
  #   (rs-gh "drager" "wasm-pack" "f28cf3e7"
  #     "sha256-Zv4WFv/lVySs6qfBC/hnZLe6T5Ako/HEDzvP/be4dgM="
  #     "sha256-Dw/Kz4YO/RMRTlUsW+5im3cVmqC80dMVjLc0+Ge536o=")
  #
  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {
    inherit pname version cargoHash;
    src = gh owner pname version sha256;
    nativeBuildInputs = [pkgs.pkg-config];
    PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
    doCheck = false;
  });

  # Override an existing package's attributes
  #
  # Example:
  #
  #   (over pkgs.elements (let hash = "sha256-hqHKH9B6EITwZ4F+YdPJI4n3Z3EeXdPYbzRoNODlThY="; in {
  #     doCheck    = false;
  #     patches    = [];
  #     src        = gh "ElementsProject" "elements" "elements-23.3.1" hash;
  #     version    = "23.3.1";
  #     withGui    = false;
  #     withWallet = true;
  #   }))
  #
  over = pkg: attrs: pkg.overrideAttrs (_: attrs);

in sh "fadroma" [

  # JS/TS tooling
  pkgs.deno pkgs.nodejs_24 pkgs.pnpm

  # WASM tooling
  pkgs.lld pkgs.binaryen pkgs.python3

  # Code analysis
  pkgs.cloc

  # Not used but may become useful in the future:
  # pkgs.emscripten
  # pkgs.bitcoind
  # pkgs.rustPlatform.bindgenHook # Provides correct clang without container?

] {

  # Any extra environment variables to set?
  #
  # CC     = "${pkgs.llvmPackages.clang-unwrapped}/bin/clang";
  # CC_wasm32_unknown_unknown     = "${pkgs.llvmPackages.clang-unwrapped}/bin/clang";
  # CFLAGS_wasm32_unknown_unknown = "-I ${pkgs.llvmPackages.libclang.lib}/lib/clang/include/";

}
