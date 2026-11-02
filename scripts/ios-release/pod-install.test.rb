require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require 'digest'
require 'json'
require 'uri'
require 'cocoapods'
require_relative 'pod-install'

class CanonicalPodChecksumTest < Minitest::Test
  def setup
    @temporary = Dir.mktmpdir('cyber-bless-checksums-')
  end

  def teardown
    FileUtils.remove_entry(@temporary)
  end

  def specification(repo, name: 'ExpoWidgets', contents: nil, file: nil)
    file ||= File.join(repo, 'apps/mobile-expo/ios/Pods/Local Podspecs', "#{name}.podspec.json")
    FileUtils.mkdir_p(File.dirname(file))
    contents ||= JSON.pretty_generate({ name: name, version: '1.0.0', script_phases: [{ script: "source=\"#{repo}/node_modules/package/bundle\"" }] })
    File.write(file, contents)
    spec = Pod::Specification.from_json(contents, file)
    spec.defined_in_file = Pathname.new(file)
    spec.singleton_class.prepend(CyberBlessPodInstall.checksum_patch(repo))
    spec
  end

  def test_checkout_paths_and_uri_escaped_paths_have_identical_checksums
    checksums = ['plain', 'tag-ios%2Fv1.0.0-build.19', 'space and %2F'].map do |directory|
      repo = File.join(@temporary, directory)
      body = JSON.pretty_generate({ name: 'ExpoModulesCore', version: '57.0.24', source: { http: "file://#{URI::DEFAULT_PARSER.escape(repo + '/') }node_modules/core.tar.gz" }, prepare_command: "tar xzf \"#{repo}/node_modules/core.tar.gz\"" })
      specification(repo, name: 'ExpoModulesCore', contents: body).checksum
    end
    assert_equal 1, checksums.uniq.length
  end

  def test_non_path_changes_to_affected_specs_change_the_checksum
    repo = File.join(@temporary, 'repo')
    ['ExpoModulesCore', 'ExpoWidgets'].each do |name|
      original = specification(repo, name: name).checksum
      changed = specification(repo, name: name, contents: JSON.pretty_generate({ name: name, version: '2.0.0', dependencies: { 'ChangedDependency' => ['~> 2'] } })).checksum
      refute_equal original, changed
    end
  end

  def test_lookalike_checkout_prefixes_and_outside_paths_are_not_normalized
    repo = File.join(@temporary, 'repo')
    base = JSON.pretty_generate({ name: 'ExpoWidgets', version: '1.0.0', description: "#{repo}-other/source /outside/source" })
    assert_equal Digest::SHA1.hexdigest(base), specification(repo, contents: base).checksum
  end

  def test_other_pod_names_keep_upstream_raw_file_checksums
    repo = File.join(@temporary, 'repo')
    spec = specification(repo, name: 'UnrelatedPod')
    assert_equal Digest::SHA1.hexdigest(File.read(spec.defined_in_file)), spec.checksum
  end

  def test_affected_pod_outside_its_saved_json_keeps_upstream_checksum
    repo = File.join(@temporary, 'repo')
    spec = specification(repo, file: File.join(@temporary, 'outside', 'ExpoWidgets.podspec.json'))
    assert_equal Digest::SHA1.hexdigest(File.read(spec.defined_in_file)), spec.checksum
  end

  def test_nil_definition_root_delegation_utf8_and_memoization_match_upstream
    root = Pod::Specification.new do |spec|
      spec.name = 'ExpoWidgets'
      spec.version = '1.0.0'
      spec.subspec('Child') { |child| child.source_files = '*.swift' }
    end
    root.singleton_class.prepend(CyberBlessPodInstall.checksum_patch(@temporary))
    assert_nil root.checksum
    assert_nil root.subspec_by_name('ExpoWidgets/Child').checksum

    spec = specification(File.join(@temporary, 'repo'))
    checksum = spec.checksum
    assert_equal Encoding::UTF_8, checksum.encoding
    File.write(spec.defined_in_file, '{}')
    assert_equal checksum, spec.checksum
    child = spec.subspec('Child') { |subspec| subspec.source_files = '*.swift' }
    assert_equal checksum, child.checksum
  end
end
