#!/usr/bin/env bash

# EAS Build pre-install hook for monorepo
# This script fixes the working directory for monorepo builds

set -e

echo "📦 Monorepo pre-install hook"
echo "Current directory: $(pwd)"
echo "Listing contents:"
ls -la

# Check if we're in the wrong directory
if [ -d "nora-mobile" ]; then
  echo "✅ Found nora-mobile subdirectory"
  echo "📁 Moving into nora-mobile..."
  cd nora-mobile
  echo "New directory: $(pwd)"
  echo "Listing nora-mobile contents:"
  ls -la

  # Verify package.json exists
  if [ -f "package.json" ]; then
    echo "✅ Found package.json"
  else
    echo "❌ ERROR: package.json not found!"
    exit 1
  fi
else
  echo "✅ Already in correct directory (or standalone app)"
fi

echo "✅ Pre-install hook complete"
