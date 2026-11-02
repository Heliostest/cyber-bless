import ExpoModulesCore
import Foundation
import StoreKit

public final class BlessingRuntimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BlessingRuntime")

    AsyncFunction("getAppInfoAsync") { () -> [String: String] in
      return [
        "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown",
        "buildNumber": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
      ]
    }

    AsyncFunction("isTestFlightAsync") { () async -> Bool in
      do {
        let result = try await AppTransaction.shared
        guard case .verified(let transaction) = result,
              transaction.bundleID == Bundle.main.bundleIdentifier else {
          return false
        }
        // App Store installations report production, even for the same uploaded build.
        return transaction.environment == .sandbox
      } catch {
        return false
      }
    }
  }
}
