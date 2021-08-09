{
  arsenal ? (builtins.fetchGit {
    url = "git@github.com:hackbg/arsenal.git";
    rev = "68dba155a4a1c8c036c7cf255728b411a92e0223";
    ref = "refactor-1";
  }),
  pkgs    ? import <nixpkgs> { overlays = [ (import arsenal) ]; },
  ...
}: pkgs.mkShell {
  name = "hackbg-fadroma-dev";
  buildInputs = with pkgs; [
    hackbg.js
    hackbg.neovim
    hackbg.rust
    hackbg.util
    electron_6
  ];
  shellHook = ''
    export PS1='\n\e[0;35mғᴀᴅʀᴏᴍᴀ ⬢ \w\e[0m '
    export ELECTRON_RUNTIME='${pkgs.electron_6.out}/bin/electron'
  '';
}
