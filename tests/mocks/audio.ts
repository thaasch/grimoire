export class MockParam {
  value = 1;
  events: Array<{ type: 'set' | 'ramp' | 'cancel'; value?: number; time?: number }> = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'ramp', value, time });
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
  }
}

export class MockNode {
  connections: unknown[] = [];

  connect(target: unknown) {
    this.connections.push(target);
  }

  disconnect() {}
}

export class MockGain extends MockNode {
  gain = new MockParam();
}

export class MockSource extends MockNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped: number[] = [];

  start(when = 0) {
    this.started.push(when);
  }

  // Deliberately does NOT fire onended — tests trigger it manually to
  // simulate the scheduled stop time actually arriving.
  stop(when = 0) {
    this.stopped.push(when);
  }
}

export class MockAudioContext {
  currentTime = 0;
  state: 'suspended' | 'running' = 'suspended';
  destination = new MockNode();
  gains: MockGain[] = [];
  sources: MockSource[] = [];
  decodeReceived: ArrayBuffer[] = [];

  async resume() {
    this.state = 'running';
  }

  createGain() {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = new MockSource();
    this.sources.push(source);
    return source;
  }

  async decodeAudioData(data: ArrayBuffer) {
    this.decodeReceived.push(data);
    return { duration: 42, length: data.byteLength } as unknown as AudioBuffer;
  }
}
