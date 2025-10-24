#!/usr/bin/env bash
set -e

echo "Building Hexo documentation site..."

# Clean previous build
npx hexo clean

# Generate the site
npx hexo generate

# Copy to build/docs-site for GitHub Pages compatibility
rm -rf build/docs-site
mkdir -p build
cp -r public build/docs-site

echo "✅ Hexo site built successfully!"
echo "Output: build/docs-site/"
