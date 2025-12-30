#!/bin/bash
set -e

DEV_USER="${DEV_USER:-node}"

echo "Running post-start initialization..."

# Fix Git signing key path for devcontainer
# The host's signing key path (e.g., /Users/user/.ssh/key) doesn't exist in container
# We need to update it to point to the mounted SSH directory
HOST_KEY=$(git config --global user.signingkey 2>/dev/null)
if [ -n "$HOST_KEY" ]; then
    KEY_NAME=$(basename "$HOST_KEY")
    git config --global user.signingkey "/home/${DEV_USER}/.ssh/$KEY_NAME"
    echo "Git signing key updated from $HOST_KEY to /home/${DEV_USER}/.ssh/$KEY_NAME"
else
    echo "No Git signing key configured, skipping update"
fi

echo "Post-start initialization completed successfully"
