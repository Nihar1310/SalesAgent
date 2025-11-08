#!/bin/bash
set -e

echo "Installing client dependencies..."
cd client

# Clean up
echo "Cleaning up old files..."
rm -rf node_modules package-lock.json

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Set npm registry explicitly
echo "Setting npm registry..."
npm config set registry https://registry.npmjs.org/

# Install with specific flags
echo "Installing dependencies..."
npm install --no-audit --no-fund --prefer-offline || npm install --no-audit --no-fund

echo "Dependencies installed successfully!"


