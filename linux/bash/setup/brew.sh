#!/bin/bash

set -u

abort() {
  printf "%s\n" "$@" >&2
  exit 1
}

# Fail fast with a concise message when not using bash
# Single brackets are needed here for POSIX compatibility
# shellcheck disable=SC2292
if [ -z "${BASH_VERSION:-}" ]
then
  abort "Bash is required to interpret this script."
fi

# First check OS.
OS="$(uname)"
if [[ "${OS}" == "Linux" ]]; then
    HOMEBREW_ON_LINUX=1
elif [[ "${OS}" == "Darwin" ]]; then
    HOMEBREW_ON_MACOS=1
else
    abort "Homebrew is only supported on macOS and Linux."
fi

# If the script is running with sudo, exit
if [[ "${EUID}" -eq 0 ]]; then
    abort "This script should not be run with sudo."
fi

installBrew() {
    if [[ ! -x "$(command -v curl)" ]]; then
        abort "curl is required to install Homebrew."
    fi

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ -n "${HOMEBREW_ON_MACOS-}" ]]; then
        UNAME_MACHINE="$(/usr/bin/uname -m)"

        if [[ "${UNAME_MACHINE}" == "arm64" ]]; then
            # On ARM macOS, this script installs to /opt/homebrew only
            HOMEBREW_PREFIX="/opt/homebrew"
        else
            # On Intel macOS, this script installs to /usr/local only
            HOMEBREW_PREFIX="/usr/local"
        fi
    else
        # On Linux, this script installs to /home/linuxbrew/.linuxbrew only
        HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
    fi
    BREW_EXEC="${HOMEBREW_PREFIX}/bin/brew"
    
    # Check that the file exists
    if [[ ! -f "${BREW_EXEC}" ]]; then
        abort "Homebrew installation failed."
    fi

    echo "eval \$(${BREW_EXEC} shellenv)" >>~/.bashrc
    source ~/.bashrc
    
    if [[ -n "${HOMEBREW_ON_LINUX-}" ]]; then
        if [[ -x "$(command -v apt-get)" ]]; then
            sudo apt-get update
            sudo apt-get install build-essential -y || true
        elif [[ -x "$(command -v yum)" ]]; then
            sudo yum check-update
            sudo yum groupinstall 'Development Tools' -y || true
        elif [[ -x "$(command -v pacman)" ]]; then
            sudo pacman -Sy
            sudo pacman -S base-devel --noconfirm || true
        elif [[ -x "$(command -v apk)" ]]; then
            sudo apk update
            sudo apk add build-base --no-cache || true
        fi

        brew install gcc || true
    fi
}

backupBashrc() {
    # Add the date to the backup file
    cp ~/.bashrc ~/.bashrc.bak.$(date +%Y-%m-%d_%H-%M-%S)
}

SCRIPT_DIR=$(dirname $(realpath $0))

# Check if brew is installed
if [[ ! -x "$(command -v brew)" ]]; then
    echo "brew could not be found, installing..."
    installBrew
fi

declare -A NO_CONFIG_PACKAGES=(
    "curl"
    "gnupg"
    "jq"
    "yq"
    "go"
    "kubectx"
    "kustomize"
    "helm"
    "minikube"
    "kubectx"
    "ansible"
    "terraform"
    "code-cli"
    "oh-my-posh"
    "clipboard"
)

declare -A PACKAGES_WITH_CONFIG=(
    ["bash-preexec"]=`cat <<'EOF'
    echo "[ -f $HOMEBREW_PREFIX/etc/profile.d/bash-preexec.sh ] && . $HOMEBREW_PREFIX/etc/profile.d/bash-preexec.sh" >> ~/.bashrc
EOF
`
    ["atuin"]=`cat <<'EOF'
    echo "[ -f $HOMEBREW_PREFIX/etc/profile.d/bash-preexec.sh ] && . $HOMEBREW_PREFIX/etc/profile.d/bash-preexec.sh" >> ~/.bashrc
    echo "eval $(atuin init bash)" >> ~/.bashrc
EOF
`
    ["bash-completion@2"]=`
        cat <<'EOF'
    cp -R ${SCRIPT_DIR}/bash_completion.d/ ~/.bash_completion.d/
    echo "[[ -r \"$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh\" ]] && . \"$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh\" >> ~/.bashrc"
    # Load all the completion scripts
    for f in ~/.bash_completion.d/*; do
        echo "[ -f \"$f\" ] && . \"$f\"" >> ~/.bashrc
    done
EOF
`
    ["kubectl"]=`cat <<'EOF'
    echo "source <(kubectl completion bash)" >> ~/.bashrc
EOF
`
    ["k9s"]=`cat <<'EOF'
    echo "export KUBECONFIG=\"~/.kube/config\"" >> ~/.bashrc
    echo "export KUBE_EDITOR=\"code -w\""
    echo "export EDITOR=\"code\"" >> ~/.bashrc
    echo "source <(k9s completion bash)" >> ~/.bashrc
EOF
`
    ["pyenv"]=`cat <<'EOF'
    echo "export PYENV_ROOT=\"$HOME/.pyenv\"" >> ~/.bashrc
    echo "[[ -d $PYENV_ROOT/bin ]] && export PATH=\"$PYENV_ROOT/bin:\$PATH\"" >> ~/.bashrc
    echo "eval \"\$(pyenv init --path)\"" >> ~/.bashrc
    source ~/.bashrc
    latestPython=$(pyenv install --list | grep -P '\s+\d+\.\d+\.\d+$' | sort -V | tail -n 1 | tr -d ' ')
    pyenv install $latestPython
    pyenv global latestPython
EOF
`
    ["git"]=`cat <<'EOF'
    echo "Configuring Git..."
    # Ask for the username and email
    read -p "Enter your Git username: " git_username
    read -p "Enter your Git email: " git_email
    git config --global user.name "$git_username"
    git config --global user.email "$git_email"

    git config --global core.editor=code --wait
    git config --global diff.tool=default-difftool
    git config --global difftool.default-difftool.cmd=code --wait --diff $LOCAL $REMOTE
    git config --global merge.tool=code
    git config --global mergetool.code.cmd=code --wait --merge $REMOTE $LOCAL $BASE $MERGED

    # Ask if the user wants to use GPG
    read -p "Do you want to use GPG for signing Git commits? (y/n): " use_gpg
    if [[ $use_gpg =~ ^[Yy]$ ]]; then
        # Check if it is gpg or gpg2
        if command -v gpg2 &>/dev/null; then
            GPG=gpg2
        else
            GPG=gpg
        fi

        # Generate a new GPG key
        $GPG --full-generate-key
        $GPG --list-secret-keys --keyid-format LONG
        read -p "Enter the GPG key ID: " gpg_key_id
        # while the GPG key ID is not valid
        while ! $GPG --list-secret-keys --keyid-format LONG $gpg_key_id &>/dev/null; do
            read -p "Invalid GPG key ID. Please enter a valid GPG key ID: " gpg_key_id
        done

        git config --global commit.gpgsign true
        git config --global user.signingkey $gpg_key_id

        echo "GPG key has been added to Git."
        echo "Please remember to add the GPG key to your Git provider."
        $GPG --armor --export $gpg_key_id
    fi
EOF
`
)

backupBashrc

for package in ${NO_CONFIG_PACKAGES[@]}; do
    if ! command -v $package &>/dev/null; then
        echo "$package could not be found, installing..."
        brew install $package || true
    fi
done

for package in ${!PACKAGES_WITH_CONFIG[@]}; do
    if ! command -v $package &>/dev/null; then
        echo "$package could not be found, installing..."
        brew install $package
        eval "${PACKAGES_WITH_CONFIG[$package]}"
    fi
done

source ~/.bashrc