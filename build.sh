#!/bin/bash

# Install dependencies
echo "Installing root dependencies..."
npm install

echo "Installing client dependencies..."
cd client
npm install

echo "Current directory: $(pwd)"
echo "Listing contents:"
ls -la

echo "Building React app..."
npm run build

echo "Build complete. Output directory contents:"
ls -la build/
