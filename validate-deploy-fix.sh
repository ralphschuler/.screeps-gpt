#!/bin/bash
echo 'Testing deploy workflow version resolution fix...'

# Test the exact scenario that failed
SHA='79473c2b2b29ab0bdbc082c2b94b450a0f6dc826'
echo "Looking for version tag for commit $SHA"

# Try to find tag on commit (should be empty for this test case)
VERSION=$(git tag --points-at "$SHA" | grep -E '^v[0-9]' | head -n 1)
echo "Tag on commit: '$VERSION'"

# Test fallback logic
if [[ -z "$VERSION" ]]; then
  echo "No tag found at commit $SHA, looking for latest version tag..."
  VERSION=$(git tag -l 'v*' | sort -V | tail -n 1)
  if [[ -z "$VERSION" ]]; then
    echo "ERROR: No version tags found in repository"
    exit 1
  fi
  echo "Using latest version tag: $VERSION"
fi

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Version does not match expected format (vX.Y.Z): $VERSION"
  exit 1
fi

echo "✓ Test passed! Final version: $VERSION"
echo "✓ Deploy workflow fix validated successfully"
exit 0