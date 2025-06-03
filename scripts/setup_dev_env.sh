#!/usr/bin/env bash
set -e

# Ensure npm is installed
if command -v npm >/dev/null 2>&1; then
  echo "Installing Node dependencies with npm ci..."
  npm ci
else
  echo "Error: npm is not installed. Please install Node.js and npm." >&2
  exit 1
fi

# Install rustup if missing
if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup not found. Installing..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi

# Install nightly toolchain and wasm target
rustup toolchain install nightly -y
rustup target add wasm32-unknown-unknown --toolchain nightly

# Install cargo-contract
cargo install cargo-contract --force

# Cache Rust dependencies if the demo contracts project exists
DEMO_DIR="Polkadot Astranet Education/examples/demo-contracts"
if [ -f "$DEMO_DIR/Cargo.toml" ]; then
  echo "Caching Rust dependencies for demo contracts..."
  (cd "$DEMO_DIR" && cargo +nightly fetch)
fi

echo "Development environment setup complete."
