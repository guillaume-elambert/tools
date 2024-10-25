# Nix profiles

The folder current folder refers the [`Nix`][nix] configuration to install tools. 

These aims to replace the [linux setup folder][linux_setup].


## OPS tools

This Nix profile installs some usefull tools for OPS:
- `git`
- `go`
- `jq`
- `yq`
- `kubectl`
- `kubectx`
- `kustomize`
- `k9s`
- `kubernetes-helm`
- `helmfile`
- `ansible`
- `terraform`

To install those tools, run the command:
```sh
~ nix profile install ./ops-tools#ops-tools
```


[nix]: https://nix.dev/
[linux_setup]: /linux/bash/setup/