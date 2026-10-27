import Foundation

public struct ReadingPreferences: Codable, Equatable, Sendable {
  public var speed = 1.0
  public var fontSize = 40.0
  public var lineHeight = 1.6
  public var textWidth = 760.0
  public var alignment = "left"
  public var mirrorHorizontal = false
  public var mirrorVertical = false
  public var focusLine = true
  public var countdownSeconds = 0.0
  public var appearance = "dark"
  public init() {}
}
public struct PortableScript: Codable, Equatable, Sendable {
  public var scriptId: UUID
  public var title: String
  public var body: String
  public var createdAt: String
  public var updatedAt: String
  public var folderId: UUID?
  public var preferences: ReadingPreferences
  public init(title: String, body: String = "") {
    scriptId = UUID()
    self.title = title
    self.body = body
    createdAt = ISO8601DateFormatter().string(from: Date())
    updatedAt = createdAt
    preferences = ReadingPreferences()
  }
}
public struct ScriptBundle: Codable, Sendable {
  public var version = 1
  public var scripts: [PortableScript]
  public init(scripts: [PortableScript]) { self.scripts = scripts }
  public static func decode(_ data: Data) throws -> ScriptBundle {
    guard data.count <= 10_000_000 else { throw ImportError.invalid }
    let bundle = try JSONDecoder().decode(Self.self, from: data)
    guard bundle.version == 1, bundle.scripts.count <= 1000 else { throw ImportError.invalid }
    for s in bundle.scripts {
      let p = s.preferences
      guard s.body.count <= 2_000_000, p.speed.isFinite, (0.5...3).contains(p.speed),
        (16...100).contains(p.fontSize), (1...3).contains(p.lineHeight),
        (280...1600).contains(p.textWidth), ["left", "center", "right"].contains(p.alignment),
        ["dark", "light"].contains(p.appearance), (0...10).contains(p.countdownSeconds)
      else { throw ImportError.invalid }
    }
    return bundle
  }
  public func encode() throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return try encoder.encode(self)
  }
  public enum ImportError: Error { case invalid }
}
public enum Action: String, Codable, CaseIterable, Sendable {
  case play, pause, togglePlay, restart, speedUp, speedDown, setSpeed, previousParagraph,
    nextParagraph, scrollBack, scrollForward
}
public struct Command: Codable, Sendable {
  public let action: Action
  public let value: Double?
  public init(_ action: Action, value: Double? = nil) {
    self.action = action
    self.value = value
  }
  public var valid: Bool {
    action == .setSpeed
      ? value.map { $0.isFinite && (0.5...3).contains($0) } ?? false : value == nil
  }
}
public struct Playback: Sendable {
  public var playing = false
  public var position = 0.0
  public var maximum = 0.0
  public var speed = 1.0
  public var countdown = 0.0
  private var last: Double?
  public init() {}
  @discardableResult public mutating func dispatch(_ c: Command, paragraphs: [Double] = []) -> Bool
  {
    guard c.valid else { return false }
    switch c.action {
    case .play: playing = true
    case .pause: playing = false
    case .togglePlay: playing.toggle()
    case .restart:
      position = 0
      playing = false
      countdown = 0
    case .speedUp: speed = min(3, speed + 0.25)
    case .speedDown: speed = max(0.5, speed - 0.25)
    case .setSpeed: speed = c.value!
    case .previousParagraph: position = paragraphs.last(where: { $0 < position - 2 }) ?? 0
    case .nextParagraph: position = paragraphs.first(where: { $0 > position + 2 }) ?? maximum
    case .scrollBack: position -= 100
    case .scrollForward: position += 100
    }
    position = min(maximum, max(0, position))
    last = nil
    return true
  }
  public mutating func tick(_ now: Double) {
    position = max(0, min(maximum, position))
    let delta = last.map { max(0, min(0.05, now - $0)) } ?? 0
    last = now
    guard playing else { return }
    if countdown > 0 {
      countdown = max(0, countdown - delta)
    } else {
      position = min(maximum, position + 40 * speed * delta)
    }
    if position >= maximum && countdown == 0 { playing = false }
  }
  public mutating func suspend() {
    last = nil
    playing = false
  }
}
public struct HardwareMapping: Codable, Sendable {
  public var keys: [String: Action] = [
    " ": .togglePlay, "up": .speedUp, "down": .speedDown, "left": .previousParagraph,
    "right": .nextParagraph, "r": .restart,
  ]
  public var presets = [0.75, 1.0, 1.25, 1.5, 2.0]
  public init() {}
  public mutating func learn(_ key: String, action: Action) -> Bool {
    guard keys[key] == nil || keys[key] == action else { return false }
    keys[key] = action
    return true
  }
  public func nextPreset(_ speed: Double) -> Double {
    presets.first(where: { $0 > speed }) ?? presets.first ?? 1
  }
}
/// Content-free network envelope; transport must provide authenticated encryption.
public struct ControlRequest: Codable, Sendable {
  public var session: UUID
  public var id: UUID
  public var command: Command
  public init(session: UUID, id: UUID = UUID(), command: Command) {
    self.session = session
    self.id = id
    self.command = command
  }
}
public struct SessionGate: Sendable {
  public var id = UUID()
  public var approved = false
  public var revoked = false
  public var expires: Double
  private var seen = Set<UUID>()
  public init(expires: Double) { self.expires = expires }
  public mutating func accept(_ request: ControlRequest, now: Double) -> Bool {
    guard approved, !revoked, now < expires, request.session == id, request.command.valid,
      seen.count < 72_000, !seen.contains(request.id)
    else { return false }
    seen.insert(request.id)
    return true
  }
}
