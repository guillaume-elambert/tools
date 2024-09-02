# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

# If not running interactively, don't do anything
case $- in
*i*) ;;
*) return ;;
esac

# don't put duplicate lines or lines starting with space in the history.
# See bash(1) for more options
HISTCONTROL=ignoreboth

# append to the history file, don't overwrite it
shopt -s histappend

# for setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=1000
HISTFILESIZE=2000

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

# If set, the pattern "**" used in a pathname expansion context will
# match all files and zero or more directories and subdirectories.
#shopt -s globstar

# make less more friendly for non-text input files, see lesspipe(1)
#[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# set variable identifying the chroot you work in (used in the prompt below)
if [ -z "${debian_chroot:-}" ] && [ -r /etc/debian_chroot ]; then
    debian_chroot=$(cat /etc/debian_chroot)
fi

# set a fancy prompt (non-color, unless we know we "want" color)
case "$TERM" in
xterm-color | *-256color) color_prompt=yes ;;
esac

# uncomment for a colored prompt, if the terminal has the capability; turned
# off by default to not distract the user: the focus in a terminal window
# should be on the output of commands, not on the prompt
#force_color_prompt=yes

if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
        # We have color support; assume it's compliant with Ecma-48
        # (ISO/IEC-6429). (Lack of such support is extremely rare, and such
        # a case would tend to support setf rather than setaf.)
        color_prompt=yes
    else
        color_prompt=
    fi
fi

if [ "$color_prompt" = yes ]; then
    PS1='${debian_chroot:+($debian_chroot)}\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
else
    PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
unset color_prompt force_color_prompt

# If this is an xterm set the title to user@host:dir
case "$TERM" in
xterm* | rxvt*)
    PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1"
    ;;
*) ;;
esac

# enable color support of ls and also add handy aliases
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    #alias dir='dir --color=auto'
    #alias vdir='vdir --color=auto'

    #alias grep='grep --color=auto'
    #alias fgrep='fgrep --color=auto'
    #alias egrep='egrep --color=auto'
fi

# Alias definitions.
# You may want to put all your additions into a separate file like
# ~/.bash_aliases, instead of adding them here directly.
# See /usr/share/doc/bash-doc/examples in the bash-doc package.

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# enable programmable completion features (you don't need to enable
# this, if it's already enabled in /etc/bash.bashrc and /etc/profile
# sources /etc/bash.bashrc).
if ! shopt -oq posix; then
    if [ -f /usr/share/bash-completion/bash_completion ]; then
        . /usr/share/bash-completion/bash_completion
    elif [ -f /etc/bash_completion ]; then
        . /etc/bash_completion
    fi
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"                   # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" # This loads nvm bash_completion

function command_not_found_handle {
    if [ -x "$(command -v ${1}.exe)" ]; then
        ${1}.exe "${@:2}"
    else
        echo "command_not_found_handle - Command not found: $1"
        return 127
    fi
}

PATH=$PATH:~/bin
export PATH
export PATHEXT=".COM:.EXE:.BAT:.CMD:.VBS:.VBE:.JS:.JSE:.WSF:.WSH:.MSC:.PY:.PYW"

export KUBECONFIG=/home/gelambert/.kube/config
export KUBE_EDITOR="code -w"
export EDITOR="code"

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

# Setup atuin
[[ -f ~/.bash-preexec.sh ]] && source ~/.bash-preexec.sh
[[ -f ~/.local/share/blesh/ble.sh ]] && source ~/.local/share/blesh/ble.sh
eval "$(atuin init bash)"

# Source each files in folders
function source_files_in_folder() {
    local folder=$1
    for file in $folder/*; do
        if [ -f $file ]; then
            source $file
        fi
    done
}

# Aliases
source <(kubectl completion bash)
source_files_in_folder ~/.bash_completion.d
source_files_in_folder ~/.bash_alias

PROJECTS_PATH=/mnt/c/projects
OPS_PROJECTS_PATH=$PROJECTS_PATH/ops
DEV_PROJECTS_PATH=$PROJECTS_PATH/dev

alias projects='cd $PROJECTS_PATH'
alias ops='cd $PROJECTS_PATH/ops'
alias dev='cd $PROJECTS_PATH/dev'

generate_subfolders_aliases $OPS_PROJECTS_PATH
generate_subfolders_aliases $DEV_PROJECTS_PATH

# Force to open windows code if file is on windows filesystem
ORIGINAL_CODE_PATH=$(which code)
function force_windows_code() {
    # Get all the parameters passed to the `code` command
    local params=("$@")

    for i in "${!params[@]}"; do
        # If it is a directory or a file, convert it to a Windows path
        if [ -d "${params[$i]}" ] || [ -f "${params[$i]}" ]; then
            params[$i]=$(wslpath -w "${params[$i]}")
        fi
    done
    cmd.exe /c code "${params[@]}" 2>/dev/null || "${ORIGINAL_CODE_PATH}" "$@"
}
alias code=force_windows_code
