const { spawnSync } = require('child_process');
const path = require('path');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  return result.status === 0;
}

function commandOutput(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8' }).stdout || '';
}

function checkRustToolchain() {
  if (!run('rustup', ['--version'])) {
    console.error('Error: rustup is not installed. Please install rustup and the nightly toolchain.');
    process.exit(1);
  }

  const toolchains = commandOutput('rustup', ['toolchain', 'list']);
  if (!toolchains.includes('nightly')) {
    console.error('Error: Rust nightly toolchain not installed. Run `rustup toolchain install nightly` while online.');
    process.exit(1);
  }
}

function checkCargoDeps(projectDir) {
  const result = spawnSync('cargo', ['+nightly', 'metadata', '--offline'], {
    cwd: projectDir,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    console.error('\nError: Cargo dependencies missing. Run `cargo +nightly fetch` while online to cache dependencies.');
    process.exit(1);
  }
}

function runTests(projectDir) {
  const result = spawnSync('cargo', ['+nightly', 'test', '--offline'], {
    cwd: projectDir,
    stdio: 'inherit'
  });
  process.exit(result.status);
}

const projectDir = path.join(__dirname, '..', 'Polkadot Astranet Education', 'examples', 'demo-contracts');
checkRustToolchain();
checkCargoDeps(projectDir);
runTests(projectDir);
