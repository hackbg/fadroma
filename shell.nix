#!/usr/bin/env nix-shell
{pkgs?import<nixpkgs>{}}:pkgs.mkShell{name="fadroma";nativeBuildInputs=[
  pkgs.bitcoind
  pkgs.cloc
];}
