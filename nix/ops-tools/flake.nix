{
  description = "OPS tools flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flakeCompat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };
  };

  outputs = {
    self,
    nixpkgs,
    flakeCompat,
    ...
  }: let
    commit = self.shortRev or "dirty";
    date = self.lastModifiedDate or self.lastModified or "19700101";
    version = "0.0.2+${builtins.substring 0 8 date}.${commit}";

    maintainers = import ../maintainers-list.nix;

    supportedSystems = nixpkgs.lib.systems.flakeExposed;
    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

    opsPackages = [
      "git"
      "go"
      "jq"
      "yq"
      "kubectl"
      "kubectx"
      "kustomize"
      "k9s"
      "kubernetes-helm"
      "helmfile"
      "ansible"
      "terraform"
    ];

    # Function to check if a packages are available
    # It return 2 lists:
    # The first one is the list of all packages that are present in the repository
    # The second one is the list of all packages that are not present in the repository
    checkPackages = {
      repo,
      pkgsToInstall,
    }: let
      isAvailable = pkg: builtins.hasAttr pkg repo;
      availablePackages = builtins.filter isAvailable pkgsToInstall;
      missingPackages = builtins.filter (pkg: !isAvailable pkg) pkgsToInstall;
    in {
      availablePackages = availablePackages;
      missingPackages = missingPackages;
    };

    # Create the appropriate symlink for the system
    getSymlink = {
      system,
      repo,
      unfree ? false,
      options ? {},
      pkgsToInstall,
    }: let
      # Import the repository with the appropriate arguments
      # Ensure that if repo has nixpkgs as input, it follows the flake's nixpkgs
      importArgs =
        {
          inherit system;
          config.allowUnfree = unfree;
        }
        // (
          if builtins.hasAttr "nixpkgs" repo.inputs
          then {inputs.nixpkgs.follows = "nixpkgs";}
          else {}
        );

      pkgs = import repo importArgs;

      checkedPackages = checkPackages {
        repo = pkgs;
        pkgsToInstall = pkgsToInstall;
      };

      # For all the packages that are available, create a symlink
      # It should use the list of strings to get the package from the repository
      paths = builtins.map (pkg: pkgs.${pkg}) checkedPackages.availablePackages;
    in {
      symlink = pkgs.symlinkJoin (options // {paths = paths;});
      missingPackages = checkedPackages.missingPackages;
      availablePackages = checkedPackages.availablePackages;
    };
  in rec {
    packages = forAllSystems (
      system: let
        name = "ops-tools-${version}";

        # Create a symlink to install all the ops tools
        toolsSymlink = getSymlink {
          system = system;
          repo = nixpkgs;
          unfree = true;
          options = {
            name = name;
            version = version;
            meta = {
              name = name;
              version = version;
              maintainers = [maintainers.guillaume-elambert];
              platforms = supportedSystems;
            };
          };
          pkgsToInstall = opsPackages;
        };
      in rec {
        # Create ops-tools profile that will install the packages using symlink
        ops-tools = let
          toDo = toolsSymlink.symlink;
        in
          if toolsSymlink.missingPackages != []
          then
            builtins.warn ''
              The following packages are missing from the repository for system ${system} (${builtins.length toolsSymlink.missingPackages} missing out of ${builtins.length opsPackages}):
              ${builtins.concatStringsSep "\n\t* " toolsSymlink.missingPackages}
            ''
            toDo
          else builtins.trace "All ${toString (builtins.length opsPackages)} packages are available for system ${system}" toDo;

        default = ops-tools;
      }
    );

    checks = forAllSystems (
      system:
        if builtins.hasAttr system packages
        then packages.${system}
        else null
    );
  };
}
