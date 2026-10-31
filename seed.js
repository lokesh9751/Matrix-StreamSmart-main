const initDatabase = require('./scripts/initDatabase');

async function runSeed() {
  try {
    await initDatabase({ verbose: true });
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

runSeed();
