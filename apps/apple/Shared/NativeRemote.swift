import CryptoKit
import Foundation
import Network
import Security
import SwiftUI

#if canImport(TeleoCore)
  import TeleoCore
#endif

struct LANInvitation: Codable {
  var session: UUID
  var service: String
  var key: Data
  var expires: Date
  var encoded: String { (try? JSONEncoder().encode(self).base64EncodedString()) ?? "" }
}
struct LANAck: Codable {
  var id: UUID
  var playing: Bool
  var speed: Double
  var position: Double
}
/// TLS 1.2 PSK binds possession of the 256-bit invitation to the encrypted session.
/// No permissive certificate verification callback or plaintext fallback.
@MainActor final class NativeRemote: ObservableObject {
  @Published var status = "Disconnected"
  @Published var invitation = ""
  @Published var approval = false
  @Published var nearby: [NWBrowser.Result] = []
  @Published var ack: LANAck?
  var onCommand: ((Command) -> Playback)?
  var listenerPort: NWEndpoint.Port? {
    guard let listener, case .ready = listener.state, let port = listener.port, port.rawValue != 0
    else { return nil }
    return port
  }
  private var listener: NWListener?
  private var browser: NWBrowser?
  private var connection: NWConnection?
  private var gate = SessionGate(expires: 0)
  private var invite: LANInvitation?
  private var buffer = Data()
  private var count = 0
  private var window = Date()
  private var timeout: Task<Void, Never>?
  private var latestRequest: UUID?
  private var heartbeat: Task<Void, Never>?
  private var setupTimeout: Task<Void, Never>?
  private var ackTimeout: Task<Void, Never>?
  private var lastReceived = Date()
  private func parameters(_ invite: LANInvitation) -> NWParameters {
    let tls = NWProtocolTLS.Options()
    sec_protocol_options_set_min_tls_protocol_version(tls.securityProtocolOptions, .TLSv12)
    sec_protocol_options_set_max_tls_protocol_version(tls.securityProtocolOptions, .TLSv12)
    sec_protocol_options_append_tls_ciphersuite(
      tls.securityProtocolOptions,
      tls_ciphersuite_t(rawValue: UInt16(TLS_PSK_WITH_AES_128_GCM_SHA256))!)
    let identity = Data(invite.session.uuidString.utf8)
    let psk = invite.key.withUnsafeBytes { DispatchData(bytes: $0) }
    let id = identity.withUnsafeBytes { DispatchData(bytes: $0) }
    sec_protocol_options_add_pre_shared_key(
      tls.securityProtocolOptions, psk as __DispatchData, id as __DispatchData)
    sec_protocol_options_set_tls_pre_shared_key_identity_hint(
      tls.securityProtocolOptions, id as __DispatchData)
    let p = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
    p.includePeerToPeer = true
    return p
  }
  func host(advertise: Bool = true) {
    stop()
    var bytes = [UInt8](repeating: 0, count: 32)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      status = "Secure random generation failed"
      return
    }
    let id = UUID()
    let i = LANInvitation(
      session: id, service: "teleo-" + id.uuidString.prefix(8), key: Data(bytes),
      expires: Date().addingTimeInterval(120))
    invite = i
    invitation = i.encoded
    gate = SessionGate(expires: Date().addingTimeInterval(3600).timeIntervalSince1970)
    gate.id = id
    do {
      let l = try NWListener(using: parameters(i), on: .any)
      listener = l
      if advertise { l.service = NWListener.Service(name: i.service, type: "_teleo._tcp") }
      l.newConnectionHandler = { [weak self] c in
        Task { @MainActor in
          guard let self, self.gate.id == i.session, self.listener != nil, self.connection == nil, Date() < i.expires else {
            c.cancel()
            return
          }
          self.connection = c
          self.attach(c, host: true)
        }
      }
      l.stateUpdateHandler = { [weak self] state in
        Task { @MainActor in if self?.gate.id == i.session, self?.listener != nil, case .failed = state { self?.status = "Local network unavailable" }
        }
      }
      l.start(queue: .main)
      status = "Waiting for iPhone (120 seconds)"
      timeout = Task {
        try? await Task.sleep(for: .seconds(120))
        if !Task.isCancelled && !gate.approved {
          stop()
          status = "Invitation expired"
        }
      }
    } catch { status = "Cannot start local network listener" }
  }
  func discover() {
    browser?.cancel()
    nearby = []
    let b = NWBrowser(for: .bonjour(type: "_teleo._tcp", domain: nil), using: .tcp)
    browser = b
    b.browseResultsChangedHandler = { [weak self, weak b] results, _ in
      Task { @MainActor in
        guard let self, let b, self.browser === b else { return }
        self.nearby = Array(results)
      }
    }
    b.stateUpdateHandler = { [weak self, weak b] state in
      Task { @MainActor in
        guard let self, let b, self.browser === b else { return }
        if case .failed = state { self.status = "Local network permission denied or unavailable" }
      }
    }
    b.start(queue: .main)
    status = "Finding nearby Mac"
  }
  func join(_ encoded: String) {
    guard let data = Data(base64Encoded: encoded.trimmingCharacters(in: .whitespacesAndNewlines)),
      data.count < 2048, let i = try? JSONDecoder().decode(LANInvitation.self, from: data),
      i.key.count == 32, Date() < i.expires, i.expires.timeIntervalSinceNow <= 125
    else {
      status = "Invalid or expired invitation"
      return
    }
    guard
      let endpoint = nearby.first(where: {
        if case .service(let name, _, _, _) = $0.endpoint { return name == i.service }
        return false
      })?.endpoint
    else {
      status = "Mac not found on this network"
      return
    }
    connect(i, endpoint: endpoint)
  }
  func connect(_ i: LANInvitation, endpoint: NWEndpoint) {
    connection?.cancel()
    invite = i
    gate.id = i.session
    let configuration = parameters(i)
    if case .hostPort = endpoint {
      configuration.includePeerToPeer = false
      configuration.requiredInterfaceType = .loopback
    }
    let c = NWConnection(to: endpoint, using: configuration)
    connection = c
    attach(c, host: false)
    status = "Connecting securely"
  }
  private func attach(_ c: NWConnection, host: Bool) {
    buffer = Data()
    count = 0
    window = Date()
    ack = nil
    latestRequest = nil
    setupTimeout?.cancel()
    setupTimeout = Task {
      do { try await Task.sleep(for: .seconds(8)) } catch { return }
      stop()
      status = "Connection timed out — pair again"
    }
    c.stateUpdateHandler = { [weak self] state in
      Task { @MainActor in
        guard let self, self.connection === c else { return }
        switch state {
        case .ready:
          self.setupTimeout?.cancel()
          if host {
            self.approval = true
            self.status = "iPhone requests control"
          } else {
            self.status = "Waiting for Mac approval"
          }
          self.lastReceived = Date()
          self.startHeartbeat()
          self.receive(c, host: host)
        case .failed(let error):
          self.status = "Connection failed: \(error)"
          self.approval = false
          self.gate.revoked = true
        case .cancelled:
          self.status = "Disconnected — pair again"
          self.approval = false
          self.gate.revoked = true
        case .waiting(let error): self.status = "Network waiting: \(error)"
        default: break
        }
      }
    }
    c.start(queue: .main)
  }
  func approve() {
    guard connection != nil else { return }
    gate.approved = true
    approval = false
    status = "Connected"
    listener?.cancel()
    listener = nil
    invitation = ""
    send(Data("approved\n".utf8))
    timeout?.cancel()
    timeout = Task {
      try? await Task.sleep(for: .seconds(3600))
      if !Task.isCancelled { stop() }
    }
  }
  func command(_ action: Action) {
    guard status == "Connected", let i = invite else { return }
    let request = ControlRequest(session: i.session, command: Command(action))
    latestRequest = request.id
    ackTimeout?.cancel()
    ackTimeout = Task {
      do { try await Task.sleep(for: .seconds(5)) } catch { return }
      stop()
      status = "No ACK — pair again"
    }
    if let data = try? JSONEncoder().encode(request) { send(data + Data([10])) }
  }
  private func startHeartbeat() {
    heartbeat?.cancel()
    heartbeat = Task {
      while !Task.isCancelled {
        do { try await Task.sleep(for: .seconds(10)) } catch { return }
        if Date().timeIntervalSince(lastReceived) > 30 {
          stop()
          status = "Connection lost — pair again"
          return
        }
        send(Data("ping\n".utf8))
      }
    }
  }
  private func send(_ data: Data) {
    connection?.send(content: data, completion: .contentProcessed { _ in })
  }
  private func receive(_ c: NWConnection, host: Bool) {
    c.receive(minimumIncompleteLength: 1, maximumLength: 2048) {
      [weak self] data, _, complete, error in
      Task { @MainActor in
        guard let self, self.connection === c else { return }
        if complete || error != nil {
          self.stop()
          return
        }
        if let data {
          self.lastReceived = Date()
          self.buffer.append(data)
        }
        guard self.buffer.count <= 4096 else {
          self.stop()
          return
        }
        while let end = self.buffer.firstIndex(of: 10) {
          let line = self.buffer.prefix(upTo: end)
          self.buffer.removeSubrange(...end)
          if Date().timeIntervalSince(self.window) >= 1 {
            self.window = Date()
            self.count = 0
          }
          self.count += 1
          guard self.count <= 20, line.count <= 1024 else {
            self.stop()
            return
          }
          if String(data: line, encoding: .utf8) == "ping" {
            self.send(Data("pong\n".utf8))
            continue
          }
          if String(data: line, encoding: .utf8) == "pong" { continue }
          if host {
            guard
              let object = try? JSONSerialization.jsonObject(with: Data(line)) as? [String: Any],
              Set(object.keys) == Set(["session", "id", "command"]),
              let command = object["command"] as? [String: Any],
              Set(command.keys).isSubset(of: Set(["action", "value"])),
              let r = try? JSONDecoder().decode(ControlRequest.self, from: Data(line)),
              self.gate.accept(r, now: Date().timeIntervalSince1970)
            else { continue }
            if let state = self.onCommand?(r.command),
              let ack = try? JSONEncoder().encode(
                LANAck(
                  id: r.id, playing: state.playing, speed: state.speed, position: state.position))
            {
              self.send(ack + Data([10]))
            }
          } else if String(data: line, encoding: .utf8) == "approved" {
            self.status = "Connected"
          } else if let ack = try? JSONDecoder().decode(LANAck.self, from: Data(line)),
            ack.id == self.latestRequest
          {
            self.ackTimeout?.cancel()
            self.ack = ack
          }
        }
        self.receive(c, host: host)
      }
    }
  }
  func stop() {
    setupTimeout?.cancel()
    heartbeat?.cancel()
    ackTimeout?.cancel()
    timeout?.cancel()
    listener?.cancel()
    browser?.cancel()
    connection?.stateUpdateHandler = nil
    connection?.cancel()
    listener = nil
    browser = nil
    connection = nil
    gate.revoked = true
    invite = nil
    invitation = ""
    approval = false
    buffer = Data()
    status = "Disconnected"
  }
}
