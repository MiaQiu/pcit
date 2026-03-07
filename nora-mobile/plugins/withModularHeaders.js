const { withPodfile } = require('@expo/config-plugins');

/**
 * Plugin to add use_modular_headers! to the Podfile
 * This is required for Firebase Swift pods to work with their dependencies
 * Also adds post_install hook to fix module map issues
 */
const withModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    let podfileContent = config.modResults.contents;

    // Check if use_modular_headers! is already present
    if (!podfileContent.includes('use_modular_headers!')) {
      // Add use_modular_headers! right after use_expo_modules!
      podfileContent = podfileContent.replace(
        /use_expo_modules!/g,
        `use_expo_modules!\n  use_modular_headers!`
      );
    }

    // Always replace post_install block using a greedy match to end-of-file,
    // so stray 'end' lines from previous runs are also removed.
    const postInstallHook = `
  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )

    # Fix for module map file issues with use_modular_headers!
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['USE_HEADERMAP'] = 'YES'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end`;

    // Greedy [\s\S]* consumes everything from post_install through the end of the file,
    // replacing it with a clean block regardless of what was there before.
    podfileContent = podfileContent.replace(
      /\n  post_install do \|installer\|[\s\S]*/,
      '\n' + postInstallHook.trim() + '\nend\n'
    );

    config.modResults.contents = podfileContent;
    return config;
  });
};

module.exports = withModularHeaders;
