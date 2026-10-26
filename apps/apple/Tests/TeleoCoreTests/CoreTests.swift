import SwiftData
import XCTest

@testable import TeleoCore

final class CoreTests: XCTestCase {
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
