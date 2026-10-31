/**
 * config/cloudinary.js – Cloudinary v2 SDK Configuration & Validation
 *
 * Configures Cloudinary for chunked video uploads, asset management,
 * and automated HLS manifest (.m3u8) eager transformations.
 */

const path = require('path');
// Ensure environment variables are loaded regardless of import source
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;

// Clean and sanitize environment variables (strip quotes, whitespace, or carriage returns)
const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim().replace(/^["']|["']$/g, '');
const apiKey    = (process.env.CLOUDINARY_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim().replace(/^["']|["']$/g, '');

const isPlaceholderSecret = !apiSecret || apiSecret === 'your_cloudinary_api_secret' || apiSecret === 'streamsmart_secret';
const isPlaceholderKey    = !apiKey || apiKey === 'your_cloudinary_api_key' || apiKey === '123456789012345';
const isPlaceholderCloud  = !cloudName || cloudName === 'your_cloudinary_cloud_name' || cloudName === 'streamsmart_demo';

const isConfigured = !isPlaceholderSecret && !isPlaceholderKey && !isPlaceholderCloud;

if (!isConfigured) {
  console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('⚠️ [Cloudinary Configuration Warning]');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (isPlaceholderSecret) {
    console.error('❌ CLOUDINARY_API_SECRET is missing or set to placeholder value!');
  }
  if (isPlaceholderKey) {
    console.error('❌ CLOUDINARY_API_KEY is missing or set to placeholder value!');
  }
  if (isPlaceholderCloud) {
    console.error('❌ CLOUDINARY_CLOUD_NAME is missing or set to placeholder value!');
  }
  console.error('👉 Uploading videos to Cloudinary will fail with "Invalid Signature"');
  console.error('   until your real credentials are added to the .env file:');
  console.error('   1. Log into: https://console.cloudinary.com');
  console.error('   2. Copy: Cloud Name, API Key, and API Secret');
  console.error('   3. Update your .env file with those values (no spaces/quotes).');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key:    apiKey,
  api_secret: apiSecret,
  secure:     true
});

// Attach credentials validation helper for routes
cloudinary.credentials = {
  isConfigured,
  cloudName,
  apiKey,
  apiSecret: isPlaceholderSecret ? null : apiSecret
};

module.exports = cloudinary;
