// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "TeleoCore", platforms: [.macOS(.v14), .iOS(.v17)],
  products: [.library(name: "TeleoCore", targets: ["TeleoCore"])],
  targets: [
    .target(name: "TeleoCore"),
    .target(
      name: "TeleoRemotes", dependencies: ["TeleoCore"], path: "Shared",
      exclude: [
        "Reader.swift", "TeleoApp.swift", "Info.plist", "TeleoUITests.swift", "macOS.entitlements",
        "iOS.entitlements",
      ], sources: ["NativeRemote.swift"]),
    .testTarget(name: "TeleoCoreTests", dependencies: ["TeleoCore"]),
    .testTarget(name: "TeleoRemoteTests", dependencies: ["TeleoRemotes", "TeleoCore"]),
  ])
