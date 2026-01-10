const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withAudioSessionManager(config) {
  // First, copy the files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName);

      // Source files from our modules directory (inside nora-mobile)
      const modulesPath = path.join(projectRoot, 'modules', 'audio-session-manager', 'ios');
      const sourceSwiftFile = path.join(modulesPath, 'AudioSessionManager.swift');
      const sourceObjCFile = path.join(modulesPath, 'AudioSessionManager.m');
      const sourceBridgingHeader = path.join(modulesPath, 'noramonorepo-Bridging-Header.h');

      // Destination in iOS project
      const destSwiftFile = path.join(iosPath, 'AudioSessionManager.swift');
      const destObjCFile = path.join(iosPath, 'AudioSessionManager.m');
      const destBridgingHeader = path.join(iosPath, 'noramonorepo-Bridging-Header.h');

      // Copy Swift file
      if (fs.existsSync(sourceSwiftFile)) {
        fs.copyFileSync(sourceSwiftFile, destSwiftFile);
        console.log('✅ Copied AudioSessionManager.swift to iOS project');
      } else {
        console.warn('⚠️  AudioSessionManager.swift source file not found');
      }

      // Copy Objective-C bridging file
      if (fs.existsSync(sourceObjCFile)) {
        fs.copyFileSync(sourceObjCFile, destObjCFile);
        console.log('✅ Copied AudioSessionManager.m to iOS project');
      } else {
        console.warn('⚠️  AudioSessionManager.m source file not found');
      }

      // Copy bridging header
      if (fs.existsSync(sourceBridgingHeader)) {
        fs.copyFileSync(sourceBridgingHeader, destBridgingHeader);
        console.log('✅ Copied bridging header to iOS project');
      } else {
        console.warn('⚠️  Bridging header source file not found');
      }

      return config;
    },
  ]);

  // Then, add them to the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    // Add files to the project
    if (!xcodeProject.hasFile('AudioSessionManager.swift')) {
      xcodeProject.addSourceFile(
        `${projectName}/AudioSessionManager.swift`,
        {},
        xcodeProject.findPBXGroupKey({ name: projectName })
      );
      console.log('✅ Added AudioSessionManager.swift to Xcode project');
    }

    if (!xcodeProject.hasFile('AudioSessionManager.m')) {
      xcodeProject.addSourceFile(
        `${projectName}/AudioSessionManager.m`,
        {},
        xcodeProject.findPBXGroupKey({ name: projectName })
      );
      console.log('✅ Added AudioSessionManager.m to Xcode project');
    }

    return config;
  });

  return config;
}

module.exports = withAudioSessionManager;
