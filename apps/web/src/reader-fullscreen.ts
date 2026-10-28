type FullscreenDocument = Pick<
  Document,
  | "fullscreenElement"
  | "fullscreenEnabled"
  | "exitFullscreen"
  | "addEventListener"
  | "removeEventListener"
>;
export type FullscreenFailure = "enter" | "exit";
/** DOM fullscreen is authoritative. Pending tickets only suppress duplicate/stale requests. */
export function createReaderFullscreen(
  doc: FullscreenDocument,
  onChange: (active: boolean) => void,
  onFailure: (operation: FullscreenFailure) => void,
) {
  let disposed = false,
    ticket = 0,
    pending: FullscreenFailure | null = null;
  const sync = () => {
    if (!disposed) onChange(!!doc.fullscreenElement);
  };
  const fail = (id: number, operation: FullscreenFailure) => {
    if (disposed || id !== ticket) return;
    ticket++;
    pending = null;
    sync();
    onFailure(operation);
  };
  const run = (operation: FullscreenFailure, request: () => Promise<void>) => {
    const id = ++ticket;
    pending = operation;
    try {
      // Deliberately synchronous: preserve the trusted keydown's transient user activation.
      const result = request();
      Promise.resolve(result).then(
        () => {
          if (!disposed && id === ticket) {
            pending = null;
            sync();
          }
        },
        () => fail(id, operation),
      );
    } catch {
      fail(id, operation);
    }
  };
  const error = () => {
    if (pending) fail(ticket, pending);
  };
  doc.addEventListener("fullscreenchange", sync);
  doc.addEventListener("fullscreenerror", error);
  return {
    enter(root: Pick<HTMLElement, "requestFullscreen"> | null) {
      if (disposed || pending || doc.fullscreenElement) return;
      run("enter", () => {
        if (
          !doc.fullscreenEnabled ||
          !root ||
          typeof root.requestFullscreen !== "function"
        )
          throw Error("Fullscreen unavailable");
        return root.requestFullscreen();
      });
    },
    exit() {
      if (!disposed && doc.fullscreenElement)
        run("exit", () => doc.exitFullscreen());
    },
    dispose() {
      disposed = true;
      ticket++;
      pending = null;
      doc.removeEventListener("fullscreenchange", sync);
      doc.removeEventListener("fullscreenerror", error);
    },
  };
}
