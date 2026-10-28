import CloudKit
import CoreData
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

#if os(macOS)
  import AppKit
#else
  import UIKit
#endif

@main struct TeleoApp: App {
  private let container: ModelContainer?
  private let storageError: String?
  init() {
    do {
      let identifier = Bundle.main.object(forInfoDictionaryKey: "TeleoCloudContainer") as? String
      container = try Store.make(
        memory: ProcessInfo.processInfo.arguments.contains("--teleo-ui-test"),
        cloudContainer: identifier?.isEmpty == false && identifier?.hasPrefix("$(") == false
          ? identifier : nil)
      storageError = nil
    } catch {
      container = nil
      storageError = error.localizedDescription
    }
  }
  var body: some Scene {
    WindowGroup("teleo.") {
      if let container {
        LibraryView().modelContainer(container)
      } else {
        VStack(spacing: 20) {
          Text("Cannot open the saved library").font(.title)
          Text(storageError ?? "Storage unavailable")
          Text(
            "Your store has not been deleted. Quit and back up Application Support before troubleshooting."
          )
        }.padding()
      }
    }
    #if os(macOS)
      .defaultSize(width: 1100, height: 760)
    #endif
    #if os(macOS)
      WindowGroup("teleo. Reader", for: UUID.self) { $id in
        if let container, let id { ReaderRecordView(id: id).modelContainer(container) }
      }.defaultSize(width: 1000, height: 750)
    #endif
  }
}
struct ReaderRecordView: View {
  var id: UUID
  @Query private var scripts: [ScriptRecord]
  var body: some View {
    if let script = scripts.first(where: { $0.scriptId == id && $0.deletedAt == nil }) {
      ReaderView(script: script)
    } else {
      Text("Script unavailable")
    }
  }
}
struct ExportDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.plainText, .json] }
  var data: Data
  init(_ data: Data = Data()) { self.data = data }
  init(configuration: ReadConfiguration) throws {
    data = configuration.file.regularFileContents ?? Data()
  }
  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
    FileWrapper(regularFileWithContents: data)
  }
}
struct LibraryView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.scenePhase) private var phase
  @Query(sort: \ScriptRecord.updatedAt, order: .reverse) private var scripts: [ScriptRecord]
  @Query private var folders: [FolderRecord]
  @State private var folder: UUID?
  @State private var folderPrompt = false
  @State private var folderEditing: UUID?
  @State private var folderName = ""
  @State private var selection: ScriptRecord?
  @State private var search = ""
  @State private var importing = false
  @State private var exporting = false
  @State private var document = ExportDocument()
  @State private var exportType: UTType = .plainText
  @State private var error: String?
  @State private var saved = "Saved on this device"
  @State private var cloudStatus = "iCloud not configured — local library"
  @State private var showRemote = false
  @State private var showHelp = false
  private var active: [ScriptRecord] {
    scripts.filter {
      $0.deletedAt == nil && (folder == nil || $0.folderId == folder)
        && (search.isEmpty || $0.title.localizedCaseInsensitiveContains(search)
          || $0.body.localizedCaseInsensitiveContains(search))
    }
  }
  var body: some View {
    NavigationSplitView {
      VStack {
        Picker("Folder", selection: $folder) {
          Text("All folders").tag(nil as UUID?)
          ForEach(folders.filter { $0.deletedAt == nil }) { f in
            Text(f.title).tag(f.folderId as UUID?)
          }
        }.padding(.horizontal)
        List(selection: $selection) {
          ForEach(active) { s in
            NavigationLink(value: s) {
              VStack(alignment: .leading) {
                Text(s.title.isEmpty ? "Untitled" : s.title)
                Text(s.updatedAt, style: .date).font(.caption).foregroundStyle(.secondary)
              }
            }
          }
        }
        .navigationTitle("teleo.").searchable(text: $search)
        .toolbar {
          ToolbarItem {
            Button {
              let s = ScriptRecord(title: "Untitled")
              context.insert(s)
              save()
              selection = s
            } label: {
              Label("New script", systemImage: "plus")
            }
          }
          ToolbarItem {
            Menu {
              Button("New folder") {
                folderName = ""
                folderEditing = nil
                folderPrompt = true
              }
              if let id = folder, let f = folders.first(where: { $0.folderId == id }) {
                Button("Rename folder") {
                  folderName = f.title
                  folderEditing = id
                  folderPrompt = true
                }
                Button("Delete folder, keep scripts", role: .destructive) {
                  for s in scripts where s.folderId == id { s.folderId = nil }
                  f.deletedAt = Date()
                  folder = nil
                  save()
                }
              }
              Button("Import .txt / JSON") { importing = true }
              Button("iPhone remote") { showRemote = true }
              Button("Help and privacy") { showHelp = true }
            } label: {
              Label("More", systemImage: "ellipsis.circle")
            }
          }
        }
      }.navigationSplitViewColumnWidth(min: 230, ideal: 260, max: 400)
    } detail: {
      if let selection {
        EditorView(script: selection, onSave: save, onExport: export).id(selection.scriptId)
      } else {
        ContentUnavailableView(
          "Your words. Your pace.", systemImage: "text.alignleft",
          description: Text("Create a script to begin."))
      }
    }
    .alert("Folder name", isPresented: $folderPrompt) {
      TextField("Folder name", text: $folderName)
      Button("Save") {
        if !folderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          if let id = folderEditing, let f = folders.first(where: { $0.folderId == id }) {
            f.title = folderName
          } else {
            context.insert(FolderRecord(title: folderName))
          }
          save()
        }
      }
      Button("Cancel", role: .cancel) {}
    }
    .safeAreaInset(edge: .bottom) {
      VStack {
        Text(saved)
        Text(cloudStatus)
      }.font(.caption).foregroundStyle(.secondary).padding(6)
    }
    .fileImporter(
      isPresented: $importing, allowedContentTypes: [.plainText, .json],
      allowsMultipleSelection: false
    ) { result in
      do {
        guard let url = try result.get().first else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        guard data.count <= 10_000_000 else { throw ScriptBundle.ImportError.invalid }
        if url.pathExtension.lowercased() == "json" {
          for p in try ScriptBundle.decode(data).scripts {
            let s = ScriptRecord(title: p.title, body: p.body)
            s.preferences = p.preferences
            context.insert(s)
            selection = s
          }
        } else {
          guard let text = String(data: data, encoding: .utf8) else {
            throw ScriptBundle.ImportError.invalid
          }
          let s = ScriptRecord(title: url.deletingPathExtension().lastPathComponent, body: text)
          context.insert(s)
          selection = s
        }
        save()
      } catch { self.error = "Could not import file: \(error.localizedDescription)" }
    }
    .fileExporter(
      isPresented: $exporting, document: document, contentType: exportType,
      defaultFilename: exportType == .json ? "teleo" : (selection?.title ?? "teleo")
    ) { result in if case .failure(let e) = result { error = e.localizedDescription } }
    .alert("teleo.", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
      Button("OK") { error = nil }
    } message: {
      Text(error ?? "")
    }
    .sheet(isPresented: $showRemote) { NativeControllerView() }
    .sheet(isPresented: $showHelp) { NativeHelpView() }
    .onChange(of: phase) { _, _ in save() }
    .task { await checkCloud() }
    .onReceive(NotificationCenter.default.publisher(for: .CKAccountChanged)) { _ in
      Task { await checkCloud() }
    }
    .onReceive(
      NotificationCenter.default.publisher(
        for: NSPersistentCloudKitContainer.eventChangedNotification)
    ) { note in
      if let event = note.userInfo?[NSPersistentCloudKitContainer.eventNotificationUserInfoKey]
        as? NSPersistentCloudKitContainer.Event, event.error != nil
      {
        cloudStatus = "iCloud error · local work continues · export a backup"
      }
    }
  }
  private func checkCloud() async {
    guard
      let identifier = Bundle.main.object(forInfoDictionaryKey: "TeleoCloudContainer") as? String,
      identifier.hasPrefix("iCloud.")
    else { return }
    #if os(iOS)
      UIApplication.shared.registerForRemoteNotifications()
    #else
      NSApplication.shared.registerForRemoteNotifications()
    #endif
    do {
      let account = try await CKContainer(identifier: identifier).accountStatus()
      cloudStatus =
        account == .available
        ? "iCloud available · sync pending / unknown" : "iCloud unavailable · local work continues"
    } catch { cloudStatus = "iCloud unavailable · export backups" }
  }
  private func save() {
    do {
      try context.save()
      saved = "Saved on this device"
    } catch {
      saved = "Save failed — export a backup"
      self.error = error.localizedDescription
    }
  }
  private func export(_ s: ScriptRecord, json: Bool) {
    do {
      document = ExportDocument(
        try json ? ScriptBundle(scripts: [s.portable()]).encode() : Data(s.body.utf8))
      exportType = json ? .json : .plainText
      exporting = true
    } catch { self.error = error.localizedDescription }
  }
}
struct EditorView: View {
  @Bindable var script: ScriptRecord
  @Environment(\.modelContext) private var context
  @Environment(\.scenePhase) private var phase
  var onSave: () -> Void
  var onExport: (ScriptRecord, Bool) -> Void
  @Query private var folders: [FolderRecord]
  @State private var reading = false
  @State private var history = false
  @State private var settings = false
  @State private var deleteConfirm = false
  @State private var checkpointError: String?
  @State private var saveTask: Task<Void, Never>?
  #if os(macOS)
    @Environment(\.openWindow) private var openWindow
  #endif
  var body: some View {
    VStack(spacing: 16) {
      TextField("Script title", text: $script.title).font(.title).textFieldStyle(.plain)
      Picker("Folder", selection: $script.folderId) {
        Text("No folder").tag(nil as UUID?)
        ForEach(folders.filter { $0.deletedAt == nil }) { Text($0.title).tag($0.folderId as UUID?) }
      }
      TextEditor(text: $script.body).font(.system(size: 20)).accessibilityLabel("Script body")
    }.padding().navigationTitle(script.title)
      .toolbar {
        ToolbarItem {
          Button("Read") {
            checkpoint()
            #if os(macOS)
              openWindow(value: script.scriptId)
            #else
              reading = true
            #endif
          }
        }
        ToolbarItem {
          Menu {
            Button("Reading settings") { settings = true }
            Button("Export .txt") { onExport(script, false) }
            Button("Export JSON") { onExport(script, true) }
            Button("Duplicate") {
              let s = ScriptRecord(title: script.title, body: script.body)
              s.preferences = script.preferences
              context.insert(s)
              onSave()
            }
            Button("Version history") {
              checkpoint()
              history = true
            }
            Button("Move to trash", role: .destructive) { deleteConfirm = true }
          } label: {
            Label("Options", systemImage: "ellipsis.circle")
          }
        }
      }
      .confirmationDialog("Move this script to trash?", isPresented: $deleteConfirm) {
        Button("Move to trash", role: .destructive) {
          checkpoint()
          script.deletedAt = Date()
          onSave()
        }
      }
      .onChange(of: script.body) { _, _ in schedule() }.onChange(of: script.title) { _, _ in
        schedule()
      }
      .onChange(of: phase) { _, _ in checkpoint() }.onDisappear { checkpoint() }
      .sheet(isPresented: $settings) { ReadingSettings(script: script) }
      .sheet(isPresented: $history) { RevisionView(script: script) }
      #if os(iOS)
        .fullScreenCover(isPresented: $reading) { ReaderView(script: script) }
      #endif
      .alert(
        "Could not save revision",
        isPresented: Binding(
          get: { checkpointError != nil }, set: { if !$0 { checkpointError = nil } })
      ) {
        Button("OK") { checkpointError = nil }
      } message: {
        Text(checkpointError ?? "")
      }
      .onAppear { checkpoint() }
  }
  private func schedule() {
    script.updatedAt = Date()
    saveTask?.cancel()
    saveTask = Task {
      try? await Task.sleep(for: .milliseconds(600))
      if !Task.isCancelled { checkpoint() }
    }
  }
  private func checkpoint() {
    saveTask?.cancel()
    do {
      try Store.checkpoint(script, context: context)
      onSave()
    } catch { checkpointError = error.localizedDescription }
  }
}
struct ReadingSettings: View {
  @Bindable var script: ScriptRecord
  @Environment(\.dismiss) var dismiss
  private func number(_ key: WritableKeyPath<ReadingPreferences, Double>) -> Binding<Double> {
    Binding(
      get: { script.preferences[keyPath: key] },
      set: {
        var p = script.preferences
        p[keyPath: key] = $0
        script.preferences = p
      })
  }
  private func flag(_ key: WritableKeyPath<ReadingPreferences, Bool>) -> Binding<Bool> {
    Binding(
      get: { script.preferences[keyPath: key] },
      set: {
        var p = script.preferences
        p[keyPath: key] = $0
        script.preferences = p
      })
  }
  var body: some View {
    NavigationStack {
      Form {
        LabeledContent("Speed") {
          VStack {
            Text("\(speedLabel(script.preferences.speed))×")
            Slider(value: number(\.speed), in: 0.5...3, step: 0.1)
          }
        }
        LabeledContent("Text size") { Slider(value: number(\.fontSize), in: 16...100) }
        LabeledContent("Line spacing") { Slider(value: number(\.lineHeight), in: 1...3) }
        LabeledContent("Text width") { Slider(value: number(\.textWidth), in: 280...1600) }
        Toggle("Mirror horizontally", isOn: flag(\.mirrorHorizontal))
        Toggle("Mirror vertically", isOn: flag(\.mirrorVertical))
        Toggle("Reading guide", isOn: flag(\.focusLine))
        Picker("Countdown", selection: number(\.countdownSeconds)) {
          Text("Off").tag(0.0)
          Text("3 seconds").tag(3.0)
          Text("5 seconds").tag(5.0)
          Text("10 seconds").tag(10.0)
        }
        Picker(
          "Alignment",
          selection: Binding(
            get: { script.preferences.alignment },
            set: {
              var p = script.preferences
              p.alignment = $0
              script.preferences = p
            })
        ) {
          Text("Left").tag("left")
          Text("Center").tag("center")
          Text("Right").tag("right")
        }
        Picker(
          "Appearance",
          selection: Binding(
            get: { script.preferences.appearance },
            set: {
              var p = script.preferences
              p.appearance = $0
              script.preferences = p
            })
        ) {
          Text("Dark").tag("dark")
          Text("Light").tag("light")
        }
      }.navigationTitle("Reading settings").toolbar { Button("Done") { dismiss() } }
    }.frame(minWidth: 300, minHeight: 430)
  }
}
struct RevisionView: View {
  var script: ScriptRecord
  @Environment(\.modelContext) var context
  @Environment(\.dismiss) var dismiss
  @Query(sort: \RevisionRecord.timestamp, order: .reverse) private var revisions: [RevisionRecord]
  @State var error: String?
  var body: some View {
    NavigationStack {
      List(revisions.filter { $0.scriptId == script.scriptId }) { r in
        VStack(alignment: .leading) {
          Text(r.timestamp, style: .date)
          Text(r.body.prefix(200))
          Button("Restore") {
            do {
              try Store.checkpoint(script, context: context)
              script.title = r.title
              script.body = r.body
              script.updatedAt = Date()
              try context.save()
              dismiss()
            } catch { self.error = error.localizedDescription }
          }
        }
      }.navigationTitle("Version history").toolbar { Button("Done") { dismiss() } }.safeAreaInset(
        edge: .bottom
      ) { if let error { Text(error).foregroundStyle(.red) } }
    }.frame(minWidth: 300, minHeight: 400)
  }
}
struct NativeControllerView: View {
  @StateObject private var link = NativeRemote()
  @Environment(\.dismiss) var dismiss
  @Environment(\.scenePhase) var phase
  @State private var invite = ""
  var body: some View {
    NavigationStack {
      Form {
        Text(link.status)
        Button("Find nearby Mac") { link.discover() }
        ForEach(Array(link.nearby.enumerated()), id: \.offset) { _, result in
          Text(String(describing: result.endpoint))
        }
        Text(
          "On the Mac reader choose Allow iPhone Remote. Transfer the private invitation securely, then paste it here. It expires in 120 seconds."
        ).font(.caption)
        SecureField("Private invitation", text: $invite)
        Button("Request control") {
          link.join(invite)
          invite = ""
        }
        if link.status == "Connected" {
          ForEach(
            [
              Action.play, .pause, .speedUp, .speedDown, .previousParagraph, .nextParagraph,
              .restart,
            ], id: \.self
          ) { action in Button(action.rawValue) { link.command(action) }.frame(minHeight: 44) }
          if let ack = link.ack {
            Text("ACK · \(speedLabel(ack.speed))× · \(ack.playing ? "Playing" : "Paused")")
          }
        }
        Button("Disconnect") { link.stop() }
      }.navigationTitle("iPhone remote").toolbar { Button("Done") { dismiss() } }
    }.frame(minWidth: 300, minHeight: 440).onDisappear { link.stop() }.onChange(of: phase) { _, p in
      if p != .active { link.stop() }
    }
  }
}

struct NativeHelpView: View {
  @Environment(\.dismiss) var dismiss
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("Your words. Your pace.").font(.title)
          Text(
            "Create or import a script, adjust Reading settings, then choose Read. Play and Pause hold your place. Manual scrolling pauses playback. Reading content can be mirrored without mirroring controls."
          )
          Text(
            "Pair physical clickers in system Bluetooth settings. Space plays or pauses, arrows change speed or paragraph, R restarts, M mirrors. Only delivered key events work; some keys are reserved by the OS. Learn and test keys in Physical remote while reading."
          )
          Text(
            "On the Mac reader, enable Allow iPhone Remote. On iPhone, choose iPhone remote and Find nearby Mac. Transfer the private invitation securely and request control. The Mac must approve. Revoke ends the session; a lost connection requires pairing again."
          )
          Text(
            "Scripts and revisions are saved locally. Signed builds configured for iCloud can sync with your private Apple CloudKit database. Saved on this device does not mean a cloud upload finished. The browser has a separate library; use .txt or JSON import/export to move scripts and keep backups."
          )
          Text(
            "No accounts, advertising, analytics, AI or video recording. Remote messages contain playback commands and numeric state, never script text or titles. Physical hardware and signed iCloud sync still require device verification."
          )
        }.padding(24)
      }.navigationTitle("Help and privacy").toolbar { Button("Done") { dismiss() } }
    }.frame(minWidth: 300, minHeight: 440)
  }
}
