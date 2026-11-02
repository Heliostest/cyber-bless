require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'BlessingRuntime'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = 'Helio'
  s.homepage = 'https://github.com/Heliostest/cyber-bless'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/Heliostest/cyber-bless.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
