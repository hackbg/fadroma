#!/usr/bin/env nix-shell
{pkgs?import<nixpkgs>{}}: let
  # Define Nix shell.
  sh = name: nativeBuildInputs:
    pkgs.mkShell { inherit name nativeBuildInputs; };
  # Fetch source from GitHub.
  gh = owner: repo: rev: sha256:
    pkgs.fetchFromGitHub { inherit owner repo rev sha256; };
  # Build package.
  pkg = p: (pkgs.callPackage p {});
  # Build Rust package.
  rs = p: (pkgs.rustPlatform.buildRustPackage p);
  # Build Rust package from GitHub.
  rs-gh = owner: pname: version: sha256: cargoHash: (rs rec {
    inherit pname version cargoHash;
    src = gh owner pname version sha256;
    nativeBuildInputs = [pkgs.pkg-config];
    PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
  });

in sh "fadroma" [
  pkgs.bitcoind
  pkgs.cloc
  (rs-gh "starkware-bitcoin" "simply" "3e1d0589"
    "sha256-EKfeEsr/sG/SorT2GK/ovMvI2QaoTMZ1wehbCcSjEmQ="
    "sha256-N2i5IJtKU1iPkpBaX90LgA7gw8B3n+K5hbByJOMRV3o=")
]
