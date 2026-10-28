import Network
import TeleoCore
import XCTest

@testable import TeleoRemotes

final class TransportTests: XCTestCase {
  @MainActor func testRealTLSPSKApprovalACKAndRevoke() async throws {
    let host = NativeRemote()
    let phone = NativeRemote()
    defer {
      host.stop()
      phone.stop()
    }
    var playback = Playback()
    playback.maximum = 1000
    host.onCommand = { command in
      playback.dispatch(command)
      return playback
    }
    host.host(advertise: false)
    try await wait { host.listenerPort != nil }
    let invitation = try JSONDecoder().decode(
      LANInvitation.self, from: XCTUnwrap(Data(base64Encoded: host.invitation)))
    phone.connect(
      invitation, endpoint: .hostPort(host: "::1", port: try XCTUnwrap(host.listenerPort)))
    try await wait("approval: host=\(host.status), phone=\(phone.status)") { host.approval }
    XCTAssertFalse(playback.playing)
    host.approve()
    try await wait { phone.status == "Connected" }
    phone.command(.play)
    try await wait { phone.ack?.playing == true }
    XCTAssertTrue(playback.playing)
    phone.command(.speedUp)
    try await wait { phone.ack?.speed == 1.1 }
    host.stop()
    try await wait { phone.status.contains("Disconnected") }
    XCTAssertTrue(playback.playing)
  }
  @MainActor func testReplacementSessionSurvivesOldConnectionCallbacks() async throws {
    let host = NativeRemote(), phone = NativeRemote()
    defer { host.stop(); phone.stop() }
    host.host(advertise: false)
    for _ in 0..<3 {
      try await wait { host.listenerPort != nil }
      let invitation = try JSONDecoder().decode(LANInvitation.self, from: XCTUnwrap(Data(base64Encoded: host.invitation)))
      phone.connect(invitation, endpoint: .hostPort(host: "::1", port: try XCTUnwrap(host.listenerPort)))
      try await wait { host.approval }
      host.approve()
      try await wait { phone.status == "Connected" }
      phone.stop()
      // Cancelled receive/state callbacks run later on MainActor, after the new listener starts.
      host.host(advertise: false)
      try await Task.sleep(for: .milliseconds(150))
      XCTAssertFalse(host.invitation.isEmpty)
    }
  }
  @MainActor func testWrongPSKCannotEnroll() async throws {
    let host = NativeRemote()
    let phone = NativeRemote()
    defer {
      host.stop()
      phone.stop()
    }
    host.host(advertise: false)
    try await wait { host.listenerPort != nil }
    var i = try JSONDecoder().decode(
      LANInvitation.self, from: XCTUnwrap(Data(base64Encoded: host.invitation)))
    i.key = Data(repeating: 42, count: 32)
    phone.connect(i, endpoint: .hostPort(host: "::1", port: try XCTUnwrap(host.listenerPort)))
    try await wait("Wrong PSK must fail authentication") {
      phone.status.contains("failed") || phone.status.contains("Disconnected")
        || phone.status.contains("timed out")
    }
    XCTAssertFalse(host.approval)
    XCTAssertNotEqual(phone.status, "Connected")
  }
  @MainActor private func wait(
    _ label: @autoclosure () -> String = "", _ condition: @MainActor () -> Bool
  ) async throws {
    for _ in 0..<220 {
      if condition() { return }
      try await Task.sleep(for: .milliseconds(50))
    }
    XCTFail("Transport condition timed out: \(label())")
    throw NSError(domain: "TeleoTests", code: 1)
  }
}
