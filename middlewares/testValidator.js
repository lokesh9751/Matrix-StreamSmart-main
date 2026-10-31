/**
 * testValidator.js – Pre-run configuration validation middleware
 * Blocks invalid network parameters before a benchmark session is created.
 */

module.exports = function validateTestConfig(req, res, next) {
  const { bandwidthKbps, latencyMs, cacheHitProb, streamUrl } = req.body;
  const errors = [];

  // Validate HLS stream URL
  if (!streamUrl || !streamUrl.includes('.m3u8')) {
    errors.push('Missing or invalid HLS manifest URL (must be a .m3u8 file).');
  }

  // Validate bandwidth
  const bw = parseInt(bandwidthKbps);
  if (isNaN(bw) || bw < 100 || bw > 100000) {
    errors.push('Simulated bandwidth must be between 100 Kbps and 100,000 Kbps.');
  }

  // Validate latency
  const lat = parseInt(latencyMs);
  if (isNaN(lat) || lat < 0 || lat > 5000) {
    errors.push('Simulated latency must be between 0 ms and 5,000 ms.');
  }

  // Validate cache hit probability
  const prob = parseFloat(cacheHitProb);
  if (isNaN(prob) || prob < 0 || prob > 1) {
    errors.push('Edge cache hit probability must be between 0.00 and 1.00.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ valid: false, errors });
  }

  next();
};

