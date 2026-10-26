import Foundation
import SwiftData

@Model public final class ScriptRecord {
  public var scriptId: UUID = UUID()
  public var title: String = ""
  public var body: String = ""
  public var createdAt: Date = Date()
  public var updatedAt: Date = Date()
  public var folderId: UUID?
  public var deletedAt: Date?
  public var preferencesData: Data = Data()
  public init(title: String, body: String = "") {
    self.title = title
    self.body = body
  }
  public var preferences: ReadingPreferences {
    get {
      (try? JSONDecoder().decode(ReadingPreferences.self, from: preferencesData))
        ?? ReadingPreferences()
    }
    set { if let data = try? JSONEncoder().encode(newValue) { preferencesData = data } }
  }
  public func portable() -> PortableScript {
    var s = PortableScript(title: title, body: body)
    s.scriptId = scriptId
    s.folderId = folderId
    let formatter = ISO8601DateFormatter()
    s.createdAt = formatter.string(from: createdAt)
    s.updatedAt = formatter.string(from: updatedAt)
    s.preferences = preferences
    return s
  }
}
@Model public final class RevisionRecord {
  public var revisionId: UUID = UUID()
  public var scriptId: UUID = UUID()
  public var timestamp: Date = Date()
  public var title: String = ""
  public var body: String = ""
  public var source: String = "apple"
  public init(script: ScriptRecord) {
    scriptId = script.scriptId
    title = script.title
    body = script.body
  }
}
@Model public final class FolderRecord {
  public var folderId: UUID = UUID()
  public var title: String = ""
  public var deletedAt: Date?
  public init(title: String) { self.title = title }
}
public enum TeleoSchema: VersionedSchema {
  public static let versionIdentifier = Schema.Version(1, 0, 0)
  public static var models: [any PersistentModel.Type] {
    [ScriptRecord.self, RevisionRecord.self, FolderRecord.self]
  }
}
public enum TeleoMigration: SchemaMigrationPlan {
  public static var schemas: [any VersionedSchema.Type] { [TeleoSchema.self] }
  public static var stages: [MigrationStage] { [] }
}
@MainActor public enum Store {
  public static func make(url: URL? = nil, memory: Bool = false, cloudContainer: String? = nil)
    throws -> ModelContainer
  {
    let schema = Schema(versionedSchema: TeleoSchema.self)
    let cloud: ModelConfiguration.CloudKitDatabase = cloudContainer.map { .private($0) } ?? .none
    let config: ModelConfiguration
    if let url {
      config = ModelConfiguration(schema: schema, url: url, cloudKitDatabase: cloud)
    } else {
      config = ModelConfiguration(
        schema: schema, isStoredInMemoryOnly: memory, cloudKitDatabase: cloud)
    }
    return try ModelContainer(
      for: schema, migrationPlan: TeleoMigration.self, configurations: [config])
  }
  public static func checkpoint(_ script: ScriptRecord, context: ModelContext) throws {
    let id = script.scriptId
    let descriptor = FetchDescriptor<RevisionRecord>()
    let revisions = try context.fetch(descriptor).filter { $0.scriptId == id }.sorted {
      $0.timestamp > $1.timestamp
    }
    if revisions.first?.title != script.title || revisions.first?.body != script.body {
      context.insert(RevisionRecord(script: script))
    }
    var bytes = 0
    for (index, r) in revisions.enumerated() {
      bytes += r.body.utf8.count
      if index >= 29 || bytes > 5_000_000 { context.delete(r) }
    }
    try context.save()
  }
}
