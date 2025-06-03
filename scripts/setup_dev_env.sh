#!/usr/bin/env bash
set -e

echo "🚀 Starting development environment setup..."

# Ensure npm is installed
if command -v npm >/dev/null 2>&1; then
  echo "📦 Installing Node dependencies..."

  if [ -f package-lock.json ]; then
    echo "📦 Found package-lock.json. Using npm ci for clean install..."
    npm ci
  else
    echo "⚠️  package-lock.json not found. Falling back to npm install..."
    npm install
  fi
else
  echo "❌ Error: npm is not installed. Please install Node.js and npm." >&2
  exit 1
fi

# Install rustup if missing
if ! command -v rustup >/dev/null 2>&1; then
  echo "🛠️ rustup not found. Installing..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

# Install nightly toolchain and wasm target
echo "🌙 Installing nightly Rust toolchain and WASM target..."
rustup toolchain install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly

# Install cargo-contract
echo "🔧 Installing cargo-contract CLI..."
cargo install cargo-contract --force

# Cache Rust dependencies if the demo contracts project exists
DEMO_DIR="examples/demo-contracts"
if [ -f "$DEMO_DIR/Cargo.toml" ]; then
  echo "📦 Caching Rust dependencies for demo contracts..."
  (cd "$DEMO_DIR" && cargo +nightly fetch)
else
  echo "⚠️  $DEMO_DIR not found. Skipping Rust dependency caching."
fi

echo "✅ Development environment setup complete."
