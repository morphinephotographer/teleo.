import { useId, useRef, useState } from "react";
import type { Folder, Script } from "../../../packages/protocol/domain";
import type { Key, Locale } from "./i18n";
import { Icon, IconButton } from "./ui";
import { Popover } from "./menus";

export type LibraryAction = {
  kind:
    | "newFolder"
    | "renameFolder"
    | "deleteFolder"
    | "deleteScript"
    | "purgeScript";
  id?: string;
  initial?: string;
};

export function LibraryPanel({
  t,
  locale,
  scripts,
  trash,
  folders,
  selected,
  search,
  folder,
  ready,
  lastScriptId,
  demoLabel,
  demoBusy,
  onClose,
  onCreate,
  onSearch,
  onFolder,
  onOpen,
  onAction,
  onImport,
  onRestore,
  onDemo,
}: {
  t: (key: Key) => string;
  locale: Locale;
  scripts: Script[];
  trash: Script[];
  folders: Folder[];
  selected: string;
  search: string;
  folder: string;
  ready: boolean;
  lastScriptId: string;
  demoLabel: "openDemo" | "restoreDemo";
  demoBusy: boolean;
  onClose: () => void;
  onCreate: () => void;
  onSearch: (value: string) => void;
  onFolder: (id: string) => void;
  onOpen: (id: string) => void;
  onAction: (action: LibraryAction) => void;
  onImport: (file: File) => void;
  onRestore: (id: string) => Promise<boolean>;
  onDemo: () => void;
}) {
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const query = search.toLocaleLowerCase();
  const matches = (s: Script) =>
    `${s.title} ${s.body}`.toLocaleLowerCase().includes(query);
  const visible = (trashOpen ? trash : scripts).filter(
    (s) => matches(s) && (trashOpen || !folder || s.folderId === folder),
  );
  const selectFolder = (id: string) => {
    setTrashOpen(false);
    onFolder(id);
  };
  const rows = (items: Script[], nested = false) => (
    <div className={"script-list" + (nested ? " library-nested" : "")}>
      {items.map((s) => {
        const title = s.title || t("untitled");
        return (
          <div className="script-row" key={s.scriptId}>
            <button
              className={
                "library-document" +
                (!trashOpen && s.scriptId === selected ? " selected" : "")
              }
              aria-current={
                !trashOpen && s.scriptId === selected ? "true" : undefined
              }
              disabled={trashOpen}
              onClick={() => onOpen(s.scriptId)}
            >
              <Icon name="file" />
              <span>
                <strong>{title}</strong>
                <small>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(s.updatedAt))}
                </small>
              </span>
            </button>
            <Popover
              className="library-row-menu"
              triggerClassName="library-overflow"
              showChevron={false}
              label={`${t("documentActions")}: ${title}`}
              trigger={<Icon name="more" />}
            >
              {trashOpen ? (
                <>
                  <button
                    role="menuitem"
                    disabled={!!restoring}
                    onClick={async () => {
                      setRestoring(s.scriptId);
                      try {
                        if (await onRestore(s.scriptId)) selectFolder("");
                      } finally {
                        setRestoring(null);
                      }
                    }}
                  >
                    {t("restore")}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() =>
                      onAction({ kind: "purgeScript", id: s.scriptId })
                    }
                  >
                    {t("deleteForever")}
                  </button>
                </>
              ) : (
                <button
                  role="menuitem"
                  onClick={() =>
                    onAction({ kind: "deleteScript", id: s.scriptId })
                  }
                >
                  {t("delete")}
                </button>
              )}
            </Popover>
          </div>
        );
      })}
    </div>
  );
  return (
    <aside className="library" aria-label={t("library")}>
      <div className="library-heading">
        <h2>{t("library")}</h2>
        <IconButton name="close" label={t("closeLibrary")} onClick={onClose} />
      </div>
      <div className="library-create">
        <button onClick={onCreate}>{t("newScript")}</button>
        <button onClick={() => onAction({ kind: "newFolder" })}>
          {t("newFolder")}
        </button>
      </div>
      <div className="library-search">
        <Icon name="search" />
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="library-content">
        <div className="library-all-folders">
          <button
            className="library-folder-button"
            aria-pressed={!trashOpen && !folder}
            onClick={() => selectFolder("")}
          >
            <Icon name="folder" />
            <span>{t("allFolders")}</span>
          </button>
          <Popover
            className="library-options"
            label={t("libraryActions")}
            trigger={<Icon name="chevron" />}
            showChevron={false}
          >
            <button
              role="menuitem"
              disabled={!ready || demoBusy}
              onClick={onDemo}
            >
              {t(demoLabel)}
            </button>
          </Popover>
        </div>
        <div className="library-scroll" id={listId}>
          {trashOpen ? (
            <>
              <h3 className="library-list-heading">{t("trash")}</h3>
              {rows(visible)}
            </>
          ) : (
            <>
              <div className="library-folders">
                {folders.map((f) => (
                  <div className="library-folder-group" key={f.folderId}>
                    <div className="library-folder-row">
                      <button
                        className="library-folder-button"
                        aria-expanded={folder === f.folderId}
                        onClick={() =>
                          selectFolder(folder === f.folderId ? "" : f.folderId)
                        }
                      >
                        <Icon name="folder" />
                        <span>{f.title}</span>
                        <small>
                          {
                            scripts.filter((s) => s.folderId === f.folderId)
                              .length
                          }
                        </small>
                        <span
                          className={
                            "library-disclosure" +
                            (folder === f.folderId ? " expanded" : "")
                          }
                        >
                          <Icon name="chevron" />
                        </span>
                      </button>
                      <Popover
                        className="library-folder-menu"
                        label={`${t("folderActions")}: ${f.title}`}
                        trigger={<Icon name="more" />}
                        showChevron={false}
                      >
                        <button
                          role="menuitem"
                          onClick={() =>
                            onAction({
                              kind: "renameFolder",
                              id: f.folderId,
                              initial: f.title,
                            })
                          }
                        >
                          {t("renameFolder")}
                        </button>
                        <button
                          role="menuitem"
                          onClick={() =>
                            onAction({ kind: "deleteFolder", id: f.folderId })
                          }
                        >
                          {t("deleteFolder")}
                        </button>
                      </Popover>
                    </div>
                    {folder === f.folderId && rows(visible, true)}
                  </div>
                ))}
              </div>
              {!folder && rows(visible)}
            </>
          )}
          {ready && !visible.length && (
            <p className="library-empty" role="status">
              {t(
                trashOpen ? "trashEmpty" : search ? "noSearchResults" : "empty",
              )}
            </p>
          )}
        </div>
        <button
          className="library-trash-row"
          aria-pressed={trashOpen}
          aria-controls={listId}
          onClick={() => setTrashOpen(!trashOpen)}
        >
          <Icon name="trash" />
          <span>{t("trash")}</span>
          <small>{trash.length}</small>
          <span
            className={"library-disclosure" + (trashOpen ? " expanded" : "")}
          >
            <Icon name="chevron" />
          </span>
        </button>
      </div>
      <div className="library-footer">
        <input
          ref={input}
          type="file"
          hidden
          accept=".txt,.json,text/plain,application/json"
          onChange={(e) => {
            if (e.target.files?.[0]) onImport(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <button onClick={() => input.current?.click()}>
          <Icon name="import" />
          <span>{t("import")}</span>
        </button>
        <button
          disabled={!ready || !scripts.some((s) => s.scriptId === lastScriptId)}
          onClick={() => onOpen(lastScriptId)}
        >
          <Icon name="book" />
          <span>{t("openLast")}</span>
        </button>
      </div>
    </aside>
  );
}
