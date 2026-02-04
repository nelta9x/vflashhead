/**
 * Web Audio API 기반 프로그래매틱 사운드 시스템
 * 외부 오디오 파일 없이 코드로 사운드 생성
 */
export class SoundSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  constructor() {
    // AudioContext는 사용자 인터랙션 후 초기화해야 함
    this.initOnUserInteraction();
  }

  private initOnUserInteraction(): void {
    const initAudio = () => {
      if (!this.initialized) {
        this.audioContext = new AudioContext();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3; // 마스터 볼륨
        this.masterGain.connect(this.audioContext.destination);
        this.initialized = true;
      }
      // 리스너 제거
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('pointermove', initAudio);
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('pointermove', initAudio);
  }

  private ensureContext(): boolean {
    if (!this.audioContext || !this.masterGain) {
      return false;
    }
    // Resume suspended context
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return true;
  }

  /**
   * 접시 타입별 파괴음 재생
   */
  playDestroySound(dishType: string): void {
    if (!this.ensureContext()) return;

    switch (dishType) {
      case 'basic':
        this.playBasicDestroySound();
        break;
      case 'golden':
        this.playGoldenDestroySound();
        break;
      case 'crystal':
        this.playCrystalDestroySound();
        break;
      case 'bomb':
        this.playBombDestroySound();
        break;
      default:
        this.playBasicDestroySound();
    }
  }

  /**
   * Basic 접시: 짧은 "퐁" 사운드
   * 부드러운 사인파 + 빠른 감쇠
   */
  private playBasicDestroySound(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 메인 톤
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Golden 접시: 밝은 "띵" 사운드
   * 높은 피치 + 하모닉스 + 약간의 지속
   */
  private playGoldenDestroySound(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 기본 음
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.3);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(this.masterGain!);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // 하모닉 (옥타브 위)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);
    osc2.start(now);
    osc2.stop(now + 0.25);

    // 반짝이는 효과 (높은 주파수 쇼트)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(2200, now);
    gain3.gain.setValueAtTime(0.1, now);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc3.connect(gain3);
    gain3.connect(this.masterGain!);
    osc3.start(now);
    osc3.stop(now + 0.08);
  }

  /**
   * Crystal 접시: 유리 깨지는 "찰랑" 사운드
   * 고주파 노이즈 + 여러 개의 빠른 하이피치 톤
   */
  private playCrystalDestroySound(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 여러 고주파 톤을 빠르게 재생 (유리 파편 효과)
    const frequencies = [1200, 1500, 1800, 2100, 1000];
    const delays = [0, 0.02, 0.04, 0.06, 0.03];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delays[i]);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + delays[i] + 0.15);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.12, now + delays[i]);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delays[i] + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + delays[i] + 0.2);
    });

    // 화이트 노이즈 버스트 (깨지는 효과)
    this.playNoiseShort(0.08, 0.1);
  }

  /**
   * Bomb 접시: 둔탁한 "쿵" 사운드
   * 저주파 + 노이즈
   */
  private playBombDestroySound(): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 저주파 베이스
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.3);

    // 임팩트 노이즈
    this.playNoiseShort(0.15, 0.2);

    // 서브 베이스
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(60, now);
    osc2.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    gain2.gain.setValueAtTime(0.4, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);
    osc2.start(now);
    osc2.stop(now + 0.4);
  }

  /**
   * 짧은 노이즈 버스트 생성
   */
  private playNoiseShort(volume: number, duration: number): void {
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 버퍼 크기 (샘플 수)
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 화이트 노이즈 생성
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // 페이드 아웃
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 필터 (고주파 컷)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    source.start(now);
  }

  /**
   * 히트 사운드 (접시에 데미지)
   * 짧고 경쾌한 "틱" 사운드
   */
  playHitSound(): void {
    if (!this.ensureContext()) return;

    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 짧은 고주파 틱
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    // 로우패스 필터로 부드럽게
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 놓침 사운드 재생
   */
  playMissSound(): void {
    if (!this.ensureContext()) return;

    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 하강하는 톤 (실패 느낌)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * 안전 사운드 (Bomb 회피)
   */
  playSafeSound(): void {
    if (!this.ensureContext()) return;

    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 상승하는 톤 (안심 느낌)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * 콤보 사운드 (콤보 마일스톤)
   * 콤보가 높을수록 피치 상승
   */
  playComboSound(combo: number): void {
    if (!this.ensureContext()) return;

    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 콤보에 따른 피치 조절
    const basePitch = 400;
    const pitchMultiplier = Math.min(1 + combo / 50, 3); // 최대 3배
    const pitch = basePitch * pitchMultiplier;

    // 아르페지오 효과 (3음)
    const notes = [pitch, pitch * 1.25, pitch * 1.5];
    const noteDuration = 0.08;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * noteDuration);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.15, now + i * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * noteDuration + noteDuration * 2);

      // 로우패스 필터로 부드럽게
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + (i + 2) * noteDuration);
    });
  }

  /**
   * 마스터 볼륨 설정
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 음소거
   */
  mute(): void {
    this.setVolume(0);
  }

  /**
   * 음소거 해제
   */
  unmute(volume: number = 0.3): void {
    this.setVolume(volume);
  }

  /**
   * 힐 사운드 재생 (상승 아르페지오)
   * 밝고 희망적인 느낌의 회복 사운드
   */
  playHealSound(): void {
    if (!this.ensureContext()) return;

    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 상승 아르페지오 (C-E-G-C)
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.08;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * noteDuration);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.2, now + i * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * noteDuration + noteDuration * 3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + (i + 3) * noteDuration);
    });

    // 부드러운 하모닉 추가
    const harmonicOsc = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.setValueAtTime(1046.5, now);
    harmonicOsc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.3);
    harmonicGain.gain.setValueAtTime(0.1, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(this.masterGain!);
    harmonicOsc.start(now);
    harmonicOsc.stop(now + 0.4);
  }
}
