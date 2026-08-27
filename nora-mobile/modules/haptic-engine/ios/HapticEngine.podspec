require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'HapticEngine'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'UNLICENSED'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { ios: '15.1' }
  s.swift_version  = '5.9'
  # Never actually fetched — Podfile references this pod via `:path`, so
  # CocoaPods reads straight from disk. Podspec `source` only accepts
  # git/http/svn though, so this is just a placeholder to satisfy the schema.
  s.source         = { git: 'https://github.com/local/haptic-engine.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
