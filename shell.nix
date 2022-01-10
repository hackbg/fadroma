{
  arsenal ? (builtins.fetchGit {
    url = "git@github.com:hackbg/arsenal.git";
    rev = "5e88ce440d433f3bdce88a1f10c54bbdda84ea54";
    ref = "main";
  }),
  pkgs ? import <nixpkgs> { overlays = [ (import arsenal) ]; },
  ...
}: pkgs.mkShell {
  name = "hackbg-fadroma-dev";
  buildInputs = with pkgs; [
    hackbg.js
    hackbg.neovim
    hackbg.rust
    hackbg.util
    act
  ];
  shellHook = ''
    export PS1='\n\e[0;35mғᴀᴅʀᴏᴍᴀ ⬢ \w\e[0m '
  '';
}
