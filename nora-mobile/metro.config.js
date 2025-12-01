// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const projectRoot = __dirname;
const projectNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// --- Monorepo Configuration ---
config.projectRoot = projectRoot;
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// --- Force React 18.3.1 Resolution ---
config.resolver.extraNodeModules = {
  'react': path.join(projectNodeModules, 'react'),
  'react-dom': path.join(projectNodeModules, 'react-dom'),
  'react-native': path.join(projectNodeModules, 'react-native'),
};

// Block React canary versions from being bundled
config.resolver.blockList = [
  /node_modules\/.*\/node_modules\/react\//,
  /node_modules\/@expo\/cli\/static\/canary-full\/node_modules\/react\//,
];

module.exports = config;