import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import {
  Playback,
  createScript,
  exportBundle,
  parseBundle,
  standardKeys,
  keyboardSafe,
  actions,
  type Script,
  type Preferences,
  type Revision,
  type Folder,
  type Action,
  type Command,
} from "../../../packages/protocol/domain";
import {
  dictionaries,
  detectLocale,
  localGet,
  localSet,
  type Locale,
  type Key,
} from "./i18n";
import { storage } from "./storage";
import { RemoteLink } from "./remote";
import "./style.css";
const engine = new Playback();
function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function HomePreview({ text, t }: { text: string; t: (key: Key) => string }) {
  const engine = useRef(new Playback()),
    view = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      if (view.current) {
        engine.current.maximum = Math.max(
          0,
          view.current.scrollHeight - view.current.clientHeight,
        );
        view.current.scrollTop = engine.current.tick(now);
        if (!engine.current.playing) setPlaying(false);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <>
      <div className="demo-text" ref={view}>
        <p>
          {Array.from({ length: 4 }, (_, i) => (
            <React.Fragment key={i}>
              {text}
              <br />
              <br />
            </React.Fragment>
          ))}
        </p>
      </div>
      <button
        onClick={() => {
          if (!playing && engine.current.position >= engine.current.maximum)
            engine.current.position = 0;
          engine.current.command({ action: playing ? "pause" : "play" });
          setPlaying(!playing);
        }}
      >
        {t(playing ? "pause" : "play")}
      </button>
    </>
  );
}
function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    detectLocale(
      navigator.languages,
      new URLSearchParams(location.search).get("lang") ||
        localGet("teleo.locale"),
    ),
  );
  const t = (key: Key) => dictionaries[locale][key] || dictionaries.en[key];
  const [route, setRoute] = useState(location.pathname),
    [scripts, setScripts] = useState<Script[]>([]),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState(""),
    [folders, setFolders] = useState<Folder[]>([]),
    [folder, setFolder] = useState(""),
    [status, setStatus] = useState<Key>("saved"),
    [notice, setNotice] = useState<Key | null>(null),
    [reading, setReading] = useState(false),
    [frame, setFrame] = useState(0),
    [controlsVisible, setControlsVisible] = useState(true),
    [revisions, setRevisions] = useState<Revision[] | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const [profile, setProfile] = useState(
      localGet("teleo.profile") || "standard",
    ),
    [mapping, setMapping] = useState<
      Record<string, Action | "mirror" | "preset">
    >(() => {
      try {
        return JSON.parse(localGet("teleo.mapping") || "{}");
      } catch {
        return {};
      }
    }),
    [enabled, setEnabled] = useState(localGet("teleo.keys") !== "false"),
    [learn, setLearn] = useState<Action | "mirror" | "preset" | null>(null),
    [keyEvent, setKeyEvent] = useState(""),
    [testing, setTesting] = useState(false),
    [learnAction, setLearnAction] = useState<Action>("togglePlay"),
    [presets, setPresets] = useState(
      localGet("teleo.presets") || "0.75,1,1.25,1.5,2",
    );
  const [remoteStatus, setRemoteStatus] = useState<Key | null>(null),
    [invite, setInvite] = useState(""),
    [qr, setQR] = useState(""),
    [approval, setApproval] = useState(false),
    [remoteState, setRemoteState] = useState({
      playing: false,
      speed: 1,
      position: 0,
    });
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const showControls = () => {
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    if (engine.playing)
      controlsTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  };
  const remote = useRef(new RemoteLink()),
    viewport = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    currentRef = useRef<Script | null>(null),
    pending = useRef(new Map<string, Script>()),
    saving = useRef(Promise.resolve()),
    wake = useRef<WakeLockSentinel | null>(null),
    lastAck = useRef("");
  const current = scripts.find((s) => s.scriptId === selected) ?? null;
  currentRef.current = current;
  const persist = (s: Script) => {
    pending.current.set(s.scriptId, s);
    localSet("teleo.recovery." + s.scriptId, JSON.stringify(s));
    setStatus("saving");
  };
  const flush = () => {
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return saving.current;
    saving.current = saving.current.then(async () => {
      for (const s of batch) {
        try {
          await storage.save(s, true);
          localSet("teleo.recovery." + s.scriptId, "");
          setStatus("saved");
        } catch {
          pending.current.set(s.scriptId, s);
          setStatus("saveError");
        }
      }
    });
    return saving.current;
  };
  const edit = (patch: Partial<Script>) => {
    if (!currentRef.current) return;
    const next = {
      ...currentRef.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    currentRef.current = next;
    setScripts((list) =>
      list.map((s) => (s.scriptId === next.scriptId ? next : s)),
    );
    persist(next);
  };
  const pref = (patch: Partial<Preferences>) => {
    if (currentRef.current)
      edit({ preferences: { ...currentRef.current.preferences, ...patch } });
  };
  const paragraphs = () => {
    const root = content.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>("[data-paragraph]"),
    ).map((el) => Math.max(0, el.offsetTop - root.offsetTop - 60));
  };
  const command = (c: Command) => {
    if (c.action === "play" || (c.action === "togglePlay" && !engine.playing))
      engine.countdown = currentRef.current?.preferences.countdownSeconds || 0;
    engine.command(c, paragraphs());
    if (
      currentRef.current &&
      engine.speed !== currentRef.current.preferences.speed
    )
      pref({ speed: engine.speed });
    showControls();
    setFrame((x) => x + 1);
  };
  useEffect(() => {
    Promise.all([storage.list(), storage.folders()])
      .then(([list, fs]) => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("teleo.recovery.")) {
              const raw = localGet(key);
              if (raw) {
                const recovered = JSON.parse(raw) as Script;
                const old = list.find((s) => s.scriptId === recovered.scriptId);
                if (!old || old.updatedAt <= recovered.updatedAt) {
                  const index = list.findIndex(
                    (s) => s.scriptId === recovered.scriptId,
                  );
                  if (index >= 0) list[index] = recovered;
                  else list.push(recovered);
                  pending.current.set(recovered.scriptId, recovered);
                }
              }
            }
          }
        } catch {
          /* Storage may be disabled. */
        }
        setScripts(list.filter((s) => !s.deletedAt));
        setFolders(fs);
        if (list[0]) setSelected(list[0].scriptId);
      })
      .catch(() => setStatus("saveError"));
    const timer = setInterval(flush, 600);
    const visibility = () => {
      void flush();
      if (document.hidden) engine.suspend();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", visibility);
    const connectivity = () => setOnline(navigator.onLine);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => {
      clearInterval(timer);
      void flush();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", visibility);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `teleo. — ${t(route === "/studio" ? "studio" : route === "/remote" ? "remote" : route === "/help" ? "help" : route === "/privacy" ? "privacy" : "tagline")}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("description"));
    document.querySelectorAll("link[data-locale]").forEach((n) => n.remove());
    for (const lang of ["en", "uk", "ru"]) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = lang;
      link.href = `https://teleo.cc${route}?lang=${lang}`;
      link.dataset.locale = "true";
      document.head.appendChild(link);
    }
    let canonical = document.querySelector<HTMLLinkElement>(
      "link[rel=canonical]",
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://teleo.cc${route}?lang=${locale}`;
  }, [locale, route]);
  useEffect(() => {
    const pop = () => setRoute(location.pathname);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    engine.suspend();
    engine.position = Number(localGet("teleo.position." + selected)) || 0;
    engine.speed = current?.preferences.speed || 1;
  }, [selected]);
  useEffect(() => {
    if (!reading) return;
    let raf = 0;
    const tick = (now: number) => {
      const view = viewport.current;
      if (view) {
        engine.maximum = Math.max(0, view.scrollHeight - view.clientHeight);
        view.scrollTop = engine.tick(now);
        localSet("teleo.position." + selected, String(engine.position));
        setFrame((x) => x + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      engine.suspend();
    };
  }, [reading, selected]);
  useEffect(() => {
    const playing = reading && engine.playing;
    let cancelled = false;
    if (playing && "wakeLock" in navigator)
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) void lock.release();
          else wake.current = lock;
        })
        .catch(() => {});
    else {
      void wake.current?.release();
      wake.current = null;
    }
    return () => {
      cancelled = true;
      void wake.current?.release();
      wake.current = null;
    };
  }, [reading, engine.playing]);
  useEffect(() => {
    localSet("teleo.profile", profile);
    localSet("teleo.mapping", JSON.stringify(mapping));
    localSet("teleo.keys", String(enabled));
    localSet("teleo.presets", presets);
  }, [profile, mapping, enabled, presets]);
  useEffect(() => {
    if (!learn && !testing) return;
    const timer = setTimeout(() => {
      setKeyEvent("");
      setLearn(null);
      setTesting(false);
      setNotice("noKey");
    }, 10000);
    return () => clearTimeout(timer);
  }, [learn, testing]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editable = !!target.closest(
        "input,textarea,select,[contenteditable=true],[role=dialog]",
      );
      if (e.key === "Escape" && reading) {
        exitReader();
        return;
      }
      if (!keyboardSafe(e, editable, reading || !!learn || testing)) return;
      if (learn || testing) {
        e.preventDefault();
        setKeyEvent(`${e.code} / ${e.key}`);
        if (learn) {
          if (mapping[e.code] && mapping[e.code] !== learn) {
            setNotice("conflict");
            return;
          }
          setMapping({ ...mapping, [e.code]: learn });
          setLearn(null);
        }
        setTesting(false);
        return;
      }
      if (!enabled) return;
      const a = (profile === "standard" ? standardKeys : mapping)[e.code];
      if (!a) return;
      e.preventDefault();
      if (a === "mirror")
        pref({
          mirrorHorizontal: !currentRef.current?.preferences.mirrorHorizontal,
        });
      else if (a === "preset") {
        const values = presets
          .split(",")
          .map(Number)
          .filter((n) => n >= 0.5 && n <= 3);
        command({
          action: "setSpeed",
          value: values.find((v) => v > engine.speed) ?? values[0] ?? 1,
        });
      } else command({ action: a });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    remote.current.onEvent = (e) => {
      const statuses: Record<string, Key> = {
        connecting: "connecting",
        waiting: "waiting",
        connected: "connected",
        reconnecting: "reconnecting",
        disconnected: "disconnected",
        unavailable: "unavailable",
      };
      if (statuses[e.type]) setRemoteStatus(statuses[e.type]);
      if (e.type === "approval") setApproval(true);
      if (e.type === "unconfirmed") setNotice("unconfirmed");
      if (e.type === "stateRequest" && reading)
        remote.current.state({
          playing: engine.playing,
          speed: engine.speed,
          position: engine.position,
        });
      if (e.type === "state" && e.state) setRemoteState(e.state);
      if (e.type === "command" && e.command && reading) {
        command(e.command);
        remote.current.send({
          type: "ack",
          id: e.id,
          state: {
            playing: engine.playing,
            speed: engine.speed,
            position: engine.position,
          },
        });
      }
      if (e.type === "ack" && e.id === lastAck.current && e.state)
        setRemoteState(e.state);
    };
  });
  useEffect(() => {
    if (!reading || remoteStatus !== "connected") return;
    const snapshot = () =>
      remote.current.state({
        playing: engine.playing,
        speed: engine.speed,
        position: engine.position,
      });
    snapshot();
    const timer = setInterval(snapshot, 1000);
    return () => clearInterval(timer);
  }, [reading, remoteStatus]);
  useEffect(() => {
    if (route !== "/remote") return;
    const acceptInvitation = () => {
      const pair = new URLSearchParams(location.hash.slice(1)).get("pair");
      if (!pair) return;
      history.replaceState({}, "", location.pathname + location.search);
      try {
        remote.current.controller(pair);
        lastAck.current = "";
        setNotice(null);
      } catch {
        setRemoteStatus("expired");
      }
    };
    acceptInvitation();
    window.addEventListener("hashchange", acceptInvitation);
    return () => {
      window.removeEventListener("hashchange", acceptInvitation);
      remote.current.close();
    };
  }, [route]);
  function navigate(path: string) {
    void flush();
    engine.suspend();
    setReading(false);
    remote.current.close();
    setRemoteStatus(null);
    history.pushState({}, "", path);
    setRoute(path);
  }
  async function add(s = createScript(t("untitled"))) {
    await flush();
    setScripts((list) => [s, ...list]);
    setSelected(s.scriptId);
    persist(s);
  }
  function exitReader() {
    setReading(false);
    engine.suspend();
    remote.current.close();
    setInvite("");
    setRemoteStatus(null);
    if (document.fullscreenElement) void document.exitFullscreen();
  }
  async function startReader() {
    await flush();
    setReading(true);
  }
  async function connect() {
    setApproval(false);
    setInvite("");
    setQR("");
    if (!reading) {
      await startReader();
    }
    try {
      setRemoteStatus("connecting");
      const url = await remote.current.host();
      setInvite(url);
      setQR(await QRCode.toDataURL(url, { width: 220, margin: 2 }));
    } catch {
      setRemoteStatus("unavailable");
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 10_000_000) throw Error();
      const text = await file.text();
      const imported = file.name.toLowerCase().endsWith(".json")
        ? parseBundle(text)
        : [createScript(file.name.replace(/\.txt$/i, ""), text)];
      for (const script of imported) {
        await add({ ...script, scriptId: crypto.randomUUID() });
      }
    } catch {
      setNotice("invalidImport");
    }
  }
  const button = (key: Key, fn: () => void, primary = false) => (
    <button className={primary ? "primary" : ""} onClick={fn}>
      {t(key)}
    </button>
  );
  const range = (
    key: keyof Preferences,
    min: number,
    max: number,
    step: number,
  ) => (
    <label>
      {t(key as Key)}{" "}
      <output>
        {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
          Number(current?.preferences[key]),
        )}
      </output>
      <input
        aria-label={t(key as Key)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(current?.preferences[key])}
        onChange={(e) => {
          const value = Number(e.target.value);
          pref({ [key]: value });
          if (key === "speed") engine.command({ action: "setSpeed", value });
        }}
      />
    </label>
  );
  const lang = (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) => {
        const l = e.target.value as Locale;
        setLocale(l);
        localSet("teleo.locale", l);
        const url = new URL(location.href);
        url.searchParams.set("lang", l);
        history.replaceState({}, "", url);
      }}
    >
      <option value="en">English</option>
      <option value="uk">Українська</option>
      <option value="ru">Русский</option>
    </select>
  );
  const controls = (
    <div
      className="reader-controls"
      aria-hidden={!controlsVisible}
      inert={!controlsVisible}
    >
      {button(
        engine.playing ? "pause" : "play",
        () => command({ action: engine.playing ? "pause" : "play" }),
        true,
      )}
      {button("restart", () => command({ action: "restart" }))}
      {button("speedDown", () => command({ action: "speedDown" }))}
      <output>{engine.speed.toFixed(2)}×</output>
      {button("speedUp", () => command({ action: "speedUp" }))}
      {button("previousParagraph", () =>
        command({ action: "previousParagraph" }),
      )}
      {button("nextParagraph", () => command({ action: "nextParagraph" }))}
    </div>
  );
  return (
    <>
      <header>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          teleo.
        </a>
        <nav>
          {(["home", "studio", "remote", "help", "privacy"] as const).map(
            (k) => (
              <a
                key={k}
                aria-current={
                  route === (k === "home" ? "/" : "/" + k) ? "page" : undefined
                }
                href={k === "home" ? "/" : "/" + k}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(k === "home" ? "/" : "/" + k);
                }}
              >
                {t(k)}
              </a>
            ),
          )}
        </nav>
        {lang}
      </header>
      {!online && (
        <p role="status" className="banner">
          {t("offline")}
        </p>
      )}
      {notice && (
        <div role="alert" className="banner">
          {t(notice)} {button("close", () => setNotice(null))}
        </div>
      )}
      {route === "/" ? (
        <main className="home">
          <div className="eyebrow">teleo. / {t("tagline")}</div>
          <h1>{t("intro")}</h1>
          <p className="lead">{t("description")}</p>
          {button("launch", () => navigate("/studio"), true)}
          <p className="muted">{t("local")}</p>
          <div className="demo">
            <span className="live-dot" /> <small>{t("tagline")}</small>
            <HomePreview text={t("intro") + " " + t("description")} t={t} />
          </div>
        </main>
      ) : route === "/help" || route === "/privacy" ? (
        <main className="prose">
          <div className="eyebrow">teleo. / {t(route.slice(1) as Key)}</div>
          <h1>{t(route === "/help" ? "helpTitle" : "privacyTitle")}</h1>
          <p>{t(route === "/help" ? "helpBody" : "privacyBody")}</p>
          <p>{t(route === "/help" ? "helpRemote" : "privacyRemote")}</p>
          {button("launch", () => navigate("/studio"), true)}
        </main>
      ) : route === "/remote" ? (
        <main className="controller">
          <h1>{t("remote")}</h1>
          <p role="status">{t(remoteStatus || "pairHelp")}</p>
          {remoteStatus === "connected" && (
            <>
              <div className="remote-buttons">
                {(
                  [
                    "play",
                    "pause",
                    "speedDown",
                    "speedUp",
                    "previousParagraph",
                    "nextParagraph",
                    "restart",
                  ] as Action[]
                ).map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      lastAck.current = remote.current.command({ action: a });
                    }}
                  >
                    {t(a as Key)}
                  </button>
                ))}
              </div>
              <output>
                {t(remoteState.playing ? "play" : "pause")} ·{" "}
                {remoteState.speed.toFixed(2)}×
              </output>
              {button("revoke", () => {
                remote.current.close();
                setRemoteStatus("disconnected");
              })}
            </>
          )}
        </main>
      ) : route === "/studio" ? (
        <main className="workspace">
          <aside className="library">
            <div className="section-title">
              <h2>{t("library")}</h2>
              {button("newScript", () => void add(), true)}
            </div>
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label={t("folder")}
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              <option value="">{t("allFolders")}</option>
              {folders.map((f) => (
                <option key={f.folderId} value={f.folderId}>
                  {f.title}
                </option>
              ))}
            </select>
            <div className="script-list">
              {scripts
                .filter(
                  (s) =>
                    (!folder || s.folderId === folder) &&
                    `${s.title} ${s.body}`
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase()),
                )
                .map((s) => (
                  <button
                    className={s.scriptId === selected ? "selected" : ""}
                    key={s.scriptId}
                    onClick={() => {
                      void flush();
                      setSelected(s.scriptId);
                      setRevisions(null);
                    }}
                  >
                    <strong>{s.title || t("untitled")}</strong>
                    <small>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(s.updatedAt))}
                    </small>
                  </button>
                ))}
            </div>
            <label className="file-button">
              {t("import")}
              <input
                type="file"
                accept=".txt,.json,text/plain,application/json"
                onChange={(e) => {
                  if (e.target.files?.[0]) void importFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {button("newFolder", () => {
              const title = prompt(t("folderName"));
              if (title?.trim()) {
                const f = { folderId: crypto.randomUUID(), title };
                storage
                  .folder(f)
                  .then(() => setFolders([...folders, f]))
                  .catch(() => setStatus("saveError"));
              }
            })}
            {folder && (
              <>
                {button("renameFolder", () => {
                  const title = prompt(
                    t("folderName"),
                    folders.find((f) => f.folderId === folder)?.title,
                  );
                  if (title?.trim()) {
                    const f = { folderId: folder, title };
                    storage
                      .folder(f)
                      .then(() =>
                        setFolders(
                          folders.map((x) => (x.folderId === folder ? f : x)),
                        ),
                      )
                      .catch(() => setStatus("saveError"));
                  }
                })}
                {button("deleteFolder", () => {
                  storage
                    .removeFolder(folder)
                    .then(async () => {
                      setFolders(await storage.folders());
                      setScripts(await storage.list());
                      setFolder("");
                    })
                    .catch(() => setStatus("saveError"));
                })}
              </>
            )}
          </aside>
          {current ? (
            <>
              <section className="editor">
                <div className="editor-top">
                  <span
                    role="status"
                    className={status === "saveError" ? "error" : "muted"}
                  >
                    {t(status)}
                  </span>
                  {button("read", () => void startReader(), true)}
                </div>
                <input
                  className="title-input"
                  aria-label={t("title")}
                  value={current.title}
                  onChange={(e) => edit({ title: e.target.value })}
                />
                <textarea
                  aria-label={t("body")}
                  placeholder={t("body")}
                  value={current.body}
                  onChange={(e) => edit({ body: e.target.value })}
                  onBlur={() => void flush()}
                />
                <div className="tools">
                  {button(
                    "duplicate",
                    () => void add(createScript(current.title, current.body)),
                  )}
                  {button("export", () =>
                    download((current.title || "teleo") + ".txt", current.body),
                  )}
                  {button("exportJSON", () =>
                    download(
                      "teleo.json",
                      exportBundle([current]),
                      "application/json",
                    ),
                  )}
                  {button("versions", () => {
                    void flush()
                      .then(() => storage.revisions(current.scriptId))
                      .then(setRevisions)
                      .catch(() => setStatus("saveError"));
                  })}
                  {button("delete", () => {
                    if (confirm(t("confirmDelete"))) {
                      const tombstone = {
                        ...current,
                        deletedAt: new Date().toISOString(),
                      };
                      persist(tombstone);
                      void flush();
                      setScripts(
                        scripts.filter((s) => s.scriptId !== selected),
                      );
                      setSelected(
                        scripts.find((s) => s.scriptId !== selected)
                          ?.scriptId || "",
                      );
                    }
                  })}
                </div>
                <label>
                  {t("folder")}
                  <select
                    value={current.folderId || ""}
                    onChange={(e) =>
                      edit({ folderId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t("noFolder")}</option>
                    {folders.map((f) => (
                      <option key={f.folderId} value={f.folderId}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </label>
                {revisions && (
                  <section>
                    <h3>{t("versions")}</h3>
                    {!revisions.length && <p>{t("noVersions")}</p>}
                    {revisions.map((r) => (
                      <div className="revision" key={r.revisionId}>
                        <time>
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(r.timestamp))}
                        </time>
                        <pre>{r.body.slice(0, 160)}</pre>
                        {button("restore", () => {
                          edit({ title: r.title, body: r.body });
                          void flush();
                          setRevisions(null);
                        })}
                      </div>
                    ))}
                  </section>
                )}
              </section>
              <aside className="settings">
                <h2>{t("settings")}</h2>
                <div
                  className="mini-preview"
                  style={{ textAlign: current.preferences.alignment }}
                >
                  <div
                    style={{
                      transform: `scale(${current.preferences.mirrorHorizontal ? -1 : 1},${current.preferences.mirrorVertical ? -1 : 1})`,
                    }}
                  >
                    {current.body || t("body")}
                  </div>
                </div>
                {range("speed", 0.5, 3, 0.25)}
                {range("fontSize", 16, 100, 1)}
                {range("lineHeight", 1, 3, 0.1)}
                {range("textWidth", 280, 1600, 20)}
                <label>
                  {t("alignment")}
                  <select
                    value={current.preferences.alignment}
                    onChange={(e) =>
                      pref({
                        alignment: e.target.value as Preferences["alignment"],
                      })
                    }
                  >
                    {(["left", "center", "right"] as const).map((a) => (
                      <option key={a} value={a}>
                        {t(a)}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  ["mirrorHorizontal", "mirrorVertical", "focusLine"] as const
                ).map((k) => (
                  <label className="check" key={k}>
                    <input
                      type="checkbox"
                      checked={current.preferences[k]}
                      onChange={(e) => pref({ [k]: e.target.checked })}
                    />
                    {t(k)}
                  </label>
                ))}
                <label>
                  {t("countdown")}
                  <select
                    value={current.preferences.countdownSeconds}
                    onChange={(e) =>
                      pref({ countdownSeconds: Number(e.target.value) })
                    }
                  >
                    {[0, 3, 5, 10].map((n) => (
                      <option value={n} key={n}>
                        {n ? `${n} ${t("seconds")}` : t("off")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("appearance")}
                  <select
                    value={current.preferences.appearance}
                    onChange={(e) =>
                      pref({ appearance: e.target.value as "dark" | "light" })
                    }
                  >
                    <option value="dark">{t("dark")}</option>
                    <option value="light">{t("light")}</option>
                  </select>
                </label>
                <details>
                  <summary>{t("physical")}</summary>
                  <p>{t("keyHelp")}</p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    {t("enabled")}
                  </label>
                  <label>
                    {t("profile")}
                    <select
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                    >
                      <option value="standard">{t("standard")}</option>
                      <option value="twoButton">{t("twoButton")}</option>
                      <option value="custom">{t("custom")}</option>
                    </select>
                  </label>
                  {profile === "twoButton" && (
                    <>
                      {button("learnA", () => setLearn("togglePlay"))}
                      {button("learnB", () => setLearn("preset"))}
                      <label>
                        {t("presets")}
                        <input
                          value={presets}
                          onChange={(e) => setPresets(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  {profile === "custom" && (
                    <>
                      <select
                        aria-label={t("custom")}
                        value={learnAction}
                        onChange={(e) =>
                          setLearnAction(e.target.value as Action)
                        }
                      >
                        {actions
                          .filter((a) => a !== "setSpeed")
                          .map((a) => (
                            <option key={a} value={a}>
                              {t(a as Key)}
                            </option>
                          ))}
                      </select>
                      {button("learn", () => setLearn(learnAction))}
                    </>
                  )}
                  {learn && <p role="status">{t("learning")}</p>}
                  {button("test", () => {
                    setTesting(true);
                    setKeyEvent("");
                  })}
                  <output>
                    {keyEvent || t(testing ? "learning" : "noKey")}
                  </output>
                  {Object.entries(
                    profile === "standard" ? standardKeys : mapping,
                  ).map(([key, a]) => (
                    <p key={key}>
                      <kbd>{key}</kbd> → {t(a as Key)}
                    </p>
                  ))}
                  {button("reset", () => setMapping({}))}
                </details>
                {button("connect", () => void connect())}
              </aside>
            </>
          ) : (
            <section className="empty">
              <h2>{t("empty")}</h2>
              {button("newScript", () => void add(), true)}
            </section>
          )}
        </main>
      ) : (
        <main className="prose">
          <h1>{t("notFound")}</h1>
        </main>
      )}
      {reading && current && (
        <section
          className={
            "reader " +
            current.preferences.appearance +
            (controlsVisible ? "" : " quiet")
          }
          onPointerMove={showControls}
          onClick={showControls}
          aria-label={t("read")}
        >
          <div className="reader-top">
            {button("exit", exitReader)}
            {button("fullscreen", () => {
              if (document.fullscreenEnabled)
                void document.documentElement
                  .requestFullscreen()
                  .catch(() => setNotice("permission"));
              else setNotice("permission");
            })}
            {button("connect", () => void connect())}
            {lang}
          </div>
          <div
            className="reading-viewport"
            ref={viewport}
            onWheel={() => command({ action: "pause" })}
            onTouchStart={() => command({ action: "pause" })}
            onScroll={(e) => {
              if (!engine.playing) engine.position = e.currentTarget.scrollTop;
            }}
          >
            <article
              ref={content}
              style={{
                fontSize: current.preferences.fontSize,
                lineHeight: current.preferences.lineHeight,
                maxWidth: current.preferences.textWidth,
                textAlign: current.preferences.alignment,
                transform: `scale(${current.preferences.mirrorHorizontal ? -1 : 1},${current.preferences.mirrorVertical ? -1 : 1})`,
              }}
            >
              {current.body.split(/\n\s*\n/).map((p, i) => (
                <p data-paragraph key={i} dir="auto">
                  {p || "\u00a0"}
                </p>
              ))}
            </article>
          </div>
          {current.preferences.focusLine && <div className="guide" />}
          {engine.countdown > 0 && (
            <div className="countdown">{Math.ceil(engine.countdown)}</div>
          )}
          {controls}
          <input
            className="seek"
            aria-label={t("position")}
            type="range"
            min="0"
            max={engine.maximum || 1}
            value={engine.position}
            onChange={(e) => {
              engine.command({ action: "pause" });
              engine.position = Number(e.target.value);
              setFrame(frame + 1);
            }}
          />
          {remoteStatus && (
            <div className="pair-panel">
              <p role="status">{t(remoteStatus)}</p>
              {invite && remoteStatus === "waiting" && (
                <>
                  <img src={qr} alt={t("invite")} />
                  <a href={invite} target="_blank" rel="noreferrer">
                    {t("invite")}
                  </a>
                </>
              )}
              {approval && (
                <>
                  <p>{t("approval")}</p>
                  {button("allow", () => {
                    remote.current.send({ type: "allow" });
                    setApproval(false);
                    setInvite("");
                  })}
                  {button("deny", () => {
                    remote.current.send({ type: "deny" });
                    remote.current.close();
                    setRemoteStatus("disconnected");
                    setApproval(false);
                    setInvite("");
                  })}
                </>
              )}
              {remoteStatus === "disconnected" || remoteStatus === "unavailable"
                ? button("reconnect", () => void connect())
                : button("revoke", () => {
                    remote.current.close();
                    setRemoteStatus("disconnected");
                    setInvite("");
                    setApproval(false);
                  })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
// Keep the root across Vite module replacement; never attach React twice.
const reactRoot =
  import.meta.hot?.data.reactRoot ??
  createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.reactRoot = reactRoot;
reactRoot.render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
