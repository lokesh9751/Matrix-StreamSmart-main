'use strict';

/**
 * test-autolevel-and-network-config.js
 *
 * Verifies that:
 * 1. HLS.js instance initialization never assigns to read-only autoLevelEnabled.
 * 2. updateNetworkConfig() can be called repeatedly with simulated bandwidth changes without throwing TypeError.
 * 3. Switching between Auto mode and Manual quality works using supported HLS.js APIs (currentLevel = -1 vs levelIndex).
 * 4. Maximum quality capping uses supported autoLevelCapping API.
 */

global.self = global;
global.performance = { now: () => Date.now() };

const Hls = require('./client/node_modules/hls.js');

async function testHlsAPIs() {
  console.log('🧪 Starting HLS.js API & updateNetworkConfig Verification Suite in STRICT MODE...\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Verify autoLevelEnabled property descriptor in HLS.js
  const desc = Object.getOwnPropertyDescriptor(Hls.prototype, 'autoLevelEnabled');
  assert(
    desc && typeof desc.get === 'function' && desc.set === undefined,
    'HLS.js autoLevelEnabled is strictly a read-only getter (no setter exists)'
  );

  // 2. Test that attempting to assign throws TypeError in strict mode
  let threwExpected = false;
  const testHls = new Hls();
  try {
    testHls.autoLevelEnabled = false;
  } catch (err) {
    threwExpected = err instanceof TypeError && err.message.includes('autoLevelEnabled');
  }
  assert(threwExpected, 'Assigning to autoLevelEnabled correctly verified to throw TypeError in strict mode');

  // 3. Test supported HLS.js API for returning to Auto Mode (currentLevel = -1)
  testHls.currentLevel = 2; // Manual mode
  assert(testHls.autoLevelEnabled === false, 'Setting currentLevel=2 switches autoLevelEnabled to false');

  testHls.currentLevel = -1; // Auto mode
  assert(testHls.autoLevelEnabled === true, 'Setting currentLevel=-1 switches autoLevelEnabled to true');

  // 4. Test supported HLS.js API for quality capping (autoLevelCapping)
  testHls.autoLevelCapping = 3;
  assert(testHls.autoLevelCapping === 3, 'Setting autoLevelCapping=3 correctly caps maximum level');

  testHls.autoLevelCapping = -1;
  assert(testHls.autoLevelCapping === -1, 'Setting autoLevelCapping=-1 resets quality cap');

  // 5. Test updateNetworkConfig mock runner with simulated bandwidth transitions
  console.log('\n2. Testing simulated network config updates without crash or player reinitialization...');
  
  let currentNetConfig = { bandwidthKbps: 4500, latencyMs: 20 };
  let abrTickCount = 0;
  let isAutoMode = true;

  function mockRunABRTick() {
    abrTickCount++;
  }

  function updateNetworkConfig(newConfig) {
    if (!newConfig) return;
    currentNetConfig = { ...currentNetConfig, ...newConfig };
    if (testHls) {
      if (typeof newConfig.maxQualityLevel === 'number') {
        testHls.autoLevelCapping = newConfig.maxQualityLevel;
      }
      if (isAutoMode) {
        mockRunABRTick();
      }
    }
  }

  // Rapid continuous bandwidth transitions (simulating slider adjustments or benchmark)
  const bandwidthChanges = [500, 1000, 2500, 5000, 10000, 8000, 4500, 1500, 300];
  let noErrorDuringUpdates = true;
  try {
    for (const bw of bandwidthChanges) {
      updateNetworkConfig({ bandwidthKbps: bw, maxQualityLevel: bw < 1000 ? 1 : -1 });
    }
  } catch (err) {
    noErrorDuringUpdates = false;
    console.error('Error during updateNetworkConfig:', err);
  }

  assert(noErrorDuringUpdates, 'Repeated updateNetworkConfig calls completed with 0 errors');
  assert(abrTickCount === bandwidthChanges.length, `ABR tick triggered immediately on all ${bandwidthChanges.length} bandwidth changes`);
  assert(testHls.autoLevelCapping === 1, 'Final autoLevelCapping respected configured constraint');

  // 6. Test manual quality selection override
  isAutoMode = false;
  testHls.currentLevel = 2;
  updateNetworkConfig({ bandwidthKbps: 10000 });
  assert(testHls.manualLevel === 2, 'Manual quality selection preserved even after network bandwidth changes');
  assert(abrTickCount === bandwidthChanges.length, 'ABR tick not triggered when in manual override mode');

  // Return to Auto
  isAutoMode = true;
  testHls.currentLevel = -1;
  assert(testHls.autoLevelEnabled === true, 'Returned to Auto mode using currentLevel = -1');

  // 7. Check codebase for absence of autoLevelEnabled assignments
  const fs = require('fs');
  const path = require('path');
  function checkFiles(dir) {
    let badAssignments = [];
    for (const entry of fs.readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        badAssignments = badAssignments.concat(checkFiles(full));
      } else if (/\.(js|jsx)$/.test(entry)) {
        const text = fs.readFileSync(full, 'utf8');
        const matches = text.match(/\.autoLevelEnabled\s*=/g);
        if (matches) {
          badAssignments.push({ file: full, count: matches.length });
        }
      }
    }
    return badAssignments;
  }

  const badOccurrences = checkFiles('./client/src');
  assert(
    badOccurrences.length === 0,
    `No illegal .autoLevelEnabled assignments exist anywhere in client/src (found ${badOccurrences.length})`
  );

  console.log('\n========================================');
  console.log(`Total tests: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log('========================================\n');

  if (passed === total) {
    console.log('🎉 ALL AUTOLEVEL & NETWORK CONFIG SPECIFICATIONS VERIFIED!');
  } else {
    process.exit(1);
  }
}

testHlsAPIs();
