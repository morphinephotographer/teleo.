import SwiftUI

#if os(macOS)
  import AppKit
  import IOKit.pwr_mgt
#else
  import UIKit
#endif

@MainActor final class ReaderState: ObservableObject {
  @Published var playback = Playback()
  @Published var paragraphs: [Double] = []
  @Published var mapping = HardwareMapping()
  @Published var learnedKey = "No usable key event detected"
  @Published var learning: Action?
  @Published var keyEnabled = true
  @Published var profile =
    UserDefaults.standard.string(forKey: "teleo.remote.profile") ?? "standard"
  { didSet { UserDefaults.standard.set(profile, forKey: "teleo.remote.profile") } }
  @Published var twoButtonA = UserDefaults.standard.string(forKey: "teleo.buttonA") ?? ""
  @Published var testing = false
  @Published var presetsText =
    UserDefaults.standard.string(forKey: "teleo.presets") ?? "0.75,1,1.25,1.5,2"
  @Published var presetKey = ""
  @Published var learningPreset = false
  #if os(macOS)
    private var assertion: IOPMAssertionID = 0
  #endif
  init() {
    if let data = UserDefaults.standard.data(forKey: "teleo.mapping"),
      let mapping = try? JSONDecoder().decode(HardwareMapping.self, from: data)
    {
      self.mapping = mapping
    }
    presetKey = UserDefaults.standard.string(forKey: "teleo.presetKey") ?? ""
  }
  func key(_ key: String) -> Bool {
    learnedKey = key
    if learningPreset {
      if key == twoButtonA {
        learnedKey = "Conflict: \(key)"
        return true
      }
      presetKey = key
      UserDefaults.standard.set(key, forKey: "teleo.presetKey")
      learningPreset = false
      return true
    }
    if let action = learning {
      if profile == "twoButton" {
        if key == presetKey {
          learnedKey = "Conflict: \(key)"
          return true
        }
        twoButtonA = key
        UserDefaults.standard.set(key, forKey: "teleo.buttonA")
        learning = nil
        return true
      }
      if mapping.learn(key, action: action) {
        learning = nil
        if let data = try? JSONEncoder().encode(mapping) {
          UserDefaults.standard.set(data, forKey: "teleo.mapping")
        }
      } else {
        learnedKey = "Conflict: \(key)"
      }
      return true
    }
    if testing { return true }
    guard keyEnabled else { return false }
    if profile == "twoButton", key == twoButtonA, !twoButtonA.isEmpty {
      dispatch(Command(.togglePlay))
      return true
    }
    if profile == "twoButton", key == presetKey && !presetKey.isEmpty {
      dispatch(Command(.setSpeed, value: mapping.nextPreset(playback.speed)))
      return true
    }
    if profile == "twoButton" { return false }
    guard let action = (profile == "standard" ? HardwareMapping().keys : mapping.keys)[key] else {
      return false
    }
    dispatch(Command(action))
    return true
  }
  func setPresets(_ text: String) {
    presetsText = text
    let values = text.split(separator: ",").compactMap {
      Double($0.trimmingCharacters(in: .whitespaces))
    }
    if !values.isEmpty && values.allSatisfy({ $0.isFinite && (0.5...3).contains($0) }) {
      mapping.presets = values.sorted()
      UserDefaults.standard.set(text, forKey: "teleo.presets")
      if let data = try? JSONEncoder().encode(mapping) {
        UserDefaults.standard.set(data, forKey: "teleo.mapping")
      }
    } else {
      learnedKey = "Presets must be between 0.5 and 3"
    }
  }
  func dispatch(_ command: Command) {
    playback.dispatch(command, paragraphs: paragraphs)
    power()
  }
  func stop() {
    playback.suspend()
    power()
  }
  func power() {
    #if os(iOS)
      UIApplication.shared.isIdleTimerDisabled = playback.playing
    #else
      if playback.playing && assertion == 0 {
        IOPMAssertionCreateWithName(
          kIOPMAssertionTypeNoDisplaySleep as CFString, IOPMAssertionLevel(kIOPMAssertionLevelOn),
          "teleo. active reading" as CFString, &assertion)
      } else if !playback.playing && assertion != 0 {
        IOPMAssertionRelease(assertion)
        assertion = 0
      }
    #endif
  }
}
struct ReaderView: View {
  let script: ScriptRecord
  @Environment(\.dismiss) private var dismiss
  @Environment(\.scenePhase) private var phase
  @StateObject private var model = ReaderState()
  @StateObject private var remote = NativeRemote()
  @State private var physical = false
  @State private var learnAction = Action.togglePlay
  @FocusState private var focused: Bool
  @FocusState private var learningFocus: Bool
  @FocusState private var presetEditing: Bool
  @State private var controlsVisible = true
  var body: some View {
    let prefs = script.preferences
    VStack(spacing: 0) {
      HStack {
        Button("Exit reader") {
          #if os(macOS)
            NSApp.keyWindow?.close()
          #else
            dismiss()
          #endif
        }
        Spacer()
        Button("Physical remote") { physical.toggle() }
        #if os(macOS)
          Button("Fullscreen") { NSApp.keyWindow?.toggleFullScreen(nil) }
          Button("Allow iPhone Remote") { remote.host() }
        #endif
      }.padding().buttonStyle(.bordered)
      ZStack {
        TimelineView(.animation) { timeline in
          NativeReadingText(
            body: script.body, preferences: prefs, position: model.playback.position,
            onLayout: { max, paragraphs in
              if abs(model.playback.maximum - max) > 1 { model.playback.maximum = max }
              if model.paragraphs != paragraphs { model.paragraphs = paragraphs }
            },
            onManual: { position in
              model.stop()
              model.playback.position = position
            }
          )
          .onChange(of: timeline.date) { _, date in
            model.playback.tick(date.timeIntervalSinceReferenceDate)
            if !model.playback.playing { model.power() }
          }
        }
        if prefs.focusLine {
          Rectangle().fill(Color(red: 0.3, green: 0.49, blue: 1).opacity(0.4)).frame(height: 1)
            .allowsHitTesting(false).offset(y: -70)
        }
        if model.playback.countdown > 0 {
          Text("\(Int(ceil(model.playback.countdown)))").font(.system(size: 80)).allowsHitTesting(
            false)
        }
      }
      ViewThatFits(in: .horizontal) {
        controls
        ScrollView(.horizontal) { controls }
      }.padding(8).opacity(controlsVisible ? 1 : 0).allowsHitTesting(controlsVisible)
        .accessibilityHidden(!controlsVisible)
      if model.playback.maximum > 0 {
        Slider(
          value: Binding(
            get: { model.playback.position },
            set: {
              model.stop()
              model.playback.position = $0
            }), in: 0...model.playback.maximum
        ).accessibilityLabel("Reading position").padding(.horizontal)
      }
      if !remote.invitation.isEmpty {
        Text("Private invitation — expires in 120 seconds").font(.caption)
        Text(remote.invitation).font(.caption2.monospaced()).textSelection(.enabled).padding(8)
      }
      if remote.approval {
        HStack {
          Text("Allow this iPhone to control reading?")
          Button("Allow") { remote.approve() }
          Button("Deny") { remote.stop() }
        }.padding()
      }
      if remote.status != "Disconnected" {
        HStack {
          Text(remote.status)
          Button("Revoke") { remote.stop() }
        }.font(.caption).padding(6)
      }
    }
    .background(
      prefs.appearance == "light" ? Color.white : Color(red: 0.035, green: 0.035, blue: 0.043)
    )
    .foregroundStyle(prefs.appearance == "light" ? Color.black : Color.white)
    .focusable().focused($focused)
    .onKeyPress(phases: [.down]) { press in
      guard !physical, press.modifiers.intersection([.command, .control, .option]).isEmpty else {
        return .ignored
      }
      if press.key == .escape {
        dismiss()
        return .handled
      }
      if model.keyEnabled && press.characters.lowercased() == "m" {
        var p = script.preferences
        p.mirrorHorizontal.toggle()
        script.preferences = p
        return .handled
      }
      let key = normalized(press)
      return model.key(key) ? .handled : .ignored
    }
    .sheet(isPresented: $physical) {
      VStack(alignment: .leading, spacing: 16) {
        Text("Physical remote").font(.title2)
        Text(
          "Pair in system Bluetooth settings. Only key events delivered to this focused reader are supported; device identity and battery are unavailable."
        )
        Toggle("Enable keyboard remote", isOn: $model.keyEnabled)
        Picker("Profile", selection: $model.profile) {
          Text("Standard").tag("standard")
          Text("Two-button").tag("twoButton")
          Text("Custom").tag("custom")
        }
        if model.profile != "standard" {
          Picker("Action", selection: $learnAction) {
            ForEach(Action.allCases.filter { $0 != .setSpeed }, id: \.self) {
              Text($0.rawValue).tag($0)
            }
          }
          Button("Learn button A / selected action") {
            model.learning = model.profile == "twoButton" ? .togglePlay : learnAction
            learningFocus = true
          }
          if model.profile == "twoButton" {
            Button("Learn button B / cycle presets") {
              model.learningPreset = true
              learningFocus = true
            }
          }
        }
        Button("Test input") {
          model.testing = true
          model.learnedKey = "No usable key event detected"
          learningFocus = true
        }
        Text(
          model.learning != nil || model.learningPreset ? "Press a hardware key…" : model.learnedKey
        ).font(.caption.monospaced())
        TextField(
          "Speed presets (comma separated)",
          text: Binding(get: { model.presetsText }, set: { model.setPresets($0) })
        ).focused($presetEditing)
        Button("Reset standard mapping") {
          model.mapping = HardwareMapping()
          model.presetKey = ""
          model.twoButtonA = ""
          model.profile = "standard"
          UserDefaults.standard.removeObject(forKey: "teleo.buttonA")
          UserDefaults.standard.removeObject(forKey: "teleo.mapping")
          UserDefaults.standard.removeObject(forKey: "teleo.presetKey")
        }
        Button("Done") {
          physical = false
          model.testing = false
          focused = true
        }
      }.padding(24).frame(minWidth: 300, minHeight: 500).focusable().focused($learningFocus)
        .onAppear { learningFocus = true }.onKeyPress(phases: [.down]) { press in
          guard !presetEditing, press.modifiers.intersection([.command, .control, .option]).isEmpty
          else { return .ignored }
          return model.key(normalized(press)) ? .handled : .ignored
        }
    }
    .onAppear {
      focused = true
      model.playback.speed = prefs.speed
      model.playback.position = UserDefaults.standard.double(
        forKey: "teleo.position.\(script.scriptId)")
      remote.onCommand = { c in
        model.dispatch(c)
        return model.playback
      }
    }
    .onTapGesture { controlsVisible = true }
    .task(id: model.playback.playing) {
      controlsVisible = true
      if model.playback.playing {
        do { try await Task.sleep(for: .seconds(4)) } catch { return }
        controlsVisible = false
      }
    }
    .onChange(of: model.playback.speed) { _, speed in
      var p = script.preferences
      p.speed = speed
      script.preferences = p
    }
    .onChange(of: phase) { _, p in
      if p != .active {
        model.stop()
        remote.stop()
        savePosition()
      }
    }
    .onDisappear {
      model.stop()
      remote.stop()
      savePosition()
    }
  }
  private var controls: some View {
    HStack(spacing: 12) {
      Button(model.playback.playing ? "Pause" : "Play") {
        if !model.playback.playing {
          model.playback.countdown = script.preferences.countdownSeconds
        }
        model.dispatch(Command(model.playback.playing ? .pause : .play))
      }
      Button("Restart") { model.dispatch(Command(.restart)) }
      Button("−") { model.dispatch(Command(.speedDown)) }.accessibilityLabel("Slower")
      Text("\(model.playback.speed.formatted())×").monospacedDigit()
      Button("+") { model.dispatch(Command(.speedUp)) }.accessibilityLabel("Faster")
      Button("Previous") { model.dispatch(Command(.previousParagraph)) }
      Button("Next") { model.dispatch(Command(.nextParagraph)) }
    }.buttonStyle(.bordered).controlSize(.large)
  }
  private func savePosition() {
    UserDefaults.standard.set(model.playback.position, forKey: "teleo.position.\(script.scriptId)")
  }
  private func normalized(_ p: KeyPress) -> String {
    switch p.key {
    case .upArrow: return "up"
    case .downArrow: return "down"
    case .leftArrow: return "left"
    case .rightArrow: return "right"
    default: return p.characters.lowercased()
    }
  }
}

#if os(macOS)
  final class ReadingScroll: NSScrollView {
    var onManual: ((Double) -> Void)?
    override func scrollWheel(with event: NSEvent) {
      super.scrollWheel(with: event)
      onManual?(contentView.bounds.origin.y)
    }
  }
  struct NativeReadingText: NSViewRepresentable {
    var body: String
    var preferences: ReadingPreferences
    var position: Double
    var onLayout: (Double, [Double]) -> Void
    var onManual: (Double) -> Void
    final class Coordinator {
      var body = ""
      var prefs = ReadingPreferences()
      var size = CGSize.zero
      var initialized = false
    }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeNSView(context: Context) -> ReadingScroll {
      let scroll = ReadingScroll()
      scroll.drawsBackground = false
      scroll.hasVerticalScroller = false
      let text = NSTextView()
      text.isEditable = false
      text.isSelectable = false
      text.drawsBackground = false
      scroll.documentView = text
      return scroll
    }
    func updateNSView(_ scroll: ReadingScroll, context: Context) {
      guard let text = scroll.documentView as? NSTextView else { return }
      scroll.onManual = onManual
      if !context.coordinator.initialized || context.coordinator.body != body
        || context.coordinator.prefs != preferences
        || context.coordinator.size != scroll.bounds.size
      {
        context.coordinator.initialized = true
        context.coordinator.body = body
        context.coordinator.prefs = preferences
        context.coordinator.size = scroll.bounds.size
        let width = max(100, min(preferences.textWidth, scroll.bounds.width) - 48)
        let style = NSMutableParagraphStyle()
        style.lineSpacing = preferences.fontSize * (preferences.lineHeight - 1)
        style.alignment =
          preferences.alignment == "center"
          ? .center : preferences.alignment == "right" ? .right : .left
        let value = NSAttributedString(
          string: body,
          attributes: [
            .font: NSFont.systemFont(ofSize: preferences.fontSize),
            .foregroundColor: preferences.appearance == "light"
              ? NSColor.black : NSColor(white: 0.96, alpha: 1), .paragraphStyle: style,
          ])
        text.textStorage?.setAttributedString(value)
        text.textContainerInset = NSSize(width: 24, height: 80)
        text.textContainer?.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        text.textContainer?.widthTracksTextView = false
        text.layoutManager?.ensureLayout(for: text.textContainer!)
        let height =
          (text.layoutManager?.usedRect(for: text.textContainer!).height ?? 0) + scroll.bounds
          .height * 0.8 + 80
        text.frame = NSRect(
          x: max(0, (scroll.bounds.width - width - 48) / 2), y: 0, width: width + 48,
          height: max(height, scroll.bounds.height))
        text.wantsLayer = true
        text.layer?.setAffineTransform(
          CGAffineTransform(
            scaleX: preferences.mirrorHorizontal ? -1 : 1, y: preferences.mirrorVertical ? -1 : 1))
        let paragraphs = paragraphOffsets(body: body) { range in
          Double(
            text.layoutManager?.boundingRect(
              forGlyphRange: text.layoutManager!.glyphRange(
                forCharacterRange: range, actualCharacterRange: nil), in: text.textContainer!
            ).minY
              ?? 0)
        }
        DispatchQueue.main.async { onLayout(max(0, height - scroll.bounds.height), paragraphs) }
      }
      scroll.contentView.scroll(to: NSPoint(x: 0, y: position))
      scroll.reflectScrolledClipView(scroll.contentView)
    }
  }
#else
  struct NativeReadingText: UIViewRepresentable {
    var body: String
    var preferences: ReadingPreferences
    var position: Double
    var onLayout: (Double, [Double]) -> Void
    var onManual: (Double) -> Void
    class Coordinator: NSObject, UITextViewDelegate {
      var body = ""
      var prefs = ReadingPreferences()
      var size = CGSize.zero
      var initialized = false
      var onManual: ((Double) -> Void)?
      func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        onManual?(scrollView.contentOffset.y)
      }
      func scrollViewDidScroll(_ scrollView: UIScrollView) {
        if scrollView.isDragging || scrollView.isDecelerating {
          onManual?(scrollView.contentOffset.y)
        }
      }
    }
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> UITextView {
      let text = UITextView()
      text.isEditable = false
      text.isSelectable = false
      text.backgroundColor = .clear
      text.delegate = context.coordinator
      text.showsVerticalScrollIndicator = false
      return text
    }
    func updateUIView(_ text: UITextView, context: Context) {
      context.coordinator.onManual = onManual
      if !context.coordinator.initialized || context.coordinator.body != body
        || context.coordinator.prefs != preferences || context.coordinator.size != text.bounds.size
      {
        context.coordinator.initialized = true
        context.coordinator.body = body
        context.coordinator.prefs = preferences
        context.coordinator.size = text.bounds.size
        let style = NSMutableParagraphStyle()
        style.lineSpacing = preferences.fontSize * (preferences.lineHeight - 1)
        style.alignment =
          preferences.alignment == "center"
          ? .center : preferences.alignment == "right" ? .right : .left
        let attrs: [NSAttributedString.Key: Any] = [
          .font: UIFont.systemFont(ofSize: preferences.fontSize),
          .foregroundColor: preferences.appearance == "light"
            ? UIColor.black : UIColor(white: 0.96, alpha: 1), .paragraphStyle: style,
        ]
        text.attributedText = NSAttributedString(string: body, attributes: attrs)
        let side = max(24, (text.bounds.width - preferences.textWidth) / 2)
        text.textContainerInset = UIEdgeInsets(
          top: 80, left: side, bottom: text.bounds.height * 0.8, right: side)
        text.transform = CGAffineTransform(
          scaleX: preferences.mirrorHorizontal ? -1 : 1, y: preferences.mirrorVertical ? -1 : 1)
        text.layoutManager.ensureLayout(for: text.textContainer)
        let paragraphs = paragraphOffsets(body: body) { range in
          Double(
            text.layoutManager.boundingRect(
              forGlyphRange: text.layoutManager.glyphRange(
                forCharacterRange: range, actualCharacterRange: nil), in: text.textContainer
            ).minY)
        }
        let maxPosition = max(0, text.contentSize.height - text.bounds.height)
        DispatchQueue.main.async { onLayout(maxPosition, paragraphs) }
      }
      if !text.isDragging && !text.isDecelerating {
        text.setContentOffset(CGPoint(x: 0, y: position), animated: false)
      }
    }
  }
#endif
private func paragraphOffsets(body: String, rect: (NSRange) -> Double) -> [Double] {
  let s = body as NSString
  var offsets = [0.0]
  var start = 0
  for p in body.components(separatedBy: "\n\n") {
    let length = (p as NSString).length
    if length > 0 && start < s.length {
      offsets.append(
        max(0, rect(NSRange(location: start, length: min(length, s.length - start))) + 20))
    }
    start += length + 2
  }
  return Array(Set(offsets)).sorted()
}
