#!/usr/bin/env bash

# EAS Build pre-install hook for monorepo
# This script builds the @nora/core package before mobile app bundling

set -e

echo "📦 Monorepo pre-install hook"
echo "Current directory: $(pwd)"

# Build @nora/core package
echo "🔨 Building @nora/core package..."

if [ -d "packages/nora-core" ]; then
  echo "✅ Found packages/nora-core"
  cd packages/nora-core

  # Install dependencies if needed
  if [ ! -d "node_modules" ]; then
    echo "📦 Installing @nora/core dependencies..."
    npm install
  fi

  # Build the package
  echo "🔨 Running TypeScript build..."
  npm run build

  echo "✅ @nora/core built successfully"

  # List the dist folder to verify
  echo "📁 Dist folder contents:"
  ls -la dist/

  # Go back to root
  cd ../..
else
  echo "⚠️  packages/nora-core not found, skipping build"
fi

echo "✅ Pre-install hook complete"
