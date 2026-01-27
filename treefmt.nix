{ ... }:
{
  projectRootFile = "flake.nix";
  programs = {
    nixfmt.enable = true;
    prettier.enable = true;
  };

  settings.global.excludes = [
    ".github/workflows/*"
  ];
}
