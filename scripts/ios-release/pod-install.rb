# CocoaPods records evaluated local podspec JSON checksums in Podfile.lock.
# These two Expo specs embed their checkout's absolute path in that JSON.
require 'cocoapods'
require 'digest'
require 'json'
require 'uri'

module CyberBlessPodInstall
  NAMES = %w[ExpoModulesCore ExpoWidgets].freeze
  CHECKOUT_TOKEN = '/__cyber_bless_checkout__'.freeze

  def self.checksum_patch(repo)
    # Match a whole directory prefix, including its slash. URI escaping matters
    # for encoded tag directories such as tag-ios%2Fv1.0.0-build.19.
    prefixes = [repo + '/', URI::DEFAULT_PARSER.escape(repo + '/')]
      .flat_map { |prefix| [prefix, JSON.generate(prefix)[1...-1]] }
      .uniq.sort_by { |prefix| -prefix.length }.freeze

    Module.new do
      define_method(:checksum) do
        return super() unless root? && NAMES.include?(name) && !defined_in_file.nil?
        expected = File.join(repo, 'apps/mobile-expo/ios/Pods/Local Podspecs', "#{name}.podspec.json")
        return super() unless File.expand_path(defined_in_file.to_s) == expected

        # Keep CocoaPods' raw-file hashing, root delegation and memoization.
        # Only the checkout location is canonicalized; all other bytes count.
        @checksum ||= begin
          bytes = File.read(defined_in_file)
          prefixes.each { |prefix| bytes = bytes.gsub(prefix, CHECKOUT_TOKEN + '/') }
          Digest::SHA1.hexdigest(bytes).encode(Encoding::UTF_8)
        end
      end
    end
  end

  def self.run(arguments)
    repo = File.realpath(File.join(__dir__, '../..'))
    Pod::Specification.prepend(checksum_patch(repo))
    Pod::Command.run(arguments)
  end
end

CyberBlessPodInstall.run(ARGV) if $PROGRAM_NAME == __FILE__
