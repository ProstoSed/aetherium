/**
 * Фон обсерватории: низкий гул и треск проектора. Всё синтезируется на месте —
 * файлов нет. Громкость напряжения подстраивается под силу текущего события.
 */
const MASTER_VOLUME = 0.05;
const DRONE_FREQUENCIES_HZ = [55, 82.41, 110.0, 164.81];

export class Ambience {
  private context: AudioContext | null = null;
  private tension: GainNode | null = null;
  private crackle: GainNode | null = null;

  get enabled(): boolean {
    return this.context?.state === 'running';
  }

  async enable() {
    if (!this.context) this.build();
    await this.context!.resume();
  }

  async disable() {
    await this.context?.suspend();
  }

  /** 0 — покой, 1 — разгар события: гул поднимается, треск плёнки учащается. */
  setTension(level: number) {
    if (!this.context || !this.tension || !this.crackle) return;
    const now = this.context.currentTime;
    this.tension.gain.setTargetAtTime(0.15 + level * 0.85, now, 0.4);
    this.crackle.gain.setTargetAtTime(0.25 + level * 0.9, now, 0.2);
  }

  private build() {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(context.destination);

    DRONE_FREQUENCIES_HZ.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (i - 1.5) * 4;
      const gain = context.createGain();
      gain.gain.value = 0.4 / (i + 1);
      oscillator.connect(gain).connect(master);
      oscillator.start();
    });

    // Напряжение — диссонирующий тритон, который слышен только в событиях.
    const tension = context.createGain();
    tension.gain.value = 0.15;
    const tritone = context.createOscillator();
    tritone.type = 'triangle';
    tritone.frequency.value = 77.78;
    const tensionFilter = context.createBiquadFilter();
    tensionFilter.type = 'lowpass';
    tensionFilter.frequency.value = 400;
    tritone.connect(tensionFilter).connect(tension).connect(master);
    tritone.start();

    // Треск проектора — отфильтрованный шум редкими импульсами.
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() < 0.0015 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.02;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2400;
    const crackle = context.createGain();
    crackle.gain.value = 0.25;
    noise.connect(noiseFilter).connect(crackle).connect(master);
    noise.start();

    this.context = context;
    this.tension = tension;
    this.crackle = crackle;
  }

  dispose() {
    void this.context?.close();
  }
}
