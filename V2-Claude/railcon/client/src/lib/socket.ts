/** WebSocket with automatic exponential-backoff reconnect and JSON framing. */
export class ReconnectingSocket<In, Out = unknown> {
  private ws: WebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hb: ReturnType<typeof setInterval> | null = null;

  constructor(
    private urlFactory: () => string,
    private handlers: {
      onOpen?: () => void;
      onClose?: (code: number) => void;
      onMessage: (msg: In) => void;
      onStatus?: (connected: boolean) => void;
    },
    private heartbeatMs = 0
  ) {}

  connect() {
    this.closed = false;
    this.open();
  }

  private open() {
    if (this.closed) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.urlFactory());
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.handlers.onStatus?.(true);
      this.handlers.onOpen?.();
      if (this.heartbeatMs) {
        this.hb = setInterval(() => this.send({ t: "ping" } as unknown as Out), this.heartbeatMs);
      }
    };
    ws.onmessage = (ev) => {
      try {
        this.handlers.onMessage(JSON.parse(ev.data as string) as In);
      } catch (e) {
        console.error("bad frame", e);
      }
    };
    ws.onclose = (ev) => {
      if (this.hb) clearInterval(this.hb);
      this.hb = null;
      this.handlers.onStatus?.(false);
      this.handlers.onClose?.(ev.code);
      if (ev.code === 4001) return; // unauthorized: caller must re-login
      this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleRetry() {
    if (this.closed) return;
    const delay = Math.min(15000, 500 * 2 ** this.attempt++);
    this.timer = setTimeout(() => this.open(), delay);
  }

  send(msg: Out): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.hb) clearInterval(this.hb);
    this.ws?.close();
  }
}
