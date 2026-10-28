type Sample = {
  offset: number;
  timestamp: number;
  state: { playing: boolean; position: number };
};
/** Local frame interpolation. Host packets remain authoritative; prediction is bounded to one packet interval. */
export class RemoteTextFollow {
  private current: number | null = null;
  private sample: Sample | null = null;
  private received = 0;
  private frame = 0;
  private velocity = 0;
  reset(offset: number | null = null) {
    this.current = offset;
    this.sample = null;
    this.velocity = 0;
    this.frame = 0;
  }
  receive(sample: Sample, now: number, predict = true) {
    const previous = this.sample;
    if (previous && sample.timestamp < previous.timestamp) return;
    if (this.current === null) this.current = sample.offset;
    this.velocity = 0;
    if (
      predict &&
      previous?.state.playing &&
      sample.state.playing &&
      sample.state.position > previous.state.position &&
      sample.offset >= previous.offset
    ) {
      const elapsed = sample.timestamp - previous.timestamp;
      if (elapsed > 0 && elapsed <= 1000)
        this.velocity = (sample.offset - previous.offset) / elapsed;
    }
    this.sample = sample;
    this.received = now;
    this.frame = now;
  }
  step(now: number) {
    if (!this.sample || this.current === null) return null;
    const target =
      this.sample.offset +
      this.velocity * Math.min(250, Math.max(0, now - this.received));
    const elapsed = Math.max(0, Math.min(64, now - this.frame));
    this.frame = now;
    this.current += (target - this.current) * (1 - Math.exp(-elapsed / 45));
    if (Math.abs(target - this.current) < 0.05) this.current = target;
    return {
      offset: this.current,
      active:
        (this.velocity > 0 && now - this.received < 500) ||
        this.current !== target,
    };
  }
}
