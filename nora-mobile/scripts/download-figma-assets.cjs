/**
 * Download Figma Assets Script
 * Downloads all image assets from Figma and saves them locally
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Asset URLs from Figma
const assets = [
  {
    name: 'dragon-purple.png',
    url: 'https://www.figma.com/api/mcp/asset/b27c081d-0f45-4450-be7b-3311f886bedd',
    description: 'Purple dragon image for lesson cards'
  },
  {
    name: 'ellipse-77.png',
    url: 'https://www.figma.com/api/mcp/asset/a34b4bbb-df5f-463c-bd39-874a95cd4649',
    description: 'Bottom decorative ellipse'
  },
  {
    name: 'ellipse-78.png',
    url: 'https://www.figma.com/api/mcp/asset/1abb9f81-184b-401b-9f5e-1ff8f5431681',
    description: 'Top decorative ellipse'
  },
  {
    name: 'arrow-icon-1.png',
    url: 'https://www.figma.com/api/mcp/asset/75d7347f-32f3-4f18-a2dc-028f0a1ced7c',
    description: 'Arrow icon for CTA button (part 1)'
  },
  {
    name: 'arrow-icon-2.png',
    url: 'https://www.figma.com/api/mcp/asset/f905d1bb-360d-4c4e-bc95-c96480d250a6',
    description: 'Arrow icon for CTA button (part 2)'
  }
];

// Assets directory
const assetsDir = path.join(__dirname, '..', 'assets', 'images');

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log(`Created directory: ${assetsDir}`);
}

/**
 * Download a file from URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

/**
 * Main download function
 */
async function downloadAssets() {
  console.log('Starting Figma assets download...\n');

  for (const asset of assets) {
    const filepath = path.join(assetsDir, asset.name);

    try {
      console.log(`Downloading: ${asset.name}`);
      console.log(`  Description: ${asset.description}`);
      console.log(`  URL: ${asset.url}`);

      await downloadFile(asset.url, filepath);

      console.log(`  ✓ Saved to: ${filepath}\n`);
    } catch (error) {
      console.error(`  ✗ Error downloading ${asset.name}: ${error.message}\n`);
    }
  }

  console.log('Download complete!');
  console.log(`\nAssets saved to: ${assetsDir}`);
}

// Run the download
downloadAssets().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
