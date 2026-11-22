// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "TeleoDesktop",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "TeleoDesktop",
            path: "Sources/TeleoDesktop"
        )
    ]
)
