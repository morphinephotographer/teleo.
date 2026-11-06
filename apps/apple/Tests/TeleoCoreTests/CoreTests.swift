import SwiftData
import XCTest

@testable import TeleoCore

final class CoreTests: XCTestCase {
  func testPausedLayoutShrink() {
    var playback = Playback()
    playback.maximum = 900
    playback.position = 850
    playback.maximum = 100
    playback.tick(0)
    XCTAssertEqual(playback.position, 100)
  }
  func testLongSessionKeepsReplayProtection() {
    var gate = SessionGate(expires: 3600)
    gate.approved = true
    let first = ControlRequest(session: gate.id, command: Command(.play))
    XCTAssertTrue(gate.accept(first, now: 1))
    for _ in 0..<1001 {
      XCTAssertTrue(gate.accept(ControlRequest(session: gate.id, command: Command(.pause)), now: 100))
    }
    XCTAssertFalse(gate.accept(first, now: 101))
  }
  func testExactTenthsAndLegacySpeed() {
    var p = Playback()
    p.maximum = 1000; p.position = 320; p.countdown = 2
    p.dispatch(Command(.speedUp)); XCTAssertEqual(p.speed, 1.1)
    for _ in 0..<9 { p.dispatch(Command(.speedUp)) }; XCTAssertEqual(p.speed, 2)
    for _ in 0..<10 { p.dispatch(Command(.speedDown)) }; XCTAssertEqual(p.speed, 1)
    XCTAssertEqual(p.position, 320); XCTAssertEqual(p.countdown, 2); XCTAssertFalse(p.playing)
    p.speed = 0.75; XCTAssertEqual(speedLabel(p.speed), "0.75")
    p.dispatch(Command(.speedUp)); XCTAssertEqual(p.speed, 0.8)
    p.speed = 0.85; p.dispatch(Command(.speedDown)); XCTAssertEqual(p.speed, 0.8)
    XCTAssertEqual(speedLabel(1), "1.0")
    XCTAssertEqual(steppedSpeed(2.9, direction: 1, minimum: 0.55, maximum: 2.95), 2.9)
    p.countdown = 1; p.playing = true; p.tick(0); p.tick(0.02)
    p.dispatch(Command(.speedUp)); p.tick(0.04); XCTAssertEqual(p.countdown, 0.96, accuracy: 0.000001)
  }
  func testEnlargedReadingFontRoundtrip() throws {
    var script = PortableScript(title: "Large text", body: "Read from a distance")
    script.preferences.fontSize = 120
    let data = try ScriptBundle(scripts: [script]).encode()
    XCTAssertEqual(try ScriptBundle.decode(data).scripts[0].preferences.fontSize, 120)
    script.preferences.fontSize = 121
    let invalid = try ScriptBundle(scripts: [script]).encode()
    XCTAssertThrowsError(try ScriptBundle.decode(invalid))
  }
  func testCanonicalFixture() throws {
    var root = URL(fileURLWithPath: #filePath)
    for _ in 0..<5 { root.deleteLastPathComponent() }
    let data = try Data(contentsOf: root.appendingPathComponent("contracts/script-v1.json"))
    let bundle = try ScriptBundle.decode(data)
    XCTAssertEqual(bundle.scripts[0].body, "Your words. 🌍\n\nВаш темп.\nمرحبا\n")
    XCTAssertEqual(bundle.scripts[0].preferences.speed, 1.25)
  }
  func testClock() {
    var p = Playback()
    p.maximum = 1000
    p.dispatch(Command(.play))
    p.tick(0)
    p.tick(0.02)
    XCTAssertEqual(p.position, 0.8, accuracy: 0.001)
    p.tick(100)
    XCTAssertEqual(p.position, 2.8, accuracy: 0.001)
    p.dispatch(Command(.pause))
    let pos = p.position
    p.tick(101)
    XCTAssertEqual(pos, p.position)
    p.dispatch(Command(.play))
    p.tick(1000)
    XCTAssertEqual(pos, p.position)
  }
  func testCommands() {
    var p = Playback()
    p.maximum = 200
    p.dispatch(Command(.play))
    p.dispatch(Command(.play))
    XCTAssertTrue(p.playing)
    XCTAssertFalse(p.dispatch(Command(.setSpeed, value: .nan)))
    for _ in 0..<30 { p.dispatch(Command(.speedUp)) }
    XCTAssertEqual(p.speed, 3)
    p.dispatch(Command(.nextParagraph), paragraphs: [0, 100, 150])
    XCTAssertEqual(p.position, 100)
    p.dispatch(Command(.previousParagraph), paragraphs: [0, 100, 150])
    XCTAssertEqual(p.position, 0)
  }
  func testEndAndCountdown() {
    var p = Playback()
    p.maximum = 1
    p.countdown = 0.05
    p.dispatch(Command(.play))
    p.tick(0)
    p.tick(0.05)
    XCTAssertEqual(p.position, 0)
    p.tick(0.1)
    XCTAssertFalse(p.playing)
    XCTAssertEqual(p.position, 1)
  }
  func testPortableUnicode() throws {
    let s = PortableScript(title: "Привіт 👋", body: "أهلا\n\nТекст\n")
    let data = try ScriptBundle(scripts: [s]).encode()
    XCTAssertEqual(try ScriptBundle.decode(data).scripts, [s])
    XCTAssertThrowsError(try ScriptBundle.decode(Data("{\"version\":2,\"scripts\":[]}".utf8)))
  }
  func testMapping() {
    var m = HardwareMapping()
    XCTAssertFalse(m.learn(" ", action: .restart))
    XCTAssertTrue(m.learn("a", action: .play))
    XCTAssertEqual(m.nextPreset(2), 0.75)
  }
  func testSessionReplayRevokeExpiry() {
    var gate = SessionGate(expires: 100)
    let req = ControlRequest(session: gate.id, command: Command(.play))
    XCTAssertFalse(gate.accept(req, now: 1))
    gate.approved = true
    XCTAssertTrue(gate.accept(req, now: 1))
    XCTAssertFalse(gate.accept(req, now: 2))
    XCTAssertFalse(gate.accept(ControlRequest(session: UUID(), command: Command(.play)), now: 2))
    gate.revoked = true
    XCTAssertFalse(gate.accept(ControlRequest(session: gate.id, command: Command(.pause)), now: 3))
    gate.revoked = false
    XCTAssertFalse(
      gate.accept(ControlRequest(session: gate.id, command: Command(.pause)), now: 101))
  }
  @MainActor func testStorageReopenRevisionsTombstone() throws {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: dir) }
    let url = dir.appendingPathComponent("test.store")
    do {
      let c = try Store.make(url: url)
      let ctx = ModelContext(c)
      let s = ScriptRecord(title: "Test", body: "Текст\n🌍")
      ctx.insert(s)
      try Store.checkpoint(s, context: ctx)
      s.body = "changed"
      try Store.checkpoint(s, context: ctx)
      s.deletedAt = Date()
      try ctx.save()
    }
    let c = try Store.make(url: url)
    let ctx = ModelContext(c)
    let scripts = try ctx.fetch(FetchDescriptor<ScriptRecord>())
    XCTAssertEqual(scripts.count, 1)
    XCTAssertNotNil(scripts[0].deletedAt)
    XCTAssertEqual(scripts[0].body, "changed")
    XCTAssertEqual(try ctx.fetchCount(FetchDescriptor<RevisionRecord>()), 2)
  }
}
