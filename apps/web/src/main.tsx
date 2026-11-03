import type {
  QuickSend,
  QuickSendAck,
} from "../../../packages/protocol/quick-send";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { makeInvitationQR } from "./qr";
import { phonePairingIssue } from "./pairing-origin";
import { Wordmark } from "./Wordmark";
import { LanguageControl } from "./LanguageControl";
import { useLocale } from "./useLocale";
import { hasWorkspaceHistory, type WelcomeSettings } from "./welcome";
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
import { EditorTools, FindBar } from "./EditorTools";
import { ImportFileError, importTitle, readTextFile } from "./import-file";
import { version as appVersion } from "../../../package.json";
import { LibraryPanel, type LibraryAction } from "./LibraryPanel";
import { Intro, introNeeded } from "./Intro";
import { Tour, tourNeeded } from "./Tour";
import { Icon, IconButton, Sheet, type IconName } from "./ui";
import { TeleoSelect, Popover } from "./menus";
import { RemoteController } from "./RemoteController";
import { HostPreview } from "./host-preview";
import {
  PreviewReceiver,
  paragraphs as previewParagraphs,
  type PreviewPermission,
  type PreviewEnvelope,
} from "../../../packages/protocol/preview";
import { ReaderDock } from "./ReaderDock";
import {
  captureAnchor,
  restoreAnchor,
  type ReadingAnchor,
} from "./reading-anchor";
import { scrollToTextOffset, textOffsetAtView } from "./text-position";
import {
  VoiceFollow,
  voiceFollowSupported,
  type VoiceError,
  type VoiceStatus,
} from "./voice-follow";
import { speechLanguage } from "../../../packages/protocol/speech-follow";
import { r400Keys, r400Shortcut, bindReaderKeyboard, R400Hold } from "./r400";
import { readerShortcut } from "./reader-keyboard";
import {
  createReaderFullscreen,
  type FullscreenFailure,
} from "./reader-fullscreen";
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
  const [locale, setLocale] = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const welcomeContext = useRef({
    returning: hasWorkspaceHistory(),
    recovered: false,
  });
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [welcomeSettings, setWelcomeSettings] = useState<WelcomeSettings>({
    handled: true,
    autoCreate: localGet("teleo.demo.auto") !== "false",
    records: [],
  });
  const t = (key: Key) => dictionaries[locale][key] || dictionaries.en[key];
  const [receivedText, setReceivedText] = useState<{
    message: QuickSend;
    target: string;
  } | null>(null);
  const incoming = useRef<typeof receivedText>(null);
  const [reviewText, setReviewText] = useState(false);
  const transferResults = useRef(new Map<string, QuickSendAck>());
  const transferBusy = useRef(new Set<string>());
  const [intro, setIntro] = useState(introNeeded);
  const [libraryOpen, setLibraryOpen] = useState(() => innerWidth > 900);
  const [lastReadScript, setLastReadScript] = useState(
    () => localGet("teleo.lastReadScript") || "",
  );
  const libraryBeforeReading = useRef(libraryOpen);
  const [previewAllowed, setPreviewAllowed] = useState(
    () => localGet("teleo.previewAllowed") === "true",
  );
  // The saved choice is distinct from the relay's existing session/epoch authorization.
  const previewChoice = useRef(previewAllowed);
  const previewInitializing = useRef(false);
  const [previewPending, setPreviewPending] = useState(false);
  const receiver = useRef(new PreviewReceiver());
  const lastPreviewPosition = useRef({ paragraph: 0, offset: 0 });
  const [, refreshPreview] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const pairingIssue = phonePairingIssue(location.origin);
  const [inviteDeadline, setInviteDeadline] = useState(0);
  const [qrState, setQRState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pairGeneration = useRef(0);
  const [actionDialog, setActionDialog] = useState<LibraryAction | null>(null);
  const [trash, setTrash] = useState<Script[]>([]);
  const [immersive, setImmersive] = useState(false);
  const [fullscreenIssue, setFullscreenIssue] =
    useState<FullscreenFailure | null>(null);
  const fullscreenControl = useRef<ReturnType<
    typeof createReaderFullscreen
  > | null>(null);
  const readerKey = useRef<(event: KeyboardEvent) => void>(() => {});
  const r400Hold = useRef(new R400Hold());
  const readerRoot = useRef<HTMLElement>(null);
  const [focusPosition, setFocusPosition] = useState(
    () => Number(localGet("teleo.focusPosition")) || 35,
  );
  const [focusDimming, setFocusDimming] = useState(
    () => localGet("teleo.focusDimming") === "true",
  );
  const [theme, setTheme] = useState(() => localGet("teleo.theme") || "system");
  const [letterSpacing, setLetterSpacing] = useState(() =>
    Math.max(0, Math.min(10, Number(localGet("teleo.letterSpacing")) || 0)),
  );
  useEffect(
    () => localSet("teleo.letterSpacing", String(letterSpacing)),
    [letterSpacing],
  );

  const finishIntro = useCallback(() => {
    setIntro(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("header button:not([disabled])")
        ?.focus(),
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
    [, setFrame] = useState(0),
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
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts;
  const welcomeLocaleQueue = useRef(Promise.resolve());
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const showControls = () => {
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    // The only Pause action must remain reachable without waking hidden controls.
  };
  const remote = useRef(new RemoteLink()),
    viewport = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    currentRef = useRef<Script | null>(null),
    wake = useRef<WakeLockSentinel | null>(null),
    lastAck = useRef("");
  const lastHostState = useRef("");
  const focusPositionRef = useRef(focusPosition);
  focusPositionRef.current = focusPosition;
  // Voice follow: browser speech recognition moves the reading position.
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("off");
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState(
    () => localGet("teleo.voiceLanguage") || "auto",
  );
  useEffect(
    () => localSet("teleo.voiceLanguage", voiceLanguage),
    [voiceLanguage],
  );
  const voiceTarget = useRef<number | null>(null);
  const voiceScroll = useRef({
    desired: -1,
    measured: 0,
    value: -1,
    userAt: 0,
    painted: -1,
    last: 0,
  });
  const [voice] = useState(
    () =>
      new VoiceFollow(
        (offset) => {
          voiceTarget.current = offset;
          voiceScroll.current.desired = -1;
        },
        (status, error) => {
          setVoiceStatus(status);
          setVoiceError(error ?? null);
        },
      ),
  );
  const voiceOn = voiceStatus === "starting" || voiceStatus === "listening";
  /** A deliberate move (wheel, swipe, line/paragraph controls): follow resumes from the guide once it settles. */
  const voiceManual = () => {
    if (voice.running) voiceScroll.current.userAt = performance.now();
  };
  const geometry = useRef<{
    script: string;
    anchor: ReadingAnchor;
    position: number;
    mirrored: boolean;
    scroll: number;
    layout: string;
  } | null>(null);
  const geometryHeld = useRef(false);
  const geometryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const viewPosition = (view: HTMLElement) =>
    currentRef.current?.preferences.mirrorVertical
      ? engine.maximum - view.scrollTop
      : view.scrollTop;
  const syncView = (view: HTMLElement) => {
    view.scrollTop = currentRef.current?.preferences.mirrorVertical
      ? engine.maximum - engine.position
      : engine.position;
  };
  const viewLayout = (view: HTMLElement) =>
    `${view.clientWidth}/${view.clientHeight}/${view.scrollHeight}`;
  const rememberGeometry = () => {
    const view = viewport.current,
      script = currentRef.current;
    if (!view || !script) return;
    if (
      !geometryHeld.current ||
      geometry.current?.script !== script.scriptId ||
      (!engine.playing &&
        Math.abs(view.scrollTop - geometry.current.scroll) > 1)
    ) {
      const anchor = captureAnchor(view, focusPosition);
      geometry.current = anchor
        ? {
            script: script.scriptId,
            anchor,
            position: engine.position,
            mirrored: !!script.preferences.mirrorVertical,
            scroll: view.scrollTop,
            layout: viewLayout(view),
          }
        : null;
    }
    geometryHeld.current = true;
    clearTimeout(geometryTimer.current);
    geometryTimer.current = setTimeout(() => {
      geometryHeld.current = false;
    }, 400);
  };
  const restoreGeometry = () => {
    const view = viewport.current,
      script = currentRef.current;
    if (!view || !script) return;
    engine.maximum = script.body.trim()
      ? Math.max(0, view.scrollHeight - view.clientHeight)
      : 0;
    const saved = geometry.current;
    if (saved?.script === script.scriptId) {
      const anchor = {
        ...saved.anchor,
        delta:
          saved.anchor.delta -
          (engine.playing ? engine.position - saved.position : 0) *
            (saved.mirrored ? -1 : 1),
      };
      restoreAnchor(view, anchor, focusPosition);
      engine.position = viewPosition(view);
      geometry.current = {
        script: script.scriptId,
        anchor,
        position: engine.position,
        mirrored: !!script.preferences.mirrorVertical,
        scroll: view.scrollTop,
        layout: viewLayout(view),
      };
    } else {
      engine.position = Math.max(0, Math.min(engine.maximum, engine.position));
      syncView(view);
      engine.position = viewPosition(view);
      const anchor = captureAnchor(view, focusPosition);
      geometry.current = anchor
        ? {
            script: script.scriptId,
            anchor,
            position: engine.position,
            mirrored: !!script.preferences.mirrorVertical,
            scroll: view.scrollTop,
            layout: viewLayout(view),
          }
        : null;
    }
  };
  const restoreGeometryRef = useRef(restoreGeometry);
  restoreGeometryRef.current = restoreGeometry;
  const sender = useRef<HostPreview | null>(null);
  if (!sender.current)
    sender.current = new HostPreview(remote.current, () =>
      setNotice("unavailable"),
    );
  useEffect(
    () => () => {
      sender.current?.dispose();
      clearTimeout(controlsTimer.current);
      clearTimeout(geometryTimer.current);
      clearTimeout(inviteTimer.current);
      remote.current.close();
    },
    [],
  );
  const current = scripts.find((s) => s.scriptId === selected) ?? null;
  const [tour, setTour] = useState(false);
  const tourChecked = useRef(false);
  const tourOpenedReader = useRef(false);
  useEffect(() => {
    if (intro || !libraryLoaded || !current || route !== "/studio") return;
    if (reading || tourChecked.current) return;
    tourChecked.current = true;
    if (!tourNeeded()) return;
    // Let the workspace settle after the brand intro before pointing at it.
    const timer = setTimeout(() => setTour(true), 700);
    return () => clearTimeout(timer);
  }, [intro, libraryLoaded, current, route, reading]);
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
    const installed = matchMedia(
      "(display-mode: standalone), (display-mode: fullscreen)",
    );
    const resize = () => {
      const root = document.documentElement;
      const standalone =
        installed.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      root.dataset.standalone = String(standalone);
      const editing = document.activeElement?.matches(
        'textarea,input:not([type="range"]):not([type="checkbox"])',
      );
      root.dataset.keyboard = String(
        !!editing && (visual?.height || innerHeight) < root.clientHeight - 120,
      );
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
    window.addEventListener("resize", resize);
    installed.addEventListener("change", resize);
    resize();
    return () => {
      visual?.removeEventListener("resize", resize);
      visual?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      installed.removeEventListener("change", resize);
      delete document.documentElement.dataset.standalone;
      delete document.documentElement.dataset.keyboard;
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
  const dimmingRef = useRef(focusDimming);
  dimmingRef.current = focusDimming;
  currentRef.current = current;
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const dark = reading
        ? currentRef.current?.preferences.appearance !== "light"
        : theme === "dark" ||
          (theme === "system" && mq.matches) ||
          route === "/remote";
      const color = reading
        ? dark
          ? "#080909"
          : "#f1f1f0"
        : dark
          ? "#171719"
          : "#f5f5f7";
      document.documentElement.style.backgroundColor = color;
      document.body.style.backgroundColor = color;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", color);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme, reading, route, current?.preferences.appearance]);
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
              ...(previewChoice.current &&
              viewport.current &&
              engine.maximum > 0
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
              focusPosition,
              alignment: p.alignment,
              fontSize: p.fontSize,
              lineHeight: p.lineHeight,
              textWidth: p.textWidth,
              mirrorHorizontal: p.mirrorHorizontal,
              mirrorVertical: p.mirrorVertical,
              focusLine: p.focusLine,
              countdownSeconds: p.countdownSeconds,
              focusDimming: dimmingRef.current,
            },
          }
        : {}),
    };
  }
  function publishHostState() {
    const state = hostState(),
      signature = JSON.stringify(state);
    if (signature !== lastHostState.current) {
      remote.current.state(state);
      lastHostState.current = signature;
    }
  }
  const previewOffsets = useMemo(
    () => previewParagraphs(current?.body || ""),
    [current?.body],
  );
  const previewOffsetsRef = useRef(previewOffsets);
  previewOffsetsRef.current = previewOffsets;
  const voiceHighlight = "teleo-voice-read";
  const highlightRegistry = () =>
    (
      globalThis as unknown as {
        CSS?: { highlights?: Map<string, unknown> };
      }
    ).CSS?.highlights;
  /** Dims already-read text without touching the paragraph text nodes. */
  const paintVoiceHighlight = (view: HTMLElement, offset: number) => {
    const registry = highlightRegistry();
    const HighlightClass = (
      globalThis as unknown as {
        Highlight?: new (...ranges: Range[]) => unknown;
      }
    ).Highlight;
    if (!registry || !HighlightClass) return;
    const nodes = view.querySelectorAll<HTMLElement>("[data-paragraph]");
    const ranges: Range[] = [];
    previewOffsetsRef.current.forEach((block, index) => {
      const node = nodes[index]?.firstChild;
      if (block.offset >= offset || !(node instanceof Text)) return;
      const end = Math.min(node.length, offset - block.offset);
      if (end <= 0) return;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, end);
      ranges.push(range);
    });
    registry.set(voiceHighlight, new HighlightClass(...ranges));
  };
  /** Reading cues in [brackets] are dimmed in Reader (text nodes stay untouched). */
  useLayoutEffect(() => {
    const registry = highlightRegistry();
    const HighlightClass = (
      globalThis as unknown as {
        Highlight?: new (...ranges: Range[]) => unknown;
      }
    ).Highlight;
    const view = content.current;
    if (!registry || !HighlightClass) return;
    if (!reading || !view) {
      registry.delete("teleo-cue");
      return;
    }
    const ranges: Range[] = [];
    view.querySelectorAll<HTMLElement>("[data-paragraph]").forEach((p) => {
      const node = p.firstChild;
      if (!(node instanceof Text)) return;
      for (const m of node.data.matchAll(/\[[^\]\n]*\]/g)) {
        const range = document.createRange();
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        ranges.push(range);
      }
    });
    registry.set("teleo-cue", new HighlightClass(...ranges));
  }, [reading, bodyParagraphs]);
  const stopVoice = () => {
    voice.stop();
    voiceTarget.current = null;
    voiceScroll.current = { ...voiceScroll.current, painted: -1, value: -1 };
    highlightRegistry()?.delete(voiceHighlight);
  };
  const startVoice = () => {
    const view = viewport.current,
      script = currentRef.current;
    if (!view || !script) return;
    if (engine.playing) command({ action: "pause" });
    engine.countdown = 0;
    const from = Math.round(
      textOffsetAtView(
        view,
        previewOffsetsRef.current,
        focusPositionRef.current,
      ),
    );
    voiceScroll.current = {
      desired: -1,
      measured: 0,
      value: -1,
      userAt: 0,
      painted: -1,
      last: 0,
    };
    voice.start(
      script.body,
      voiceLanguage === "auto"
        ? speechLanguage(script.body, locale)
        : voiceLanguage,
      from,
    );
    showControls();
  };
  const voiceStepRef = useRef((_view: HTMLElement, _now: number) => {});
  /** Called every frame while voice follow is on: ease the guide to the spoken position. */
  voiceStepRef.current = (view, now) => {
    const s = voiceScroll.current;
    const dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 0;
    s.last = now;
    if (s.userAt) {
      // Manual scrolling wins; once it settles, continue from the guide line.
      if (now - s.userAt < 1200) return;
      s.userAt = 0;
      s.value = -1;
      voice.jump(
        textOffsetAtView(
          view,
          previewOffsetsRef.current,
          focusPositionRef.current,
        ),
      );
    }
    const target = voiceTarget.current;
    if (target === null) return;
    if (s.painted !== target) {
      paintVoiceHighlight(view, target);
      s.painted = target;
    }
    if (s.desired < 0 || now - s.measured > 300) {
      const keep = view.scrollTop;
      scrollToTextOffset(
        view,
        previewOffsetsRef.current,
        target,
        focusPositionRef.current,
      );
      s.desired = view.scrollTop;
      view.scrollTop = keep;
      s.measured = now;
    }
    if (s.value < 0 || Math.abs(view.scrollTop - s.value) > 2)
      s.value = view.scrollTop;
    const gap = s.desired - s.value;
    s.value =
      Math.abs(gap) < 0.5 ? s.desired : s.value + gap * (1 - Math.exp(-dt * 4));
    view.scrollTop = s.value;
    engine.position = viewPosition(view);
  };
  /**
   * The reader takes the scroll over (wheel, trackpad, touch, pointer).
   * Playback pauses at the place actually shown. The browser may already
   * have applied this wheel step when the event arrives, so the position is
   * read from the view first: writing the older engine position back would
   * undo the step and make the text shake in place. When nothing is playing
   * the view is left entirely to the browser.
   */
  const takeOverScroll = (view: HTMLElement) => {
    geometryHeld.current = false;
    geometry.current = null;
    engine.position = viewPosition(view);
    if (engine.playing || engine.countdown > 0) command({ action: "pause" });
  };
  /** Tap a word while voice follow is on to continue reading from it. */
  const voiceTap = (x: number, y: number) => {
    const view = viewport.current;
    if ((!voice.running && !voice.paused) || !view) return;
    const doc = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    let node: Node | null | undefined,
      offset = 0;
    if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(x, y);
      node = p?.offsetNode;
      offset = p?.offset || 0;
    } else if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(x, y);
      node = r?.startContainer;
      offset = r?.startOffset || 0;
    }
    const paragraph =
      node instanceof Text
        ? node.parentElement?.closest("[data-paragraph]")
        : null;
    if (!paragraph || !(node instanceof Text)) return;
    const index = Array.from(view.querySelectorAll("[data-paragraph]")).indexOf(
      paragraph,
    );
    const block = previewOffsetsRef.current[index];
    if (!block) return;
    // Snap back to the start of the tapped word.
    while (offset > 0 && /[\p{L}\p{N}'’ʼ-]/u.test(node.data[offset - 1]))
      offset--;
    voiceScroll.current.userAt = 0;
    voiceScroll.current.value = -1;
    // A tap is a user gesture: it also restarts listening that the browser paused.
    if (voice.paused) voice.resume(block.offset + offset);
    else voice.jump(block.offset + offset);
  };
  useEffect(() => {
    if (!reading) return;
    return () => stopVoice();
  }, [reading, selected, current?.body]);
  useEffect(() => {
    void sender.current?.script(current);
  }, [current?.scriptId, current?.title, current?.body]);
  const recoveryOwner = useRef(crypto.randomUUID());
  const writer = useRef<DraftWriter | null>(null);
  if (!writer.current)
    writer.current = new DraftWriter(
      (script) => storage.save(script, true),
      (id, script) =>
        localSet(
          "teleo.recovery." + id + "." + recoveryOwner.current,
          script ? JSON.stringify(script) : "",
        ),
      setStatus,
    );
  const persist = (script: Script) => writer.current!.enqueue(script);
  const flush = () => writer.current!.flush();
  const mutation = useRef<string | null>(null);
  const bodyArea = useRef<HTMLTextAreaElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const openFind = () => {
    if (!findOpen) setFindOpen(true);
    else {
      const field = document.querySelector<HTMLInputElement>(".find-bar input");
      field?.focus();
      field?.select();
    }
  };
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
    if (
      Object.keys(patch).some((key) =>
        [
          "fontSize",
          "lineHeight",
          "textWidth",
          "alignment",
          "mirrorHorizontal",
          "mirrorVertical",
        ].includes(key),
      )
    )
      rememberGeometry();
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
    if (
      (c.action === "play" || (c.action === "togglePlay" && !engine.playing)) &&
      engine.countdown <= 0
    )
      engine.countdown = currentRef.current?.preferences.countdownSeconds || 0;
    if (
      [
        "seek",
        "restart",
        "previousParagraph",
        "nextParagraph",
        "scrollBack",
        "scrollForward",
      ].includes(c.action)
    ) {
      geometryHeld.current = false;
      geometry.current = null;
      voiceManual();
    }
    if (
      (c.action === "nextParagraph" || c.action === "previousParagraph") &&
      currentRef.current?.preferences.mirrorVertical &&
      viewport.current
    ) {
      const view = viewport.current;
      const anchor = captureAnchor(view, focusPosition);
      const total = view.querySelectorAll("[data-paragraph]").length;
      if (anchor) {
        restoreAnchor(
          view,
          {
            paragraph: Math.max(
              0,
              Math.min(
                total - 1,
                anchor.paragraph + (c.action === "nextParagraph" ? 1 : -1),
              ),
            ),
            offset: 0,
            delta: 0,
          },
          focusPosition,
        );
        engine.position = viewPosition(view);
      }
    } else engine.command(c, paragraphs());
    if (viewport.current) syncView(viewport.current);
    if (
      currentRef.current &&
      engine.speed !== currentRef.current.preferences.speed
    )
      pref({ speed: engine.speed });
    showControls();
    setFrame((x) => x + 1);
  };
  useEffect(() => {
    Promise.all([storage.list(), storage.folders(), storage.trash()])
      .then(async ([list, fs, deleted]) => {
        let preferredRecovery: string | undefined;
        // Snapshot keys: cleanup must not skip entries. One malformed draft must not block others.
        const keys: string[] = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("teleo.recovery.")) keys.push(key);
          }
        } catch {
          /* Storage can be unavailable. */
        }
        for (const key of keys) {
          const raw = localGet(key);
          if (!raw) continue;
          try {
            const draft = JSON.parse(raw) as Script;
            const recovered = await storage.recover(
              draft,
              dictionaries[localeRef.current].recoveredCopy,
            );
            if (recovered.deletedAt) {
              if (localGet(key) === raw) localSet(key, "");
              continue;
            }
            const index = list.findIndex(
              (s) => s.scriptId === recovered.scriptId,
            );
            if (index >= 0) list[index] = recovered;
            else list.push(recovered);
            if (draft.scriptId === localGet("teleo.selectedScript"))
              preferredRecovery = recovered.scriptId;
            welcomeContext.current.recovered = true;
            if (localGet(key) === raw) localSet(key, "");
          } catch {
            setStatus("saveError");
          }
        }
        const initialized = await storage.welcome(localeRef.current, {
          automatic: ["/", "/studio"].includes(location.pathname),
          ...welcomeContext.current,
          localize: list,
        });
        for (const saved of initialized.scripts) {
          const index = list.findIndex(
            (item) => item.scriptId === saved.scriptId,
          );
          if (index < 0) list.push(saved);
          else list[index] = saved;
        }
        const visible = list.filter((item) => !item.deletedAt);
        setScripts(visible);
        setTrash(deleted);
        setWelcomeSettings(initialized.settings);
        setFolders(fs);
        const selection =
          visible.find(
            (item) =>
              item.scriptId ===
              (preferredRecovery || localGet("teleo.selectedScript")),
          ) ||
          initialized.selected ||
          visible[0];
        if (selection) {
          setSelected(selection.scriptId);
          setPanel("editor");
        }
        setLibraryLoaded(true);
      })
      .catch((error) => {
        setStatus("saveError");
        if (error instanceof Error && error.message === "databaseBlocked")
          setNotice("databaseBlocked");
      });
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
      dismissTransient();
      void flush();
      setRoute(location.pathname === "/" ? "/studio" : location.pathname);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useLayoutEffect(() => {
    geometry.current = null;
    geometryHeld.current = false;
    engine.suspend();
    lastPreviewPosition.current = { paragraph: 0, offset: 0 };
    engine.position = Number(localGet("teleo.position." + selected)) || 0;
    engine.speed = current?.preferences.speed || 1;
  }, [selected]);
  useLayoutEffect(() => {
    if (!reading) return;
    // WebKit/Firefox range geometry can lag a transform commit until the next frame.
    if (
      geometry.current &&
      geometry.current.mirrored !== !!current?.preferences.mirrorVertical
    ) {
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => restoreGeometryRef.current());
      });
      return () => cancelAnimationFrame(frame);
    }
    restoreGeometry();
  }, [
    reading,
    current?.scriptId,
    current?.body,
    current?.preferences.fontSize,
    current?.preferences.lineHeight,
    current?.preferences.textWidth,
    current?.preferences.alignment,
    current?.preferences.mirrorHorizontal,
    current?.preferences.mirrorVertical,
    focusPosition,
    letterSpacing,
  ]);
  useEffect(() => {
    if (!reading || !viewport.current) return;
    const observer = new ResizeObserver(() => restoreGeometryRef.current());
    observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [reading, selected]);
  useEffect(() => {
    if (!reading) return;
    let raf = 0,
      lastUI = 0,
      lastSave = 0;
    const tick = (now: number) => {
      const view = viewport.current;
      if (view) {
        if (geometry.current && geometry.current.layout !== viewLayout(view))
          restoreGeometryRef.current();
        engine.maximum = currentRef.current?.body.trim()
          ? Math.max(0, view.scrollHeight - view.clientHeight)
          : 0;
        engine.tick(now);
        if (engine.playing) {
          // Play switches back to steady scrolling.
          if (voice.running) stopVoice();
          syncView(view);
        } else if (voice.running) voiceStepRef.current(view, now);
        if (now - lastSave >= 250) {
          localSet("teleo.position." + selected, String(engine.position));
          lastSave = now;
        }
        if (now - lastUI >= 100) {
          if (!geometryHeld.current && currentRef.current) {
            const anchor = captureAnchor(view, focusPositionRef.current);
            if (anchor)
              geometry.current = {
                script: currentRef.current.scriptId,
                anchor,
                position: engine.position,
                mirrored: !!currentRef.current.preferences.mirrorVertical,
                scroll: view.scrollTop,
                layout: viewLayout(view),
              };
          }
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
    const playing = reading && (engine.playing || voiceOn);
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
  }, [reading, engine.playing, voiceOn]);
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
  readerKey.current = (e: KeyboardEvent) => {
    if (!["PageUp", "PageDown"].includes(e.code)) r400Hold.current.stop();
    if (((intro || settingsOpen) && !learn && !testing) || e.defaultPrevented) {
      r400Hold.current.stop();
      return;
    }
    const target = e.target instanceof Element ? e.target : document.body;
    const editable = !!target.closest(
      "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox],[role=searchbox],[role=slider],[role=spinbutton],[role=dialog],[role=combobox],[role=listbox],[role=menu]",
    );
    if (learn || testing) {
      const typing = !!target.closest(
        "input,textarea,select,[contenteditable]:not([contenteditable=false])",
      );
      if (!keyboardSafe(e, typing, reading || !!learn || testing)) return;
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
    const blocked =
      editable ||
      Array.from(
        document.querySelectorAll(
          "dialog[open],[role=menu],[role=listbox],[popover]:popover-open",
        ),
      ).some((el) => el.getClientRects().length > 0);
    const hostReader = reading && route === "/studio";
    const shortcut = readerShortcut(e, { reader: hostReader, blocked });
    if (shortcut) {
      e.preventDefault();
      r400Hold.current.stop();
      if (shortcut.action === "lineBack" || shortcut.action === "lineForward") {
        const view = viewport.current,
          article = content.current;
        if (view && article) {
          geometryHeld.current = false;
          geometry.current = null;
          voiceManual();
          const line = parseFloat(getComputedStyle(article).lineHeight) || 64;
          engine.position = Math.max(
            0,
            Math.min(
              engine.maximum,
              engine.position + (shortcut.action === "lineBack" ? -line : line),
            ),
          );
          syncView(view);
          rememberGeometry();
          showControls();
          setFrame((value) => value + 1);
        }
      } else if (shortcut.action) command({ action: shortcut.action });
      return;
    }
    if (enabled && profile === "r400" && hostReader) {
      // Never turn the R400's alternate Escape into app exit or playback.
      if (e.code === "Escape" || e.key === "Escape") return;
      const result = r400Shortcut(e, {
        enabled,
        reader: hostReader,
        blocked,
        playing: engine.playing,
      });
      if (result) {
        e.preventDefault();
        if (result.action === "enterFullscreen")
          fullscreenControl.current?.enter(readerRoot.current);
        else if (
          result.action === "scrollBack" ||
          result.action === "scrollForward"
        ) {
          const lines = r400Hold.current.step(e.code, e.repeat);
          const view = viewport.current,
            article = content.current;
          if (lines && view && article) {
            geometryHeld.current = false;
            geometry.current = null;
            voiceManual();
            const line = parseFloat(getComputedStyle(article).lineHeight) || 64;
            engine.position = Math.max(
              0,
              Math.min(
                engine.maximum,
                engine.position +
                  (result.action === "scrollBack" ? -1 : 1) * line * lines,
              ),
            );
            syncView(view);
            // Preserve the new semantic anchor for immediate typography/reflow changes.
            rememberGeometry();
            showControls();
            setFrame((x) => x + 1);
          }
        } else if (result.action) command({ action: result.action });
        if (engine.playing) r400Hold.current.stop();
      } else r400Hold.current.stop();
      return;
    }
    r400Hold.current.stop();
    if (!keyboardSafe(e, blocked, hostReader)) return;
    if (e.key === "Escape") {
      exitReader();
      return;
    }
    if (!enabled) return;
    const action = (profile === "standard" ? standardKeys : mapping)[e.code];
    if (!action) return;
    e.preventDefault();
    if (action === "mirror")
      pref({
        mirrorHorizontal: !currentRef.current?.preferences.mirrorHorizontal,
      });
    else if (action === "preset") {
      const values = presets
        .split(",")
        .map(Number)
        .filter((n) => n >= 0.5 && n <= 3);
      command({
        action: "setSpeed",
        value: values.find((n) => n > engine.speed) ?? values[0] ?? 1,
      });
    } else command({ action });
  };
  useEffect(
    () =>
      bindReaderKeyboard(
        window,
        (e) => readerKey.current(e),
        (code) => r400Hold.current.stop(code),
        document,
      ),
    [],
  );
  useEffect(() => {
    r400Hold.current.stop();
  }, [
    reading,
    selected,
    enabled,
    profile,
    engine.playing,
    pairOpen,
    settingsOpen,
  ]);
  useEffect(() => {
    remote.current.onEvent = (e) => {
      const statuses: Record<string, Key> = {
        connecting: "connecting",
        waiting: "waiting",
        connected: "connected",
        reconnecting: "reconnecting",
        disconnected: "disconnected",
        unavailable: "unavailable",
        serverUnreachable: "serverUnreachable",
        expired: "expired",
      };
      if (statuses[e.type]) setRemoteStatus(statuses[e.type]);
      if (
        [
          "disconnected",
          "unavailable",
          "serverUnreachable",
          "expired",
        ].includes(e.type)
      )
        setApproval(false);
      if (e.type === "connected") {
        lastHostState.current = "";
        pairGeneration.current++;
        setQRState("idle");
        clearTimeout(inviteTimer.current);
        setInviteDeadline(0);
        setPairOpen(false);
        setInvite("");
        setQR("");
        setApproval(false);
        if (route !== "/remote") {
          previewInitializing.current = true;
          setPreviewPending(true);
        }
      }
      if (
        [
          "connecting",
          "waiting",
          "reconnecting",
          "disconnected",
          "unavailable",
          "serverUnreachable",
          "expired",
        ].includes(e.type)
      ) {
        sender.current?.disconnect();
        previewInitializing.current = false;
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
          const initial = previewInitializing.current;
          previewInitializing.current = false;
          // Ignore an initial/stale grant that no longer matches the user's choice.
          if (permission.allowed !== previewChoice.current) {
            sender.current?.disconnect();
            // Reconcile the saved choice once, rather than republishing matching grants on every reconnect.
            if (initial)
              remote.current.previewPermission(previewChoice.current);
            return;
          }
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
      if (e.type === "quickSend" && e.transfer && route === "/studio") {
        const message = e.transfer;
        const link = remote.current;
        const socket = link.socket;
        const reply = (result: QuickSendAck["result"]) => {
          const receipt: QuickSendAck = {
            type: "quickSendAck",
            id: message.id,
            result,
          };
          if (result !== "failed")
            transferResults.current.set(message.id, receipt);
          if (link.socket === socket) link.send(receipt);
        };
        const old = transferResults.current.get(message.id);
        if (old) link.send(old);
        else if (!transferBusy.current.has(message.id)) {
          if (message.destination === "session") {
            if (incoming.current || !currentRef.current) reply("failed");
            else {
              incoming.current = {
                message,
                target: currentRef.current.scriptId,
              };
              setReceivedText(incoming.current);
              reply("delivered");
            }
          } else {
            transferBusy.current.add(message.id);
            const script = {
              ...createScript(
                message.body
                  .split(/\r?\n/)
                  .find((line) => line.trim())
                  ?.slice(0, 80) || t("untitled"),
                message.body,
              ),
              scriptId: message.id,
            };
            void storage
              .receiveScript(script)
              .then(
                (saved) => {
                  setScripts((list) =>
                    saved.deletedAt ||
                    list.some((item) => item.scriptId === saved.scriptId)
                      ? list
                      : [saved, ...list],
                  );
                  if (!saved.deletedAt) {
                    void flush();
                    setSelected(saved.scriptId);
                    setPanel("editor");
                    if (innerWidth <= 900) setLibraryOpen(false);
                    setRevisions(null);
                  }
                  reply("saved");
                },
                () => reply("failed"),
              )
              .finally(() => transferBusy.current.delete(message.id));
          }
        }
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
        publishHostState();
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
            const state = hostState();
            lastHostState.current = JSON.stringify(state);
            remote.current.send({ type: "ack", id: e.id, state });
            return;
          }
          const currentView = viewport.current;
          if (currentView)
            engine.maximum = currentRef.current?.body.trim()
              ? Math.max(0, currentView.scrollHeight - currentView.clientHeight)
              : 0;
          const acknowledge = () => {
            if (remote.current.socket !== socket) return;
            const state = hostState();
            lastHostState.current = JSON.stringify(state);
            remote.current.send({ type: "ack", id: e.id, state });
          };
          if (requested.action === "setPreference") {
            if (requested.key === "focusDimming") {
              dimmingRef.current = requested.value as boolean;
              setFocusDimming(requested.value as boolean);
            } else
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
                restoreGeometryRef.current();
              }
              acknowledge();
            });
          } else {
            if (requested.action === "seek") {
              geometryHeld.current = false;
              geometry.current = null;
              voiceManual();
              if (
                requested.anchor !== undefined &&
                viewport.current &&
                previewChoice.current
              ) {
                scrollToTextOffset(
                  viewport.current,
                  previewOffsets,
                  requested.anchor,
                  focusPosition,
                );
                engine.position = viewPosition(viewport.current);
              } else {
                engine.position = requested.value * engine.maximum;
                if (viewport.current) syncView(viewport.current);
              }
              setFrame((x) => x + 1);
            } else {
              command(requested);
              if (viewport.current) syncView(viewport.current);
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
      if (e.type === "ack" && e.state) setRemoteState(e.state);
    };
  });
  useEffect(() => {
    if (remoteStatus !== "connected" || route === "/remote") return;
    const snapshot = () => publishHostState();
    snapshot();
    const timer = setInterval(snapshot, 500);
    return () => clearInterval(timer);
  }, [
    reading,
    remoteStatus,
    previewAllowed,
    controlTarget,
    current?.preferences.alignment,
    focusPosition,
  ]);
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
          {
            playing: false,
            speed: engine.speed,
            position: engine.position,
          },
          Math.max(0, index),
          previewOffsets[Math.max(0, index)]?.offset || 0,
        );
        return;
      }
      const anchor = captureAnchor(view, focusPosition);
      const index = anchor?.paragraph || 0;
      const offset = Math.round(
        textOffsetAtView(view, previewOffsets, focusPosition),
      );
      lastPreviewPosition.current = {
        paragraph: index,
        offset,
      };
      sender.current?.position(
        {
          playing: engine.playing,
          speed: engine.speed,
          position: engine.position,
        },
        index,
        offset,
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
  useEffect(() => {
    if (libraryLoaded && selected) localSet("teleo.selectedScript", selected);
  }, [libraryLoaded, selected]);
  useEffect(() => {
    if (!reading || !selected) return;
    localSet("teleo.lastReadScript", selected);
    setLastReadScript(selected);
  }, [reading, selected]);
  useEffect(() => {
    if (!libraryLoaded || route !== "/studio") return;
    void storage
      .welcome(localeRef.current, {
        automatic: true,
        ...welcomeContext.current,
      })
      .then((result) => {
        setWelcomeSettings(result.settings);
        if (result.selected) {
          const created = result.selected;
          setScripts((previous) =>
            previous.some((script) => script.scriptId === created.scriptId)
              ? previous
              : [created, ...previous],
          );
          setSelected(created.scriptId);
          setPanel("editor");
        }
      })
      .catch(() => setStatus("saveError"));
  }, [libraryLoaded, route]);
  useEffect(() => {
    if (!libraryLoaded || route !== "/studio") return;
    welcomeLocaleQueue.current = welcomeLocaleQueue.current
      .then(async () => {
        if (localeRef.current !== locale) return;
        // The existing writer protects drafts and other tabs; never translate an unsaved edit.
        try {
          await writer.current!.requireSaved();
        } catch {
          return;
        }
        if (localeRef.current !== locale) return;
        const result = await storage.welcome(locale, {
          localize: scriptsRef.current,
        });
        setWelcomeSettings((previous) => ({
          ...result.settings,
          autoCreate: previous.autoCreate,
        }));
        const apply = (previous: Script[]) =>
          previous.map((script) => {
            const change = result.localized.find(
              (change) =>
                change.before.scriptId === script.scriptId &&
                JSON.stringify(change.before) === JSON.stringify(script),
            );
            return change?.after || script;
          });
        scriptsRef.current = apply(scriptsRef.current);
        setScripts(apply);
      })
      .catch(() => setStatus("saveError"));
  }, [locale, libraryLoaded, route]);
  function endRemote() {
    incoming.current = null;
    setReceivedText(null);
    setReviewText(false);
    transferResults.current.clear();
    setQRState("idle");
    clearTimeout(inviteTimer.current);
    setInviteDeadline(0);
    pairGeneration.current++;
    setPairOpen(false);
    remote.current.close();
    sender.current?.disconnect();
    previewInitializing.current = false;
    receiver.current.allowed = false;
    receiver.current.clear();
    setPreviewPending(false);
    refreshPreview((x) => x + 1);
  }
  function dismissTransient() {
    setSettingsOpen(false);
    setActionDialog(null);
    setRevisions(null);
    setImmersive(false);
    setLearn(null);
  }
  function navigate(path: string) {
    void flush();
    engine.suspend();
    setReading(false);
    endRemote();
    setRemoteStatus(null);
    history.pushState({}, "", path);
    dismissTransient();
    setRoute(path === "/" ? "/studio" : path);
  }
  async function add(s = createScript(t("untitled"))) {
    if (!libraryLoaded) return;
    const completed = flush();
    setScripts((list) => [s, ...list]);
    setSelected(s.scriptId);
    setPanel("editor");
    if (innerWidth <= 900) setLibraryOpen(false);
    persist(s);
    await completed;
  }
  function openLibraryScript(id: string) {
    if (!scripts.some((s) => s.scriptId === id)) return;
    void flush();
    setSelected(id);
    setPanel("editor");
    if (innerWidth <= 900) setLibraryOpen(false);
    setRevisions(null);
  }
  async function openLastScript() {
    try {
      await writer.current!.requireSaved();
      const available = await storage.list();
      const last =
        available.find((script) => script.scriptId === lastReadScript) ||
        available.find((script) => script.scriptId === selected) ||
        [...available].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        )[0];
      setScripts(available);
      if (!last) {
        setSelected("");
        setNotice("empty");
        return;
      }
      await startReader(last.scriptId);
    } catch {
      setNotice("saveError");
    }
  }
  async function restoreTrashScript(id: string) {
    const script = trash.find((s) => s.scriptId === id);
    if (!script || mutation.current) return false;
    mutation.current = "*";
    try {
      await writer.current!.requireSaved();
      const restored = { ...script, deletedAt: undefined };
      await storage.save(restored);
      setTrash((list) => list.filter((s) => s.scriptId !== id));
      setScripts((list) => [restored, ...list]);
      if (!selected) {
        setSelected(id);
        setPanel("editor");
      }
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error && error.message === "saveConflict"
          ? "saveConflict"
          : "saveError",
      );
      return false;
    } finally {
      mutation.current = null;
    }
  }
  function editMode() {
    setFullscreenIssue(null);
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
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }
  function exitReader() {
    setFullscreenIssue(null);
    setLibraryOpen(libraryBeforeReading.current);
    localSet("teleo.position." + selected, String(engine.position));
    setReading(false);
    setImmersive(false);
    engine.suspend();
    endRemote();
    setInvite("");
    setRemoteStatus(null);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }
  async function startReader(id = selected) {
    await flush();
    if (!id) return;
    setSelected(id);
    setPanel("editor");
    setRevisions(null);
    setFullscreenIssue(null);
    if (!reading) libraryBeforeReading.current = libraryOpen;
    setLibraryOpen(false);
    if (innerWidth <= 600 || (innerHeight <= 500 && innerWidth <= 1000))
      setImmersive(true);
    setReading(true);
  }
  async function showConnection() {
    setSettingsOpen(false);
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
    setQRState("loading");
    try {
      setRemoteStatus("connecting");
      const url = await remote.current.host();
      if (generation !== pairGeneration.current) return;
      setInvite(url);
      setInviteDeadline(Date.now() + 120000);
      clearTimeout(inviteTimer.current);
      inviteTimer.current = setTimeout(() => {
        if (generation !== pairGeneration.current) return;
        pairGeneration.current++;
        setQRState("idle");
        remote.current.close();
        setRemoteStatus("expired");
        setApproval(false);
        setInvite("");
        setQR("");
        setInviteDeadline(0);
      }, 120000);
      let image: string;
      try {
        image = await makeInvitationQR(url);
      } catch {
        if (generation === pairGeneration.current) setQRState("error");
        return;
      }
      if (generation !== pairGeneration.current) return;
      setQR(image);
      setQRState("ready");
    } catch {
      if (generation === pairGeneration.current) {
        setQRState("idle");
        setRemoteStatus("serverUnreachable");
      }
    }
  }
  async function importFile(file: File) {
    try {
      if (file.size > 10_000_000) throw Error();
      const imported = file.name.toLowerCase().endsWith(".json")
        ? parseBundle(await file.text())
        : [createScript(importTitle(file.name), await readTextFile(file))];
      for (const script of imported) {
        await add({ ...script, scriptId: crypto.randomUUID() });
      }
    } catch (error) {
      setNotice(error instanceof ImportFileError ? error.key : "invalidImport");
    }
  }
  const button = (
    key: Key,
    fn: () => void,
    primary = false,
    disabled = false,
    icon?: IconName,
  ) => (
    <button
      className={
        (primary ? "primary" : "") +
        (icon ? " document-action document-action-" + key : "")
      }
      aria-label={icon ? t(key) : undefined}
      title={icon ? t(key) : undefined}
      disabled={disabled}
      onClick={fn}
    >
      {icon ? (
        <>
          <Icon name={icon} />
          <span>{t(key)}</span>
        </>
      ) : (
        t(key)
      )}
    </button>
  );
  const lang = (
    <LanguageControl
      value={locale}
      onChange={setLocale}
      label={t("language")}
      closeLabel={t("close")}
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
          const allowed = e.target.checked;
          previewChoice.current = allowed;
          setPreviewAllowed(allowed);
          localSet("teleo.previewAllowed", String(allowed));
          if (!allowed) sender.current?.disconnect();
          if (remoteStatus === "connected") {
            setPreviewPending(true);
            remote.current.previewPermission(allowed);
          }
        }}
      />
      {t("allowPreview")}
    </label>
  );
  const settingsContent = (
    <aside className="settings">
      <h2>{t("settings")}</h2>
      <div className="settings-language">
        <span>{t("language")}</span>
        {lang}
      </div>
      <section className="appearance-content">
        <div className="appearance-row">
          <button
            type="button"
            className="picker-trigger"
            aria-label={t("readingAppearance")}
            title={t("readingAppearanceHelp")}
            disabled={!current}
            onClick={() =>
              pref({
                appearance:
                  current?.preferences.appearance === "light"
                    ? "dark"
                    : "light",
              })
            }
          >
            <span className="appearance-symbol">
              <Icon name="sun" />
            </span>
            <span>
              <strong>{t("readingAppearance")}</strong>
              <small>
                {t(
                  current?.preferences.appearance === "light"
                    ? "light"
                    : "dark",
                )}
              </small>
            </span>
          </button>
        </div>
        <div className="appearance-row">
          <button
            type="button"
            className="picker-trigger"
            aria-label={t("interfaceTheme")}
            title={t("interfaceThemeHelp")}
            onClick={() =>
              setTheme(
                theme === "system"
                  ? "light"
                  : theme === "light"
                    ? "dark"
                    : "system",
              )
            }
          >
            <span className="appearance-symbol">
              <Icon name="monitor" />
            </span>
            <span>
              <strong>{t("interfaceTheme")}</strong>
              <small>
                {t(
                  theme === "light"
                    ? "light"
                    : theme === "dark"
                      ? "dark"
                      : "system",
                )}
              </small>
            </span>
          </button>
        </div>
      </section>
      <details className="voice-settings">
        <summary>{t("voiceFollow")}</summary>
        <p>{t(voiceFollowSupported() ? "voiceHelp" : "voiceUnsupported")}</p>
        {voiceFollowSupported() && (
          <label>
            {t("voiceLanguage")}
            <TeleoSelect
              label={t("voiceLanguage")}
              value={voiceLanguage}
              onChange={(value) => {
                setVoiceLanguage(value);
                if (voice.running) stopVoice();
              }}
              options={[
                { value: "auto", label: t("voiceAuto") },
                { value: "uk-UA", label: "Українська" },
                { value: "ru-RU", label: "Русский" },
                { value: "en-US", label: "English (US)" },
                { value: "en-GB", label: "English (UK)" },
              ]}
            />
          </label>
        )}
        <p className="voice-privacy">{t("voicePrivacy")}</p>
      </details>
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
            options={(["standard", "twoButton", "custom", "r400"] as const).map(
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
        {profile === "r400" && <p>{t("r400Help")}</p>}
        {learn && <p role="status">{t("learning")}</p>}
        {button("test", () => {
          setTesting(true);
          setKeyEvent("");
        })}
        <output>{keyEvent || t(testing ? "learning" : "noKey")}</output>
        {Object.entries(
          profile === "r400"
            ? r400Keys
            : profile === "standard"
              ? {
                  ...standardKeys,
                  ArrowLeft: "scrollBack",
                  ArrowRight: "scrollForward",
                }
              : mapping,
        ).map(([key, a]) => (
          <p key={key}>
            <kbd>{key}</kbd> → {t(a as Key)}
          </p>
        ))}
        {profile === "r400" ? (
          <p>
            <kbd>Escape</kbd> → {t("r400Escape")}
          </p>
        ) : (
          button("reset", () => setMapping({}))
        )}
      </details>
      <section className="welcome-preference">
        <button
          disabled={!libraryLoaded}
          onClick={async () => {
            try {
              await writer.current!.requireSaved();
              const result = await storage.welcome(localeRef.current, {
                restore: true,
              });
              setScripts(result.scripts);
              setWelcomeSettings(result.settings);
              if (result.selected) {
                setSelected(result.selected.scriptId);
                setPanel("editor");
                document
                  .querySelectorAll<HTMLElement>(
                    ".top-settings [popover]:popover-open",
                  )
                  .forEach((el) => el.hidePopover());
                dismissTransient();
              }
            } catch {
              setStatus("saveError");
            }
          }}
        >
          {t("openDemo")}
        </button>
        <button
          disabled={!current}
          onClick={() => {
            document
              .querySelectorAll<HTMLElement>(
                ".top-settings [popover]:popover-open",
              )
              .forEach((el) => el.hidePopover());
            if (reading) editMode();
            setTour(true);
          }}
        >
          {t("tourReplay")}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={welcomeSettings.autoCreate}
            disabled={!libraryLoaded}
            onChange={(event) => {
              const previous = welcomeSettings;
              const enabled = event.target.checked;
              setWelcomeSettings({ ...previous, autoCreate: enabled });
              localSet("teleo.demo.auto", String(enabled));
              void storage.autoWelcome(enabled).catch(() => {
                setWelcomeSettings(previous);
                localSet("teleo.demo.auto", String(previous.autoCreate));
                setStatus("saveError");
              });
            }}
          />
          {t("autoDemo")}
        </label>
        <p>{t("autoDemoHelp")}</p>
      </section>
      <footer className="settings-about">
        <p className="settings-version">
          <span>{t("version")}</span>
          <span>{appVersion}</span>
        </p>
        <p className="settings-credit">Developed by MORPHINE</p>
      </footer>
    </aside>
  );

  useEffect(() => {
    const control = createReaderFullscreen(
      document,
      (active) => {
        setImmersive(active);
        setFullscreenIssue(null);
      },
      (operation) => {
        setFullscreenIssue(operation);
        if (operation === "enter" && !document.fullscreenElement)
          setImmersive(true);
      },
    );
    fullscreenControl.current = control;
    return () => {
      control.dispose();
      fullscreenControl.current = null;
    };
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      fullscreenControl.current?.exit();
      return;
    }
    if (immersive) {
      setImmersive(false);
      setFullscreenIssue(null);
      return;
    }
    setImmersive(true);
    fullscreenControl.current?.enter(readerRoot.current);
  };
  const settingsPopover = (
    <Popover
      kind="dialog"
      width={320}
      maxHeight={1000}
      className="top-settings"
      label={t("settings")}
      trigger={<Icon name="settings" />}
      triggerClassName="icon-button"
      onOpenChange={(open) => {
        setSettingsOpen(open);
        if (!open) {
          setLearn(null);
          setTesting(false);
        }
      }}
    >
      {settingsContent}
    </Popover>
  );
  const saveProblem = status === "saveError" || status === "saveConflict";
  const documentMeta = [
    t(
      status === "saving"
        ? "saving"
        : saveProblem
          ? "notSavedShort"
          : "savedShort",
    ),
    `${new Intl.NumberFormat(locale).format(wordCount)} ${t("words")}`,
    `${duration} ${t("minutesShort")}`,
  ].join(" · ");
  const documentActions: [Key, IconName, () => void][] = current
    ? [
        [
          "duplicate",
          "copy",
          () => void add(createScript(current.title, current.body)),
        ],
        [
          "export",
          "import",
          () => download((current.title || "teleo") + ".txt", current.body),
        ],
        [
          "exportJSON",
          "file",
          () =>
            download("teleo.json", exportBundle([current]), "application/json"),
        ],
        [
          "versions",
          "restart",
          () => {
            void flush()
              .then(() => storage.revisions(current.scriptId))
              .then(setRevisions)
              .catch(() => setStatus("saveError"));
          },
        ],
        [
          "delete",
          "trash",
          () => setActionDialog({ kind: "deleteScript", id: current.scriptId }),
        ],
      ]
    : [];
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
          <header className={route === "/studio" ? "topbar" : undefined}>
            {route === "/studio" ? (
              <>
                <div className="topbar-start">
                  <IconButton
                    className="topbar-library"
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
                  <Wordmark />
                </div>
                <div className="topbar-title">
                  <TeleoSelect
                    className="script-selector"
                    label={t("currentScript")}
                    align="center"
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
                    detail={
                      current && (
                        <span
                          className={
                            "topbar-meta" + (saveProblem ? " error" : "")
                          }
                        >
                          {documentMeta}
                        </span>
                      )
                    }
                  />
                </div>
                <div className="topbar-end">
                  <IconButton
                    className={
                      "tour-remote" +
                      (remoteStatus === "connected" ? " has-connection" : "")
                    }
                    name="remote"
                    label={t("remoteConnection")}
                    disabled={!current}
                    onClick={() => void showConnection()}
                  />
                  {settingsPopover}
                  <button
                    type="button"
                    className={"topbar-read" + (reading ? " reading" : "")}
                    disabled={!current}
                    onClick={() => (reading ? editMode() : void startReader())}
                  >
                    <Icon name={reading ? "pencil" : "play"} />
                    <span>{t(reading ? "editor" : "read")}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Wordmark />
                {settingsPopover}
              </>
            )}
          </header>
        )}
        {!online && (
          <p role="status" className="banner">
            {t("offline")}
          </p>
        )}
        {receivedText && route === "/studio" && (
          <div role="status" className="quick-send-received">
            <span>{t("quickSendReceived")}</span>
            <button onClick={() => setReviewText(true)}>
              {t("quickSendReview")}
            </button>
          </div>
        )}
        <Sheet
          open={reviewText && !!receivedText}
          title={t("quickSendReceived")}
          closeLabel={t("close")}
          onClose={() => setReviewText(false)}
          className="quick-send-review"
        >
          <div className="quick-send-content">
            <pre>{receivedText?.message.body}</pre>
            <p>{t("quickSendSessionHelp")}</p>
            <button
              disabled={receivedText?.target !== current?.scriptId}
              onClick={() => {
                if (
                  !receivedText ||
                  currentRef.current?.scriptId !== receivedText.target
                )
                  return;
                editMode();
                edit({ body: receivedText.message.body });
                incoming.current = null;
                setReceivedText(null);
                setReviewText(false);
              }}
            >
              {t("quickSendReplace")}
            </button>
            <button
              onClick={() => {
                incoming.current = null;
                setReceivedText(null);
                setReviewText(false);
              }}
            >
              {t("quickSendDiscard")}
            </button>
          </div>
        </Sheet>
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
            <p>{t(route === "/help" ? "helpVoice" : "privacyVoice")}</p>
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
            onQuickSend={(message) => remote.current.quickSend(message)}
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
            <LibraryPanel
              t={t}
              locale={locale}
              scripts={scripts}
              trash={trash}
              folders={folders}
              selected={selected}
              search={search}
              folder={folder}
              ready={libraryLoaded}
              onClose={() => setLibraryOpen(false)}
              onCreate={() => void add()}
              onSearch={setSearch}
              onFolder={setFolder}
              onOpen={openLibraryScript}
              onOpenLast={() => void openLastScript()}
              onAction={setActionDialog}
              onImport={(file) => void importFile(file)}
              onRestore={restoreTrashScript}
            />
            {current ? (
              <>
                <section className="editor">
                  <div className="editor-top">
                    <span
                      role="status"
                      className={
                        "save-status " + (saveProblem ? "error" : "sr-only")
                      }
                    >
                      {t(status)}
                    </span>
                    <span className="editor-meta" aria-hidden="true">
                      {documentMeta}
                    </span>
                    <div className="editor-top-end">
                      <EditorTools
                        area={bodyArea}
                        t={t}
                        locale={locale}
                        speed={current.preferences.speed || 1}
                        onFind={openFind}
                        documentItems={
                          <>
                            <div className="tools-heading" role="presentation">
                              {t("documentActions")}
                            </div>
                            {documentActions.map(([key, , run]) => (
                              <button
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                key={key}
                                className={
                                  "tools-item tools-item-row" +
                                  (key === "delete" ? " danger" : "")
                                }
                                onClick={() => setTimeout(run)}
                              >
                                <strong>{t(key)}</strong>
                              </button>
                            ))}
                            <div className="tools-heading" role="presentation">
                              {t("folder")}
                            </div>
                            <div
                              className="tools-chips"
                              role="group"
                              aria-label={t("scriptFolder")}
                            >
                              {[
                                { id: "", title: t("noFolder") },
                                ...folders.map((f) => ({
                                  id: f.folderId,
                                  title: f.title,
                                })),
                              ].map((f) => (
                                <button
                                  type="button"
                                  role="menuitem"
                                  tabIndex={-1}
                                  key={f.id || "none"}
                                  className={
                                    "tools-chip" +
                                    ((current.folderId || "") === f.id
                                      ? " selected"
                                      : "")
                                  }
                                  aria-current={
                                    (current.folderId || "") === f.id ||
                                    undefined
                                  }
                                  onClick={() =>
                                    edit({ folderId: f.id || undefined })
                                  }
                                >
                                  {f.title}
                                </button>
                              ))}
                            </div>
                          </>
                        }
                      />
                    </div>
                  </div>
                  <input
                    className="title-input"
                    aria-label={t("title")}
                    value={current.title}
                    onChange={(e) => edit({ title: e.target.value })}
                  />
                  {findOpen && (
                    <FindBar
                      key={current.scriptId}
                      area={bodyArea}
                      t={t}
                      onClose={() => setFindOpen(false)}
                    />
                  )}
                  <textarea
                    ref={bodyArea}
                    aria-label={t("body")}
                    placeholder={t("body")}
                    value={current.body}
                    onChange={(e) => edit({ body: e.target.value })}
                    onBlur={() => void flush()}
                    onKeyDown={(e) => {
                      if (
                        (e.metaKey || e.ctrlKey) &&
                        !e.altKey &&
                        e.key.toLowerCase() === "f"
                      ) {
                        e.preventDefault();
                        openFind();
                      }
                    }}
                  />
                  <div
                    className="document-actions"
                    role="toolbar"
                    aria-label={t("documentActions")}
                  >
                    {documentActions.map(([key, icon, run]) =>
                      button(key, run, false, false, icon),
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
              </>
            ) : (
              <section className="empty">
                <span className="empty-mark" aria-hidden="true">
                  teleo.
                </span>
                <span className="eyebrow">{t("tagline")}</span>
                <h2>{t("emptyTitle")}</h2>
                <p>{t("empty")}</p>
                {button("newScript", () => void add(), true, !libraryLoaded)}
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
            ref={readerRoot}
            className={
              "reader " +
              current.preferences.appearance +
              (controlsVisible ? "" : " quiet") +
              (engine.playing ? " is-playing" : "") +
              (voiceOn ? " is-listening" : "")
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
              {engine.playing && (
                <IconButton
                  name="pause"
                  label={t("pause")}
                  className="reader-pause"
                  onClick={() => command({ action: "pause" })}
                />
              )}
              {voiceOn && (
                <span className={"voice-status " + voiceStatus} role="status">
                  <span className="voice-dot" aria-hidden="true" />
                  {t(
                    voiceStatus === "listening"
                      ? "voiceListening"
                      : "voiceStarting",
                  )}
                </span>
              )}
              {voiceFollowSupported() && (
                <IconButton
                  name="microphone"
                  label={t(voiceOn ? "voiceFollowStop" : "voiceFollow")}
                  active={voiceOn}
                  className="reader-voice"
                  onClick={() => (voiceOn ? stopVoice() : startVoice())}
                />
              )}
              <IconButton
                name="fullscreen"
                label={t("fullscreen")}
                active={immersive}
                onClick={toggleFullscreen}
              />
              {immersive && (
                <Popover
                  kind="dialog"
                  width={320}
                  maxHeight={1000}
                  className="top-settings"
                  label={t("settings")}
                  trigger={<Icon name="settings" />}
                  triggerClassName="icon-button"
                  onOpenChange={(open) => {
                    setSettingsOpen(open);
                    if (!open) {
                      setLearn(null);
                      setTesting(false);
                    }
                  }}
                >
                  {settingsContent}
                </Popover>
              )}
            </div>
            {fullscreenIssue && (
              <p className="reader-fullscreen-feedback" role="status">
                {t(
                  fullscreenIssue === "enter"
                    ? "fullscreenUnavailable"
                    : "fullscreenExitUnavailable",
                )}
              </p>
            )}
            {voiceError && (
              <p className="reader-fullscreen-feedback" role="alert">
                {t(voiceError)}
              </p>
            )}
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
                onPointerDown={(e) => takeOverScroll(e.currentTarget)}
                onWheel={(e) => {
                  takeOverScroll(e.currentTarget);
                  voiceManual();
                }}
                onTouchStart={(e) => takeOverScroll(e.currentTarget)}
                onTouchMove={voiceManual}
                onClick={(e) => voiceTap(e.clientX, e.clientY)}
                onScroll={(e) => {
                  if (!engine.playing && !geometryHeld.current)
                    engine.position = viewPosition(e.currentTarget);
                }}
              >
                <article
                  ref={content}
                  style={{
                    fontSize: current.preferences.fontSize,
                    lineHeight: current.preferences.lineHeight,
                    letterSpacing,
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
            <ReaderDock
              hidden={voiceOn}
              letterSpacing={letterSpacing}
              setLetterSpacing={setLetterSpacing}
              moveLine={(direction) => {
                if (!viewport.current || !content.current) return;
                geometryHeld.current = false;
                geometry.current = null;
                voiceManual();
                const line =
                  parseFloat(getComputedStyle(content.current).lineHeight) ||
                  64;
                engine.position = Math.max(
                  0,
                  Math.min(engine.maximum, engine.position + direction * line),
                );
                syncView(viewport.current);
                rememberGeometry();
                showControls();
                setFrame((v) => v + 1);
              }}
              engine={engine}
              preferences={current.preferences}
              t={t}
              command={command}
              preference={pref}
              beforeLayout={rememberGeometry}
              dimming={focusDimming}
              setDimming={setFocusDimming}
              focusPosition={focusPosition}
              setFocusPosition={setFocusPosition}
              fullscreen={toggleFullscreen}
              seek={(position) => {
                geometryHeld.current = false;
                geometry.current = null;
                voiceManual();
                engine.command({ action: "pause" });
                engine.position = position;
                if (viewport.current) syncView(viewport.current);
                setFrame((x) => x + 1);
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
            <div className="pairing-composition">
              <div className="pair-panel">
                <Wordmark className="pairing-brand" />
                <h3>
                  {t(
                    remoteStatus === "connected" ||
                      remoteStatus === "reconnecting"
                      ? "remoteConnection"
                      : pairingIssue === "localPairingOnly"
                        ? "localPairingTitle"
                        : "pairTitle",
                  )}
                </h3>
                <p className="pair-helper">
                  {t(
                    remoteStatus === "connected" ||
                      remoteStatus === "reconnecting"
                      ? "previewSettingHelp"
                      : pairingIssue
                        ? pairingIssue === "localPairingOnly"
                          ? "pairLocal"
                          : pairingIssue
                        : "pairHelper",
                  )}
                </p>
                {invite &&
                  (remoteStatus === "waiting" ||
                    remoteStatus === "connecting") && (
                    <>
                      {qrState === "ready" && (
                        <div className="qr-surface">
                          <img
                            src={qr}
                            alt={t("invite")}
                            onError={() => setQRState("error")}
                          />
                        </div>
                      )}
                      {qrState === "loading" && (
                        <div className="qr-placeholder" aria-hidden="true">
                          <span className="pair-spinner" />
                        </div>
                      )}
                    </>
                  )}
                {previewConsent}
                <p className="pair-status" role="status">
                  {t(
                    approval
                      ? "pairApproval"
                      : qrState === "loading"
                        ? "qrLoading"
                        : remoteStatus === "waiting"
                          ? "pairWaiting"
                          : remoteStatus || "connecting",
                  )}
                </p>
                {inviteDeadline > 0 && (
                  <span className="sr-only">{t("inviteLifetime")}</span>
                )}
                {invite &&
                  (remoteStatus === "waiting" ||
                    remoteStatus === "connecting") && (
                    <div className="invite-row">
                      <a
                        href={invite}
                        aria-label={t("invite")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {new URL(invite).origin}/remote
                      </a>
                      <IconButton
                        name="copy"
                        label={t("copy")}
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(invite)
                            .then(() => setNotice("copied"))
                            .catch(() => setNotice("unavailable"));
                        }}
                      />
                    </div>
                  )}
                {qrState === "error" && (
                  <>
                    <p role="alert">{t("qrError")}</p>
                    {button("renewInvite", () => void connect())}
                  </>
                )}
                {approval && (
                  <div className="pair-approval-actions">
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
                  </div>
                )}
                {(remoteStatus === "disconnected" ||
                  remoteStatus === "unavailable" ||
                  remoteStatus === "serverUnreachable" ||
                  remoteStatus === "expired") &&
                  button("reconnect", () => void connect())}
                {(remoteStatus === "connected" ||
                  remoteStatus === "reconnecting") &&
                  button("revoke", () => {
                    endRemote();
                    setRemoteStatus("disconnected");
                    setInvite("");
                    setApproval(false);
                  })}
              </div>
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
                : actionDialog.kind === "purgeScript"
                  ? "confirmPurge"
                  : actionDialog.kind,
            )}
            label={
              actionDialog.kind === "newFolder" ||
              actionDialog.kind === "renameFolder" ||
              actionDialog.kind === "renameScript"
                ? t(
                    actionDialog.kind === "renameScript"
                      ? "title"
                      : "folderName",
                  )
                : undefined
            }
            initial={actionDialog.initial}
            confirm={t(
              actionDialog.kind === "purgeScript"
                ? "deleteForever"
                : actionDialog.kind.startsWith("delete")
                  ? "confirm"
                  : actionDialog.kind === "newFolder"
                    ? "create"
                    : "save",
            )}
            danger={
              actionDialog.kind.startsWith("delete") ||
              actionDialog.kind === "purgeScript"
            }
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
              } else if (kind === "renameScript" && id) {
                mutation.current = "*";
                try {
                  await writer.current!.requireSaved();
                  const script =
                    currentRef.current?.scriptId === id
                      ? currentRef.current
                      : scriptsRef.current.find((s) => s.scriptId === id);
                  if (!script) return;
                  if (script.title === value) return;
                  const renamed = {
                    ...script,
                    title: value,
                    updatedAt: new Date().toISOString(),
                  };
                  await storage.save(renamed, true);
                  if (currentRef.current?.scriptId === id)
                    currentRef.current = renamed;
                  setScripts((list) =>
                    list.map((s) => (s.scriptId === id ? renamed : s)),
                  );
                } finally {
                  mutation.current = null;
                }
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
                  setTrash(await storage.trash());
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
                  const deleted = {
                    ...(currentRef.current?.scriptId === id
                      ? currentRef.current
                      : script),
                    deletedAt: new Date().toISOString(),
                  };
                  await storage.save(deleted, true);
                  setTrash((list) => [
                    deleted,
                    ...list.filter((s) => s.scriptId !== id),
                  ]);
                  const remaining = scriptsRef.current.filter(
                    (s) => s.scriptId !== id,
                  );
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
              } else if (kind === "purgeScript" && id) {
                await storage.purge(id);
                setTrash((list) => list.filter((s) => s.scriptId !== id));
              }
            }}
          />
        )}
        {tour && current && route === "/studio" && (
          <Tour
            t={t}
            reading={reading}
            onReader={(open) => {
              if (open) {
                tourOpenedReader.current = true;
                void startReader();
              } else editMode();
            }}
            onClose={() => {
              setTour(false);
              if (tourOpenedReader.current) {
                tourOpenedReader.current = false;
                editMode();
              }
            }}
          />
        )}
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
reactRoot.render(
  window.isSecureContext ? (
    <App />
  ) : (
    <main className="prose">
      <h1>teleo.</h1>
      <p>
        {
          dictionaries[
            detectLocale(
              [...(navigator.languages || []), navigator.language],
              localGet("teleo.locale"),
            )
          ].securePairingRequired
        }
      </p>
    </main>
  ),
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
