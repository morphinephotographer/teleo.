import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { DraftWriter } from "./drafts";
import { RemoteLink } from "./remote";
import { Intro, introNeeded } from "./Intro";
import { Icon, IconButton, Segmented, Sheet } from "./ui";
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
function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    detectLocale(
      navigator.languages,
      new URLSearchParams(location.search).get("lang") ||
        localGet("teleo.locale"),
    ),
  );
  const t = (key: Key) => dictionaries[locale][key] || dictionaries.en[key];
  const [intro, setIntro] = useState(introNeeded);
  const [libraryOpen, setLibraryOpen] = useState(() => innerWidth > 900);
  const libraryBeforeReading = useRef(libraryOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [focusPosition, setFocusPosition] = useState(
    () => Number(localGet("teleo.focusPosition")) || 35,
  );
  const [focusDimming, setFocusDimming] = useState(
    () => localGet("teleo.focusDimming") === "true",
  );
  const [theme, setTheme] = useState(() => localGet("teleo.theme") || "system");
  const finishIntro = useCallback(() => {
    setIntro(false);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("header .brand")?.focus(),
    );
  }, []);
  const [panel, setPanel] = useState<"library" | "editor" | "settings">(
    "library",
  );
  const [route, setRoute] = useState(
      location.pathname === "/" ? "/studio" : location.pathname,
    ),
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
    wake = useRef<WakeLockSentinel | null>(null),
    lastAck = useRef("");
  const current = scripts.find((s) => s.scriptId === selected) ?? null;
  const wordCount = useMemo(
    () => current?.body.trim().split(/\s+/u).filter(Boolean).length || 0,
    [current?.body],
  );
  const bodyParagraphs = useMemo(
    () => current?.body.split(/\n\s*\n/) || [],
    [current?.body],
  );
  const duration = Math.ceil(
    wordCount / (150 * (current?.preferences.speed || 1)),
  );
  useEffect(() => {
    const visual = window.visualViewport;
    const resize = () => {
      const root = document.documentElement;
      root.style.setProperty(
        "--visual-height",
        `${visual?.height || innerHeight}px`,
      );
      root.style.setProperty("--visual-top", `${visual?.offsetTop || 0}px`);
    };
    visual?.addEventListener("resize", resize);
    visual?.addEventListener("scroll", resize);
    resize();
    return () => {
      visual?.removeEventListener("resize", resize);
      visual?.removeEventListener("scroll", resize);
      document.documentElement.style.removeProperty("--visual-height");
      document.documentElement.style.removeProperty("--visual-top");
    };
  }, []);
  useEffect(() => {
    localSet("teleo.focusPosition", String(focusPosition));
    localSet("teleo.focusDimming", String(focusDimming));
    localSet("teleo.theme", theme);
  }, [focusPosition, focusDimming, theme]);
  currentRef.current = current;
  const writer = useRef<DraftWriter | null>(null);
  if (!writer.current)
    writer.current = new DraftWriter(
      (script) => storage.save(script, true),
      (id, script) =>
        localSet("teleo.recovery." + id, script ? JSON.stringify(script) : ""),
      setStatus,
    );
  const persist = (script: Script) => writer.current!.enqueue(script);
  const flush = () => writer.current!.flush();
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
                  writer.current!.enqueue(recovered);
                }
              }
            }
          }
        } catch {
          /* Storage may be disabled. */
        }
        setScripts(list.filter((s) => !s.deletedAt));
        setFolders(fs);
        if (list[0]) {
          setSelected(list[0].scriptId);
          setPanel("editor");
        }
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
    const pop = () => {
      engine.suspend();
      setReading(false);
      remote.current.close();
      setRemoteStatus(null);
      setRoute(location.pathname === "/" ? "/studio" : location.pathname);
    };
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
    let raf = 0,
      lastUI = 0,
      lastSave = 0;
    const tick = (now: number) => {
      const view = viewport.current;
      if (view) {
        engine.maximum = Math.max(0, view.scrollHeight - view.clientHeight);
        view.scrollTop = engine.tick(now);
        if (now - lastSave >= 250) {
          localSet("teleo.position." + selected, String(engine.position));
          lastSave = now;
        }
        if (now - lastUI >= 100) {
          setFrame((x) => x + 1);
          lastUI = now;
        }
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
      if (intro || settingsOpen) {
        if (!learn && !testing) return;
      }
      const target = e.target as HTMLElement;
      const editable = !!target.closest(
        "input,textarea,select,[contenteditable=true],[role=dialog]",
      );
      if (e.key === "Escape" && reading && !settingsOpen) {
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
    setSettingsOpen(false);
    setRoute(path === "/" ? "/studio" : path);
  }
  async function add(s = createScript(t("untitled"))) {
    await flush();
    setScripts((list) => [s, ...list]);
    setSelected(s.scriptId);
    setPanel("editor");
    if (innerWidth <= 900) setLibraryOpen(false);
    persist(s);
  }
  function exitReader() {
    setLibraryOpen(libraryBeforeReading.current);
    localSet("teleo.position." + selected, String(engine.position));
    setReading(false);
    setImmersive(false);
    engine.suspend();
    remote.current.close();
    setInvite("");
    setRemoteStatus(null);
    if (document.fullscreenElement) void document.exitFullscreen();
  }
  async function startReader() {
    await flush();
    if (!reading) libraryBeforeReading.current = libraryOpen;
    setLibraryOpen(false);
    setReading(true);
  }
  async function connect() {
    setSettingsOpen(false);
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
  const settingsContent = current ? (
    <aside className="settings">
      <h3>{t("playbackSettings")}</h3>
      {range("speed", 0.5, 3, 0.25)}
      <h3>{t("textSettings")}</h3>
      {range("fontSize", 16, 100, 1)}
      <div className="advanced-settings">
        {range("lineHeight", 1, 3, 0.1)}
        {range("textWidth", 280, 1600, 20)}
        <div className="setting-group">
          <span>{t("alignment")}</span>
          <Segmented
            label={t("alignment")}
            value={current.preferences.alignment}
            onChange={(alignment) => pref({ alignment })}
            options={(["left", "center", "right"] as const).map((value) => ({
              value,
              label: t(value),
            }))}
          />
        </div>
        {(["mirrorHorizontal", "mirrorVertical", "focusLine"] as const).map(
          (k) => (
            <label className="check" key={k}>
              <input
                type="checkbox"
                checked={current.preferences[k]}
                onChange={(e) => pref({ [k]: e.target.checked })}
              />
              {t(k)}
            </label>
          ),
        )}
        <label>
          {t("countdown")}
          <select
            value={current.preferences.countdownSeconds}
            onChange={(e) => pref({ countdownSeconds: Number(e.target.value) })}
          >
            {[0, 3, 5, 10].map((n) => (
              <option value={n} key={n}>
                {n ? `${n} ${t("seconds")}` : t("off")}
              </option>
            ))}
          </select>
        </label>
        <div className="setting-group">
          <span>{t("appearance")}</span>
          <Segmented
            label={t("appearance")}
            value={current.preferences.appearance}
            onChange={(appearance) => pref({ appearance })}
            options={[
              { value: "dark", label: t("dark") },
              { value: "light", label: t("light") },
            ]}
          />
        </div>
      </div>
      <h3>{t("focusLine")}</h3>
      <label>
        {t("focusPosition")} <output>{focusPosition}%</output>
        <input
          type="range"
          min="20"
          max="70"
          value={focusPosition}
          aria-label={t("focusPosition")}
          onChange={(e) => setFocusPosition(Number(e.target.value))}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={focusDimming}
          onChange={(e) => setFocusDimming(e.target.checked)}
        />
        {t("focusDimming")}
      </label>
      <h3>{t("interfaceTheme")}</h3>
      <Segmented
        label={t("interfaceTheme")}
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: t("light") },
          { value: "dark", label: t("dark") },
          { value: "system", label: t("system") },
        ]}
      />
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
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
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
              onChange={(e) => setLearnAction(e.target.value as Action)}
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
        <output>{keyEvent || t(testing ? "learning" : "noKey")}</output>
        {Object.entries(profile === "standard" ? standardKeys : mapping).map(
          ([key, a]) => (
            <p key={key}>
              <kbd>{key}</kbd> → {t(a as Key)}
            </p>
          ),
        )}
        {button("reset", () => setMapping({}))}
      </details>
      {button("connect", () => void connect())}
    </aside>
  ) : null;
  useEffect(() => {
    const fullscreenChanged = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener("fullscreenchange", fullscreenChanged);
    return () =>
      document.removeEventListener("fullscreenchange", fullscreenChanged);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setImmersive(false);
      return;
    }
    if (immersive) {
      setImmersive(false);
      return;
    }
    setImmersive(true);
    if (document.fullscreenEnabled)
      void document.documentElement.requestFullscreen().catch(() => {});
  };
  const controls = (
    <div
      className="reader-controls"
      aria-hidden={!controlsVisible}
      inert={!controlsVisible}
    >
      <div className="dock-group">
        <IconButton
          name="restart"
          label={t("restart")}
          onClick={() => command({ action: "restart" })}
        />
      </div>
      <div className="dock-group speed-group">
        <IconButton
          name="minus"
          label={t("speedDown")}
          onClick={() => command({ action: "speedDown" })}
        />
        <output>{engine.speed.toFixed(2)}×</output>
        <IconButton
          name="plus"
          label={t("speedUp")}
          onClick={() => command({ action: "speedUp" })}
        />
      </div>
      <IconButton
        className="dock-play primary"
        name={engine.playing ? "pause" : "play"}
        label={t(engine.playing ? "pause" : "play")}
        onClick={() => command({ action: engine.playing ? "pause" : "play" })}
      />
      <div className="dock-group paragraph-group">
        <IconButton
          name="previous"
          label={t("previousParagraph")}
          onClick={() => command({ action: "previousParagraph" })}
        />
        <IconButton
          name="next"
          label={t("nextParagraph")}
          onClick={() => command({ action: "nextParagraph" })}
        />
      </div>
      <div className="dock-group text-group">
        <IconButton
          name="text"
          label={t("settings")}
          onClick={() => setSettingsOpen(true)}
        />
        <IconButton
          name="mirror"
          label={t("mirrorHorizontal")}
          active={current?.preferences.mirrorHorizontal}
          onClick={() =>
            pref({ mirrorHorizontal: !current?.preferences.mirrorHorizontal })
          }
        />
        <IconButton
          name="focus"
          label={t("focusLine")}
          active={current?.preferences.focusLine}
          onClick={() => pref({ focusLine: !current?.preferences.focusLine })}
        />
        <IconButton
          name="fullscreen"
          label={t("fullscreen")}
          active={immersive}
          onClick={toggleFullscreen}
        />
      </div>
    </div>
  );
  return (
    <>
      <div
        className={
          "app-shell route-" +
          route.slice(1) +
          (libraryOpen ? " library-open" : " library-collapsed") +
          (reading ? " prompting" : "") +
          (immersive ? " immersive" : "") +
          " theme-" +
          theme
        }
        inert={intro}
        aria-hidden={intro || undefined}
      >
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
          {route === "/studio" && (
            <>
              <IconButton
                name="library"
                label={t("library")}
                active={libraryOpen}
                onClick={() => {
                  if (reading) {
                    exitReader();
                    setLibraryOpen(true);
                  } else setLibraryOpen(!libraryOpen);
                  setPanel("library");
                }}
              />
              <select
                className="script-selector"
                aria-label={t("currentScript")}
                value={selected}
                onChange={(e) => {
                  void flush();
                  setSelected(e.target.value);
                  setRevisions(null);
                }}
              >
                {!current && <option value="">{t("chooseScript")}</option>}
                {scripts.map((script) => (
                  <option key={script.scriptId} value={script.scriptId}>
                    {script.title || t("untitled")}
                  </option>
                ))}
              </select>
              <Segmented
                label={t("workspaceMode")}
                value={reading ? "prompt" : "script"}
                onChange={(mode) =>
                  mode === "prompt" ? void startReader() : exitReader()
                }
                options={[
                  { value: "script", label: t("editor"), disabled: !current },
                  { value: "prompt", label: t("read"), disabled: !current },
                ]}
              />
              <div className="toolbar-spacer" />
              <IconButton
                className={remoteStatus === "connected" ? "has-connection" : ""}
                name="remote"
                label={t("remoteConnection")}
                disabled={!current}
                onClick={() => void connect()}
              />
              <IconButton
                name="settings"
                label={t("settings")}
                disabled={!current}
                active={settingsOpen}
                onClick={() => setSettingsOpen(true)}
              />
            </>
          )}
          <details className="app-menu">
            <summary aria-label={t("menu")}>
              <Icon name="more" />
            </summary>
            <nav>
              {(["studio", "remote", "help", "privacy"] as const).map((k) => (
                <a
                  key={k}
                  href={"/" + k}
                  aria-current={route === "/" + k ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    navigate("/" + k);
                  }}
                >
                  {t(k)}
                </a>
              ))}
            </nav>
          </details>
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
        {route === "/help" || route === "/privacy" ? (
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
                      className={
                        "remote-key remote-" +
                        a +
                        (a === "play" || a === "pause" ? " primary" : "")
                      }
                      onClick={() => {
                        try {
                          navigator.vibrate?.(12);
                        } catch {
                          /* Feedback must never block a command. */
                        }
                        lastAck.current = remote.current.command({ action: a });
                      }}
                    >
                      <span className="key-symbol" aria-hidden="true">
                        {
                          (
                            {
                              play: "▶",
                              pause: "Ⅱ",
                              speedDown: "−",
                              speedUp: "+",
                              previousParagraph: "↑",
                              nextParagraph: "↓",
                              restart: "↺",
                            } as Record<string, string>
                          )[a]
                        }
                      </span>
                      <span>{t(a as Key)}</span>
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
          <main
            inert={reading}
            aria-hidden={reading || undefined}
            className={
              "workspace panel-" +
              (current ? panel : "library") +
              (!current ? " no-script" : "")
            }
          >
            <aside className="library">
              <div className="section-title">
                <h2>{t("library")}</h2>
                <IconButton
                  name="close"
                  label={t("closeLibrary")}
                  onClick={() => setLibraryOpen(false)}
                />
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
                        setPanel("editor");
                        if (innerWidth <= 900) setLibraryOpen(false);
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
                    <span className="document-metrics">
                      {new Intl.NumberFormat(locale).format(wordCount)}{" "}
                      {t("words")}
                      <span>·</span>
                      {duration} {t("minutes")}
                    </span>
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
                  <details
                    className="document-actions"
                    open={innerWidth > 600 || undefined}
                  >
                    <summary>
                      {t("documentActions")}
                      <Icon name="more" />
                    </summary>
                    <div className="tools">
                      {button(
                        "duplicate",
                        () =>
                          void add(createScript(current.title, current.body)),
                      )}
                      {button("export", () =>
                        download(
                          (current.title || "teleo") + ".txt",
                          current.body,
                        ),
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
                  </details>
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
                    <section className="revision-panel">
                      {button("close", () => setRevisions(null))}
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
                <aside className="prompt-preview" aria-label={t("preview")}>
                  <div className="preview-caption">
                    <span className="eyebrow">{t("preview")}</span>
                    <Icon name="focus" />
                  </div>
                  <div
                    className={"preview-copy " + current.preferences.appearance}
                  >
                    <div
                      style={{
                        fontSize: Math.min(40, current.preferences.fontSize),
                        lineHeight: current.preferences.lineHeight,
                        textAlign: current.preferences.alignment,
                        transform: `scale(${current.preferences.mirrorHorizontal ? -1 : 1},${current.preferences.mirrorVertical ? -1 : 1})`,
                      }}
                    >
                      {current.body || t("body")}
                    </div>
                  </div>
                  <div className="preview-foot">
                    <span>{t("ready")}</span>
                    <span>{current.preferences.speed.toFixed(2)}×</span>
                  </div>
                </aside>
              </>
            ) : (
              <section className="empty">
                <span className="empty-mark" aria-hidden="true">
                  t.
                </span>
                <span className="eyebrow">{t("tagline")}</span>
                <h2>{t("emptyTitle")}</h2>
                <p>{t("empty")}</p>
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
            aria-label={t("read")}
            onPointerMove={showControls}
            onClick={showControls}
          >
            <div className="reader-top">
              {button("exit", exitReader)}
              <span className="reader-script-title">
                {current.title || t("untitled")}
              </span>
              <IconButton
                name="fullscreen"
                label={t("fullscreen")}
                active={immersive}
                onClick={toggleFullscreen}
              />
              {button("connect", () => void connect())}
              {lang}
            </div>
            <div className="reader-stage">
              <div
                className={
                  "reading-viewport" +
                  (focusDimming && current.preferences.focusLine
                    ? " dim-surroundings"
                    : "")
                }
                style={
                  {
                    "--focus-position": `${focusPosition}%`,
                  } as React.CSSProperties
                }
                ref={viewport}
                onWheel={() => command({ action: "pause" })}
                onTouchStart={() => command({ action: "pause" })}
                onScroll={(e) => {
                  if (!engine.playing)
                    engine.position = e.currentTarget.scrollTop;
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
                  {bodyParagraphs.map((p, i) => (
                    <p data-paragraph key={i} dir="auto">
                      {p || "\u00a0"}
                    </p>
                  ))}
                </article>
              </div>
              {current.preferences.focusLine && (
                <div className="guide" style={{ top: `${focusPosition}%` }} />
              )}
              {engine.countdown > 0 && (
                <div className="countdown">{Math.ceil(engine.countdown)}</div>
              )}
            </div>
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
                {remoteStatus === "disconnected" ||
                remoteStatus === "unavailable"
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
        <Sheet
          open={settingsOpen && !intro}
          title={t("settings")}
          closeLabel={t("close")}
          onClose={() => {
            setSettingsOpen(false);
            setLearn(null);
            setTesting(false);
          }}
        >
          {settingsContent}
        </Sheet>
      </div>
      {intro && <Intro skipLabel={t("skip")} onDone={finishIntro} />}
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
