#!/bin/bash

SCRIPT_DIR=$(dirname $(realpath $0))

# Copy all the files in bin to /usr/local/bin
for file in ${SCRIPT_DIR}/bin/*; do
    sudo cp -f $file /usr/local/bin
done

# Run the script to install brew
${SCRIPT_DIR}/brew.sh

source ~/.bashrc