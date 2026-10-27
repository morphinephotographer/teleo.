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
import { RemoteLink, type PlaybackState } from "./remote";
import {
  type ControlCommand,
  type ControlValues,
} from "../../../packages/protocol/control";
import { ActionDialog } from "./ActionDialog";
import { Intro, introNeeded } from "./Intro";
import { IconButton, Segmented, Sheet } from "./ui";
import { TeleoSelect, TeleoMenu } from "./menus";
import { RemoteController } from "./RemoteController";
import { HostPreview } from "./host-preview";
import {
  PreviewReceiver,
  paragraphs as previewParagraphs,
  type PreviewPermission,
  type PreviewEnvelope,
} from "../../../packages/protocol/preview";
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
  const [wide, setWide] = useState(innerWidth >= 1180);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState("playback");
  const [previewAllowed, setPreviewAllowed] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const receiver = useRef(new PreviewReceiver());
  const lastPreviewPosition = useRef({ paragraph: 0, offset: 0 });
  const [, refreshPreview] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const pairGeneration = useRef(0);
  const [actionDialog, setActionDialog] = useState<{
    kind: "newFolder" | "renameFolder" | "deleteFolder" | "deleteScript";
    id?: string;
    initial?: string;
  } | null>(null);
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
    [remoteState, setRemoteState] = useState<PlaybackState>({
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
  const sender = useRef<HostPreview | null>(null);
  if (!sender.current) sender.current = new HostPreview(remote.current);
  useEffect(() => {
    const mq = matchMedia("(min-width: 1180px)");
    const resize = () => setWide(mq.matches);
    mq.addEventListener("change", resize);
    return () => mq.removeEventListener("change", resize);
  }, []);
  useEffect(() => () => sender.current?.dispose(), []);
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
      root.style.setProperty(
        "--visual-bottom",
        `${Math.max(0, innerHeight - (visual?.height || innerHeight) - (visual?.offsetTop || 0))}px`,
      );
    };
    visual?.addEventListener("resize", resize);
    visual?.addEventListener("scroll", resize);
    resize();
    return () => {
      visual?.removeEventListener("resize", resize);
      visual?.removeEventListener("scroll", resize);
      document.documentElement.style.removeProperty("--visual-height");
      document.documentElement.style.removeProperty("--visual-top");
      document.documentElement.style.removeProperty("--visual-bottom");
    };
  }, []);
  useEffect(() => {
    localSet("teleo.focusPosition", String(focusPosition));
    localSet("teleo.focusDimming", String(focusDimming));
    localSet("teleo.theme", theme);
  }, [focusPosition, focusDimming, theme]);
  currentRef.current = current;
  const controlTarget = useMemo(
    () => crypto.randomUUID(),
    [current?.scriptId, current?.body],
  );
  const controlTargetRef = useRef(controlTarget);
  controlTargetRef.current = controlTarget;
  function hostState(): PlaybackState {
    const p = currentRef.current?.preferences;
    return {
      playing: engine.playing,
      speed: engine.speed,
      position: engine.position,
      ...(p
        ? {
            controls: {
              version: 1 as const,
              target: controlTargetRef.current,
              maximum: currentRef.current?.body.trim() ? engine.maximum : 0,
              ...(previewAllowed && viewport.current && engine.maximum > 0
                ? {
                    marks: paragraphs()
                      .filter(
                        (_, i, all) =>
                          i > 0 &&
                          i % Math.max(1, Math.ceil(all.length / 12)) === 0,
                      )
                      .slice(0, 12)
                      .map((p) =>
                        Number(
                          Math.max(0, Math.min(1, p / engine.maximum)).toFixed(
                            4,
                          ),
                        ),
                      ),
                  }
                : {}),
              fontSize: p.fontSize,
              lineHeight: p.lineHeight,
              textWidth: p.textWidth,
              mirrorHorizontal: p.mirrorHorizontal,
              mirrorVertical: p.mirrorVertical,
              focusLine: p.focusLine,
              countdownSeconds: p.countdownSeconds,
            },
          }
        : {}),
    };
  }
  const previewOffsets = useMemo(
    () => previewParagraphs(current?.body || ""),
    [current?.body],
  );
  useEffect(() => {
    void sender.current?.script(current);
  }, [current?.scriptId, current?.title, current?.body]);
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
  const mutation = useRef<string | null>(null);
  const edit = (patch: Partial<Script>) => {
    if (!currentRef.current) return;
    if (
      mutation.current === "*" ||
      mutation.current === currentRef.current.scriptId
    )
      return;
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
      endRemote();
      setRemoteStatus(null);
      setRoute(location.pathname === "/" ? "/studio" : location.pathname);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    engine.suspend();
    lastPreviewPosition.current = { paragraph: 0, offset: 0 };
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
        engine.maximum = currentRef.current?.body.trim()
          ? Math.max(0, view.scrollHeight - view.clientHeight)
          : 0;
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
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      if (target.closest("dialog") && !learn && !testing) return;
      const editable = !!target.closest(
        "input,textarea,select,[contenteditable=true],[role=dialog],[role=combobox],[role=listbox],[role=menu]",
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
      if (e.type === "connected") {
        setPairOpen(false);
        setInvite("");
        setQR("");
        setApproval(false);
      }
      if (
        [
          "connecting",
          "waiting",
          "reconnecting",
          "disconnected",
          "unavailable",
        ].includes(e.type)
      ) {
        sender.current?.disconnect();
        setPreviewAllowed(false);
        setPreviewPending(false);
        receiver.current.allowed = false;
        receiver.current.clear();
        refreshPreview((x) => x + 1);
      }
      if (e.type === "previewPermission" && e.preview) {
        const permission = e.preview as PreviewPermission;
        if (route === "/remote") {
          receiver.current.permission(permission);
          refreshPreview((x) => x + 1);
        } else {
          setPreviewAllowed(permission.allowed);
          setPreviewPending(false);
          sender.current?.permission(permission);
        }
      }
      if (
        (e.type === "previewContent" ||
          e.type === "previewPosition" ||
          e.type === "previewUnavailable") &&
        e.preview &&
        route === "/remote"
      ) {
        if (receiver.current.receive(e.preview as PreviewEnvelope))
          refreshPreview((x) => x + 1);
      }
      if (e.type === "previewRequest" && route !== "/remote")
        sender.current?.publish();
      if (e.type === "approval") setApproval(true);
      if (e.type === "unconfirmed") setNotice("unconfirmed");
      if (
        e.type === "stateRequest" &&
        currentRef.current &&
        route === "/studio"
      )
        remote.current.state(hostState());
      if (e.type === "state" && e.state) setRemoteState(e.state);
      if (
        e.type === "command" &&
        e.command &&
        currentRef.current &&
        route === "/studio"
      ) {
        const socket = remote.current.socket,
          requested = e.command;
        const apply = () => {
          if (
            remote.current.socket !== socket ||
            socket?.readyState !== WebSocket.OPEN
          )
            return;
          if (
            "target" in requested &&
            requested.target !== controlTargetRef.current
          ) {
            remote.current.send({ type: "ack", id: e.id, state: hostState() });
            return;
          }
          const currentView = viewport.current;
          if (currentView)
            engine.maximum = currentRef.current?.body.trim()
              ? Math.max(0, currentView.scrollHeight - currentView.clientHeight)
              : 0;
          const acknowledge = () => {
            if (remote.current.socket !== socket) return;
            remote.current.send({ type: "ack", id: e.id, state: hostState() });
          };
          if (requested.action === "setPreference") {
            const fraction =
              engine.maximum > 0 ? engine.position / engine.maximum : 0;
            pref({
              [requested.key]: requested.value,
            } as Partial<ControlValues>);
            requestAnimationFrame(() => {
              if (
                remote.current.socket !== socket ||
                requested.target !== controlTargetRef.current
              ) {
                acknowledge();
                return;
              }
              const view = viewport.current;
              if (view) {
                engine.maximum = Math.max(
                  0,
                  view.scrollHeight - view.clientHeight,
                );
                engine.position = fraction * engine.maximum;
                view.scrollTop = engine.position;
              }
              acknowledge();
            });
          } else {
            if (requested.action === "seek") {
              engine.position = requested.value * engine.maximum;
              if (viewport.current)
                viewport.current.scrollTop = engine.position;
              setFrame((x) => x + 1);
            } else {
              command(requested);
              if (viewport.current)
                viewport.current.scrollTop = engine.position;
            }
            acknowledge();
          }
        };
        if (reading || requested.action === "setPreference") apply();
        else
          void flush().then(() => {
            if (remote.current.socket !== socket) return;
            setLibraryOpen(false);
            setReading(true);
            requestAnimationFrame(apply);
          });
      }
      if (e.type === "ack" && e.id === lastAck.current && e.state)
        setRemoteState(e.state);
    };
  });
  useEffect(() => {
    if (remoteStatus !== "connected" || route === "/remote") return;
    let previous = "";
    const snapshot = () => {
      const state = hostState(),
        signature = JSON.stringify(state);
      if (signature !== previous) {
        remote.current.state(state);
        previous = signature;
      }
    };
    snapshot();
    const timer = setInterval(snapshot, 500);
    return () => clearInterval(timer);
  }, [reading, remoteStatus, previewAllowed, controlTarget]);
  useEffect(() => {
    if (remoteStatus !== "connected" || route === "/remote") return;
    const update = () => {
      const view = viewport.current,
        article = content.current;
      if (!view || !article) {
        const index = Math.min(
          lastPreviewPosition.current.paragraph,
          previewOffsets.length - 1,
        );
        sender.current?.position(
          { playing: false, speed: engine.speed, position: engine.position },
          Math.max(0, index),
          previewOffsets[Math.max(0, index)]?.offset || 0,
        );
        return;
      }
      const target = view.scrollTop + (view.clientHeight * focusPosition) / 100;
      let index = 0;
      Array.from(
        article.querySelectorAll<HTMLElement>("[data-paragraph]"),
      ).forEach((p, i) => {
        if (p.offsetTop - article.offsetTop <= target) index = i;
      });
      lastPreviewPosition.current = {
        paragraph: index,
        offset: previewOffsets[index]?.offset || 0,
      };
      sender.current?.position(
        {
          playing: engine.playing,
          speed: engine.speed,
          position: engine.position,
        },
        index,
        previewOffsets[index]?.offset || 0,
      );
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [reading, remoteStatus, route, focusPosition, previewOffsets]);
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
      endRemote();
    };
  }, [route]);
  function endRemote() {
    pairGeneration.current++;
    setPairOpen(false);
    remote.current.close();
    sender.current?.disconnect();
    receiver.current.allowed = false;
    receiver.current.clear();
    setPreviewAllowed(false);
    setPreviewPending(false);
    refreshPreview((x) => x + 1);
  }
  function navigate(path: string) {
    void flush();
    engine.suspend();
    setReading(false);
    endRemote();
    setRemoteStatus(null);
    history.pushState({}, "", path);
    setSettingsOpen(false);
    setRoute(path === "/" ? "/studio" : path);
  }
  async function add(s = createScript(t("untitled"))) {
    const completed = flush();
    setScripts((list) => [s, ...list]);
    setSelected(s.scriptId);
    setPanel("editor");
    if (innerWidth <= 900) setLibraryOpen(false);
    persist(s);
    await completed;
  }
  function editMode() {
    engine.suspend();
    setReading(false);
    setImmersive(false);
    setLibraryOpen(libraryBeforeReading.current);
    localSet("teleo.position." + selected, String(engine.position));
    remote.current.state({
      playing: false,
      speed: engine.speed,
      position: engine.position,
    });
    if (document.fullscreenElement) void document.exitFullscreen();
  }
  function exitReader() {
    setLibraryOpen(libraryBeforeReading.current);
    localSet("teleo.position." + selected, String(engine.position));
    setReading(false);
    setImmersive(false);
    engine.suspend();
    endRemote();
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
  async function showConnection() {
    if (remoteStatus !== null) setPairOpen(true);
    else await connect();
  }
  async function connect() {
    endRemote();
    const generation = pairGeneration.current;
    setPairOpen(true);
    setSettingsOpen(false);
    setApproval(false);
    setInvite("");
    setQR("");
    try {
      setRemoteStatus("connecting");
      const url = await remote.current.host();
      const image = await QRCode.toDataURL(url, { width: 240, margin: 3 });
      if (generation !== pairGeneration.current) return;
      setInvite(url);
      setQR(image);
    } catch {
      if (generation === pairGeneration.current) setRemoteStatus("unavailable");
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
    <TeleoSelect
      label={t("language")}
      value={locale}
      onChange={(value) => {
        const l = value as Locale;
        setLocale(l);
        localSet("teleo.locale", l);
        const url = new URL(location.href);
        url.searchParams.set("lang", l);
        history.replaceState({}, "", url);
      }}
      options={[
        { value: "en", label: "English" },
        { value: "uk", label: "Українська" },
        { value: "ru", label: "Русский" },
      ]}
      className="language-picker"
    />
  );
  const previewConsent = (
    <label className="check preview-consent">
      <input
        type="checkbox"
        checked={previewAllowed}
        disabled={previewPending}
        aria-busy={previewPending}
        onChange={(e) => {
          setPreviewAllowed(e.target.checked);
          setPreviewPending(true);
          if (!e.target.checked) sender.current?.disconnect();
          remote.current.previewPermission(e.target.checked);
        }}
      />
      {t("allowPreview")}
    </label>
  );
  const settingsContent = current ? (
    <aside className="settings">
      <h2>{t("settings")}</h2>
      <Segmented
        label={t("settings")}
        value={settingsTab}
        onChange={setSettingsTab}
        options={[
          { value: "playback", label: t("playbackTab") },
          { value: "text", label: t("textSettings") },
          { value: "appearance", label: t("appearance") },
        ]}
      />
      <div className="settings-tab-content">
        {settingsTab === "playback" && (
          <>
            {range("speed", 0.5, 3, 0.25)}
            <label>
              {t("countdown")}
              <TeleoSelect
                label={t("countdown")}
                value={String(current.preferences.countdownSeconds)}
                onChange={(v) => pref({ countdownSeconds: Number(v) })}
                options={[0, 3, 5, 10].map((n) => ({
                  value: String(n),
                  label: n ? `${n} ${t("seconds")}` : t("off"),
                }))}
              />
            </label>
          </>
        )}
        {settingsTab === "text" && (
          <>
            {range("fontSize", 16, 100, 1)}
            {range("lineHeight", 1, 3, 0.1)}
            {range("textWidth", 280, 1600, 20)}
            <div className="setting-group">
              <span>{t("alignment")}</span>
              <Segmented
                label={t("alignment")}
                value={current.preferences.alignment}
                onChange={(alignment) => pref({ alignment })}
                options={(["left", "center", "right"] as const).map(
                  (value) => ({ value, label: t(value) }),
                )}
              />
            </div>
          </>
        )}
        {settingsTab === "appearance" && (
          <>
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
              {t("focusPosition")}
              <output>{focusPosition}%</output>
              <input
                aria-label={t("focusPosition")}
                type="range"
                min="20"
                max="70"
                value={focusPosition}
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
            <div className="setting-group">
              <span>{t("interfaceTheme")}</span>
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
            </div>
          </>
        )}
      </div>
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
          <TeleoSelect
            label={t("profile")}
            value={profile}
            onChange={setProfile}
            options={(["standard", "twoButton", "custom"] as const).map(
              (value) => ({ value, label: t(value) }),
            )}
          />
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
            <TeleoSelect
              label={t("custom")}
              value={learnAction}
              onChange={(v) => setLearnAction(v as Action)}
              options={actions
                .filter((a) => a !== "setSpeed")
                .map((value) => ({ value, label: t(value as Key) }))}
            />
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
      {remoteStatus === "connected" ? (
        <>
          {previewConsent}
          {button("revoke", () => {
            endRemote();
            setRemoteStatus("disconnected");
            setApproval(false);
            setInvite("");
          })}
        </>
      ) : (
        button("connect", () => void connect())
      )}
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
        {route !== "/remote" && (
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
                <TeleoSelect
                  className="script-selector"
                  label={t("currentScript")}
                  value={selected}
                  onChange={(id) => {
                    void flush();
                    setSelected(id);
                    setRevisions(null);
                  }}
                  options={
                    current
                      ? scripts.map((script) => ({
                          value: script.scriptId,
                          label: script.title || t("untitled"),
                        }))
                      : [{ value: "", label: t("chooseScript") }]
                  }
                />
                <Segmented
                  label={t("workspaceMode")}
                  value={reading ? "prompt" : "script"}
                  onChange={(mode) =>
                    mode === "prompt" ? void startReader() : editMode()
                  }
                  options={[
                    { value: "script", label: t("editor"), disabled: !current },
                    { value: "prompt", label: t("read"), disabled: !current },
                  ]}
                />
                <div className="toolbar-spacer" />
                <IconButton
                  className={
                    remoteStatus === "connected" ? "has-connection" : ""
                  }
                  name="remote"
                  label={t("remoteConnection")}
                  disabled={!current}
                  onClick={() => void showConnection()}
                />
                <IconButton
                  name="settings"
                  label={t("settings")}
                  disabled={!current}
                  active={wide && !reading ? !settingsCollapsed : settingsOpen}
                  onClick={() =>
                    wide && !reading
                      ? setSettingsCollapsed((v) => !v)
                      : setSettingsOpen(true)
                  }
                />
              </>
            )}
            <TeleoMenu
              closeLabel={t("close")}
              className="app-menu"
              label={t("menu")}
              items={(["studio", "remote", "help", "privacy"] as const).map(
                (k) => ({ label: t(k), action: () => navigate("/" + k) }),
              )}
            />
            {lang}
          </header>
        )}
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
          <RemoteController
            t={t}
            status={remoteStatus}
            state={remoteState}
            preview={receiver.current}
            language={lang}
            onStudio={() => navigate("/studio")}
            onRequest={() => remote.current.requestPreview()}
            onCommand={(command: ControlCommand) => {
              lastAck.current = remote.current.command(command);
            }}
            onDisconnect={() => {
              endRemote();
              receiver.current.allowed = false;
              receiver.current.clear();
              setRemoteStatus("disconnected");
            }}
          />
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
              <TeleoSelect
                label={t("folder")}
                value={folder}
                onChange={setFolder}
                options={[
                  { value: "", label: t("allFolders") },
                  ...folders.map((f) => ({
                    value: f.folderId,
                    label: f.title,
                  })),
                ]}
              />
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
              {button("newFolder", () =>
                setActionDialog({ kind: "newFolder" }),
              )}
              {folder && (
                <>
                  {button("renameFolder", () =>
                    setActionDialog({
                      kind: "renameFolder",
                      id: folder,
                      initial: folders.find((f) => f.folderId === folder)
                        ?.title,
                    }),
                  )}
                  {button("deleteFolder", () =>
                    setActionDialog({ kind: "deleteFolder", id: folder }),
                  )}
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
                  <div
                    className="document-actions"
                    role="toolbar"
                    aria-label={t("documentActions")}
                  >
                    {button(
                      "duplicate",
                      () => void add(createScript(current.title, current.body)),
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
                    {button("delete", () =>
                      setActionDialog({
                        kind: "deleteScript",
                        id: current.scriptId,
                      }),
                    )}
                  </div>
                  <label>
                    {t("folder")}
                    <TeleoSelect
                      label={t("scriptFolder")}
                      value={current.folderId || ""}
                      onChange={(value) =>
                        edit({ folderId: value || undefined })
                      }
                      options={[
                        { value: "", label: t("noFolder") },
                        ...folders.map((f) => ({
                          value: f.folderId,
                          label: f.title,
                        })),
                      ]}
                    />
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
                {wide && !reading && !settingsCollapsed && (
                  <aside
                    className="integrated-settings"
                    aria-label={t("settings")}
                  >
                    {settingsContent}
                  </aside>
                )}
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
              {button(
                remoteStatus === "connected" ? "connection" : "connect",
                () => void showConnection(),
              )}
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
          </section>
        )}
        {pairOpen && (
          <Sheet
            open={pairOpen}
            className="pairing-sheet"
            title={t("remoteConnection")}
            closeLabel={t("close")}
            onClose={() => setPairOpen(false)}
          >
            <div className="pair-panel">
              <p role="status">{t(remoteStatus || "waiting")}</p>
              {remoteStatus === "connected" && previewConsent}
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
                    endRemote();
                    setRemoteStatus("disconnected");
                    setApproval(false);
                    setInvite("");
                  })}
                </>
              )}
              {remoteStatus === "disconnected" || remoteStatus === "unavailable"
                ? button("reconnect", () => void connect())
                : button("revoke", () => {
                    endRemote();
                    setRemoteStatus("disconnected");
                    setInvite("");
                    setApproval(false);
                  })}
            </div>
          </Sheet>
        )}
        {actionDialog && (
          <ActionDialog
            key={actionDialog.kind + (actionDialog.id || "")}
            t={t}
            title={t(
              actionDialog.kind === "deleteScript"
                ? "confirmDelete"
                : actionDialog.kind,
            )}
            label={
              actionDialog.kind === "newFolder" ||
              actionDialog.kind === "renameFolder"
                ? t("folderName")
                : undefined
            }
            initial={actionDialog.initial}
            confirm={t(
              actionDialog.kind.startsWith("delete")
                ? "confirm"
                : actionDialog.kind === "newFolder"
                  ? "create"
                  : "save",
            )}
            danger={actionDialog.kind.startsWith("delete")}
            onClose={() => setActionDialog(null)}
            onSubmit={async (value) => {
              const { kind, id } = actionDialog;
              if (kind === "newFolder" || kind === "renameFolder") {
                const normalized = value.normalize("NFKC").toLocaleLowerCase();
                if (
                  folders.some(
                    (f) =>
                      f.folderId !== id &&
                      f.title.trim().normalize("NFKC").toLocaleLowerCase() ===
                        normalized,
                  )
                )
                  return "duplicateName";
                const entry = {
                  folderId: id || crypto.randomUUID(),
                  title: value,
                };
                await storage.folder(entry);
                setFolders(await storage.folders());
              } else if (kind === "deleteFolder" && id) {
                mutation.current = "*";
                try {
                  await writer.current!.requireSaved();
                  await storage.removeFolder(id);
                  if (currentRef.current?.folderId === id)
                    currentRef.current = {
                      ...currentRef.current,
                      folderId: undefined,
                    };
                  setFolders(await storage.folders());
                  setScripts(await storage.list());
                  setFolder("");
                } finally {
                  mutation.current = null;
                }
              } else if (kind === "deleteScript" && id) {
                const script = scripts.find((s) => s.scriptId === id);
                if (!script) return;
                mutation.current = id;
                try {
                  await writer.current!.requireSaved();
                  // A failed deletion must not be retried by background autosave after Cancel.
                  await storage.save(
                    { ...script, deletedAt: new Date().toISOString() },
                    true,
                  );
                  const remaining = scripts.filter((s) => s.scriptId !== id);
                  setScripts(remaining);
                  if (selected === id)
                    setSelected(remaining[0]?.scriptId || "");
                  if (!remaining.length) {
                    endRemote();
                    setRemoteStatus(null);
                    setInvite("");
                  }
                } finally {
                  mutation.current = null;
                }
              }
            }}
          />
        )}
        <Sheet
          open={settingsOpen && !intro && (!wide || reading)}
          title={t("settings")}
          closeLabel={t("close")}
          onClose={() => {
            setSettingsOpen(false);
            setLearn(null);
            setTesting(false);
          }}
        >
          {(!wide || reading) && settingsContent}
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
