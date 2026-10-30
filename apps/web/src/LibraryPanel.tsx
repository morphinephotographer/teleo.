import { useId, useRef, useState } from "react";
import type { Folder, Script } from "../../../packages/protocol/domain";
import type { Key, Locale } from "./i18n";
import { Icon, IconButton } from "./ui";

export type LibraryAction = {
  kind:
    | "newFolder"
    | "renameFolder"
    | "renameScript"
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
  onClose,
  onCreate,
  onSearch,
  onFolder,
  onOpen,
  onOpenLast,
  onAction,
  onImport,
  onRestore,
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
  onClose: () => void;
  onCreate: () => void;
  onSearch: (value: string) => void;
  onFolder: (id: string) => void;
  onOpen: (id: string) => void;
  onOpenLast: () => void;
  onAction: (action: LibraryAction) => void;
  onImport: (file: File) => void;
  onRestore: (id: string) => Promise<boolean>;
}) {
  const [trashOpen, setTrashOpen] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const foldersId = useId();
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
            <div
              className="library-row-actions"
              role="group"
              aria-label={`${t("documentActions")}: ${title}`}
            >
              {trashOpen ? (
                <>
                  <IconButton
                    name="restart"
                    className="library-action-restore"
                    label={`${t("restore")}: ${title}`}
                    disabled={!!restoring}
                    onClick={async () => {
                      setRestoring(s.scriptId);
                      try {
                        if (await onRestore(s.scriptId)) selectFolder("");
                      } finally {
                        setRestoring(null);
                      }
                    }}
                  />
                  <IconButton
                    name="trash"
                    className="library-action-trash"
                    label={`${t("deleteForever")}: ${title}`}
                    onClick={() =>
                      onAction({ kind: "purgeScript", id: s.scriptId })
                    }
                  />
                </>
              ) : (
                <>
                  <IconButton
                    name="pencil"
                    className="library-action-rename"
                    label={`${t("renameScript")}: ${title}`}
                    onClick={() =>
                      onAction({
                        kind: "renameScript",
                        id: s.scriptId,
                        initial: s.title,
                      })
                    }
                  />
                  <IconButton
                    name="trash"
                    className="library-action-trash"
                    label={`${t("delete")}: ${title}`}
                    onClick={() =>
                      onAction({ kind: "deleteScript", id: s.scriptId })
                    }
                  />
                </>
              )}
            </div>
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
        <button disabled={!ready} onClick={onCreate}>
          {t("newScript")}
        </button>
        <button
          disabled={!ready}
          onClick={() => onAction({ kind: "newFolder" })}
        >
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
            onClick={() => {
              selectFolder("");
              setFoldersExpanded(true);
            }}
          >
            <Icon name="folder" />
            <span>{t("allFolders")}</span>
          </button>
          <button
            className="library-folders-toggle"
            aria-label={t(
              foldersExpanded && !trashOpen
                ? "collapseFolders"
                : "expandFolders",
            )}
            aria-expanded={foldersExpanded && !trashOpen}
            aria-controls={foldersId}
            onClick={() => {
              setFoldersExpanded(!(foldersExpanded && !trashOpen));
              selectFolder("");
            }}
          >
            <span
              className={
                "library-disclosure" +
                (foldersExpanded && !trashOpen ? " expanded" : "")
              }
            >
              <Icon name="chevron" />
            </span>
          </button>
        </div>
        <div className="library-scroll" id={listId}>
          {trashOpen ? (
            <>
              <h3 className="library-list-heading">{t("trash")}</h3>
              {rows(visible)}
            </>
          ) : (
            <>
              <div
                className="library-folders"
                id={foldersId}
                hidden={!foldersExpanded}
              >
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
                        <small className="library-folder-count">
                          {
                            scripts.filter((s) => s.folderId === f.folderId)
                              .length
                          }
                        </small>
                        <span
                          className="library-folder-more"
                          aria-hidden="true"
                        >
                          <Icon name="more" />
                        </span>
                      </button>
                      <div
                        className="library-row-actions"
                        role="group"
                        aria-label={`${t("folderActions")}: ${f.title}`}
                      >
                        <IconButton
                          name="pencil"
                          className="library-action-rename"
                          label={`${t("renameFolder")}: ${f.title}`}
                          onClick={() =>
                            onAction({
                              kind: "renameFolder",
                              id: f.folderId,
                              initial: f.title,
                            })
                          }
                        />
                        <IconButton
                          name="trash"
                          className="library-action-trash"
                          label={`${t("deleteFolder")}: ${f.title}`}
                          onClick={() =>
                            onAction({ kind: "deleteFolder", id: f.folderId })
                          }
                        />
                      </div>
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
          disabled={!ready}
          accept=".txt,.json,text/plain,application/json"
          onChange={(e) => {
            if (e.target.files?.[0]) onImport(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <button disabled={!ready} onClick={() => input.current?.click()}>
          <Icon name="import" />
          <span>{t("import")}</span>
        </button>
        <button disabled={!ready || scripts.length === 0} onClick={onOpenLast}>
          <Icon name="book" />
          <span>{t("openLast")}</span>
        </button>
      </div>
    </aside>
  );
}
