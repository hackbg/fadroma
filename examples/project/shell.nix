{ pkgs ? import <nixpkgs> {}, ... }: let name = "my-project"; in pkgs.mkShell {
  inherit name;
  nativeBuildInputs = with pkgs; [ git nodejs nodePackages_latest.pnpm rustup ];
  shellHook = ''
    export PS1="$PS1[${name}] "
    export PATH="$PATH:$HOME/.cargo/bin:${./.}/node_modules/.bin"
  '';
}