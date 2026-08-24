#!/bin/bash
# ==========================================================
# Run this LOCALLY (on your laptop) to create a deploy key
# for GitHub Actions → VPS SSH authentication.
#
# Usage: bash scripts/generate-deploy-key.sh
# ==========================================================

KEY_NAME="brisk_deploy_key"

echo "Generating ED25519 SSH key pair for GitHub Actions deploy..."
ssh-keygen -t ed25519 -f "$HOME/.ssh/$KEY_NAME" -C "github-actions-brisk-deploy" -N ""

echo ""
echo "============================================"
echo " PRIVATE KEY  →  paste into GitHub Secret"
echo " Name: VPS_SSH_KEY"
echo "============================================"
cat "$HOME/.ssh/${KEY_NAME}"

echo ""
echo "============================================"
echo " PUBLIC KEY  →  paste into VPS authorized_keys"
echo " Run on VPS: echo '<below>' >> ~/.ssh/authorized_keys"
echo "============================================"
cat "$HOME/.ssh/${KEY_NAME}.pub"

echo ""
echo "Done. Keys saved to ~/.ssh/$KEY_NAME and ~/.ssh/${KEY_NAME}.pub"
