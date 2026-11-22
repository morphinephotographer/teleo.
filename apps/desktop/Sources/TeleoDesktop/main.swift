// teleo. for Mac — a thin native shell around https://teleo.cc.
// The web app is shown exactly as it is; this file only adds what a Mac app
// needs: a window, menus, file open/save panels, microphone permission,
// keeping the screen awake while reading, and fast, flash-free launches.

import AppKit
import IOKit.pwr_mgt
import WebKit

let homeHost = "teleo.cc"
let startURL = URL(string: "https://teleo.cc/studio")!

// MARK: - Page bridge

/// Runs before the page's own scripts.
/// - Marks the page as an installed app (same layout as the installed web app).
/// - Routes `navigator.wakeLock` to a native power assertion, because WKWebView
///   does not keep the display awake by itself.
let bridgeScript = """
(() => {
  try { Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true }); } catch (e) {}
  const post = (on) => { try { webkit.messageHandlers.teleoWake.postMessage(on); } catch (e) {} };
  let active = new Set();
  class TeleoWakeLock extends EventTarget {
    constructor() { super(); this.type = 'screen'; this.released = false; this.onrelease = null; }
    async release() {
      if (this.released) return;
      this.released = true;
      active.delete(this);
      if (active.size === 0) post(false);
      const ev = new Event('release');
      if (typeof this.onrelease === 'function') this.onrelease(ev);
      this.dispatchEvent(ev);
    }
  }
  const wakeLock = { request: async () => { const l = new TeleoWakeLock(); active.add(l); post(true); return l; } };
  try { Object.defineProperty(navigator, 'wakeLock', { get: () => wakeLock, configurable: true }); } catch (e) {}
  addEventListener('pagehide', () => { active.clear(); post(false); });
})();
"""

// MARK: - Keep display awake while reading

@MainActor
final class Awake {
    private var assertion: IOPMAssertionID = 0
    private var activity: NSObjectProtocol?

    func set(_ on: Bool) {
        if on {
            guard assertion == 0 else { return }
            IOPMAssertionCreateWithName(
                kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                IOPMAssertionLevel(kIOPMAssertionLevelOn),
                "teleo. is reading a script" as CFString,
                &assertion)
            // Stops App Nap and timer throttling so scrolling stays smooth,
            // even when the reader is on a second display behind other windows.
            activity = ProcessInfo.processInfo.beginActivity(
                options: [.userInitiated, .idleDisplaySleepDisabled, .latencyCritical],
                reason: "Reading a script")
        } else {
            if assertion != 0 { IOPMAssertionRelease(assertion); assertion = 0 }
            if let a = activity { ProcessInfo.processInfo.endActivity(a); activity = nil }
        }
    }
}

// MARK: - Window controller

@MainActor
final class BrowserController: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate,
    WKDownloadDelegate, WKScriptMessageHandler
{
    let window: NSWindow
    let webView: WKWebView
    private let awake = Awake()
    private var themeObservation: NSKeyValueObservation?
    private var revealed = false
    private var offlineView: NSView?

    static let lightBackground = NSColor(srgbRed: 0xF5 / 255, green: 0xF5 / 255, blue: 0xF7 / 255, alpha: 1)

    override init() {
        let config = WKWebViewConfiguration()
        // Persistent store: the library (IndexedDB), settings and the offline
        // cache survive restarts, and later launches open from cache.
        config.websiteDataStore = .default()
        config.limitsNavigationsToAppBoundDomains = true  // enables the service worker
        config.suppressesIncrementalRendering = false
        config.mediaTypesRequiringUserActionForPlayback = []
        config.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15 teleo.mac"
        let prefs = config.preferences
        prefs.isElementFullscreenEnabled = true
        prefs.javaScriptCanOpenWindowsAutomatically = false
        prefs.isFraudulentWebsiteWarningEnabled = false  // one less network lookup per load
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let controller = WKUserContentController()
        controller.addUserScript(
            WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = controller

        webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsMagnification = false
        webView.allowsBackForwardNavigationGestures = false
        webView.setValue(false, forKey: "drawsBackground")  // no white flash
        webView.underPageBackgroundColor = Self.lightBackground

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "teleo."
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.backgroundColor = Self.lightBackground
        window.minSize = NSSize(width: 360, height: 480)
        window.collectionBehavior = [.fullScreenPrimary, .managed]
        window.tabbingMode = .disallowed
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("teleo.main")

        super.init()

        controller.add(WeakHandler(self), name: "teleoWake")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.delegate = self

        // The page sets <meta name="theme-color"> to its own background; the
        // title bar follows it so the window looks like one surface.
        themeObservation = webView.observe(\.themeColor, options: [.new]) { [weak self] view, _ in
            MainActor.assumeIsolated {
                guard let self, let color = view.themeColor else { return }
                self.window.backgroundColor = color
                self.webView.underPageBackgroundColor = color
                let dark = (color.usingColorSpace(.sRGB)?.brightnessComponent ?? 1) < 0.5
                self.window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
            }
        }

        webView.load(URLRequest(url: startURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
        // Show the window as soon as the first frame is ready (or after a short
        // safety delay), so there is never a blank white window.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.reveal() }
    }

    func reveal() {
        guard !revealed else { return }
        revealed = true
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: Navigation

    private func isHome(_ url: URL?) -> Bool {
        guard let url else { return false }
        if url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { return true }
        guard let host = url.host?.lowercased() else { return false }
        return host == homeHost || host.hasSuffix("." + homeHost)
    }

    func webView(
        _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if let url = action.request.url, action.targetFrame?.isMainFrame != false, !isHome(url) {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void
    ) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        hideOffline()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        reveal()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled || code == 102 /* frame load interrupted (download) */ { return }
        showOffline()
        reveal()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()  // recover silently if WebKit's page process is killed
    }

    // target="_blank" links: external ones open in the default browser.
    func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = action.request.url {
            if isHome(url) { webView.load(action.request) } else { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    // MARK: Files

    func webView(
        _ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func download(
        _ download: WKDownload, decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping @MainActor @Sendable (URL?) -> Void
    ) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let url = panel.url else { completionHandler(nil); return }
            try? FileManager.default.removeItem(at: url)  // the user already confirmed replacing it
            completionHandler(url)
        }
    }

    // MARK: Permissions and dialogs

    func webView(
        _ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
        decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        // Voice follow: allow the microphone for teleo. itself; macOS still asks the user once.
        let host = origin.host.lowercased()
        decisionHandler(host == homeHost || host.hasSuffix("." + homeHost) ? .grant : .deny)
    }

    func webView(
        _ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(
        _ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    // MARK: Wake lock bridge

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "teleoWake" else { return }
        awake.set((message.body as? Bool) ?? false)
    }

    // MARK: Offline screen (first launch without internet only)

    private func showOffline() {
        guard offlineView == nil else { return }
        let ru = Locale.preferredLanguages.first?.hasPrefix("ru") == true
        let uk = Locale.preferredLanguages.first?.hasPrefix("uk") == true
        let title = ru ? "Нет подключения к интернету" : uk ? "Немає підключення до інтернету" : "No internet connection"
        let hint = ru ? "teleo. нужно один раз открыть онлайн — потом работает и без сети."
            : uk ? "teleo. потрібно один раз відкрити онлайн — потім працює й без мережі."
            : "Open teleo. online once — after that it also works offline."
        let retry = ru ? "Повторить" : uk ? "Повторити" : "Try again"

        let container = NSView()
        container.wantsLayer = true
        container.layer?.backgroundColor = Self.lightBackground.cgColor
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        let hintLabel = NSTextField(wrappingLabelWithString: hint)
        hintLabel.alignment = .center
        hintLabel.textColor = .secondaryLabelColor
        hintLabel.preferredMaxLayoutWidth = 320
        let button = NSButton(title: retry, target: self, action: #selector(retryLoad))
        button.bezelStyle = .rounded
        button.keyEquivalent = "\r"
        let stack = NSStackView(views: [titleLabel, hintLabel, button])
        stack.orientation = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        container.frame = webView.bounds
        container.autoresizingMask = [.width, .height]
        webView.addSubview(container)
        offlineView = container
    }

    private func hideOffline() {
        offlineView?.removeFromSuperview()
        offlineView = nil
    }

    @objc func retryLoad() {
        webView.load(URLRequest(url: startURL))
    }

    // MARK: Window

    func windowWillClose(_ notification: Notification) {
        awake.set(false)
    }
}

/// Avoids a retain cycle between WKUserContentController and the controller.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: (any WKScriptMessageHandler)?
    init(_ target: any WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}

// MARK: - App

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    var browser: BrowserController!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = makeMenu()
        browser = BrowserController()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        browser.window.makeKeyAndOrderFront(nil)
        return true
    }

    @objc func reload() { browser.webView.reload() }
    @objc func goHome() { browser.webView.load(URLRequest(url: startURL)) }
    @objc func openSite() { NSWorkspace.shared.open(URL(string: "https://teleo.cc/help")!) }

    private func makeMenu() -> NSMenu {
        let main = NSMenu()

        let app = NSMenu()
        app.addItem(withTitle: "About teleo.", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide teleo.", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let others = app.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        others.keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit teleo.", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        main.addItem(withTitle: "teleo.", action: nil, keyEquivalent: "").submenu = app

        // Standard edit commands go to the page (typing, copy/paste, undo in the editor).
        // ⌘F is left to the page's own Find and replace.
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        main.addItem(withTitle: "Edit", action: nil, keyEquivalent: "").submenu = edit

        let view = NSMenu(title: "View")
        view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r").target = self
        view.addItem(withTitle: "Studio", action: #selector(goHome), keyEquivalent: "0").target = self
        view.addItem(.separator())
        let full = view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        full.keyEquivalentModifierMask = [.command, .control]
        main.addItem(withTitle: "View", action: nil, keyEquivalent: "").submenu = view

        let window = NSMenu(title: "Window")
        window.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        window.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        window.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        main.addItem(withTitle: "Window", action: nil, keyEquivalent: "").submenu = window
        NSApp.windowsMenu = window

        let help = NSMenu(title: "Help")
        help.addItem(withTitle: "teleo. Help", action: #selector(openSite), keyEquivalent: "?").target = self
        main.addItem(withTitle: "Help", action: nil, keyEquivalent: "").submenu = help
        NSApp.helpMenu = help

        return main
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
