import Phaser from 'phaser';
import { Data } from '../data/DataManager';

/**
 * Web Audio API 기반 프로그래매틱 사운드 시스템
 * 외부 오디오 파일 없이 코드로 사운드 생성, BGM 재생 지원
 */
export class SoundSystem {
  private static instance: SoundSystem | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private scene: Phaser.Scene | null = null;
  private bgm: Phaser.Sound.BaseSound | null = null;

  constructor() {
    // AudioContext는 사용자 인터랙션 후 초기화해야 함
    this.initOnUserInteraction();
  }

  public static getInstance(): SoundSystem {
    if (!SoundSystem.instance) {
      SoundSystem.instance = new SoundSystem();
    }
    return SoundSystem.instance;
  }

  public async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioContext && AudioContextClass) {
      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3; // 마스터 볼륨
      this.masterGain.connect(this.audioContext.destination);
    }

    // 이미 생성되었더라도 suspended 상태라면 resume 시도하고 완료될 때까지 대기
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('AudioContext resumed successfully');
      } catch (e) {
        console.error('Failed to resume AudioContext:', e);
      }
    }
  }

  private initOnUserInteraction(): void {
    const initAudio = async () => {
      await this.init();
      // 리스너 제거 (한 번만 실행)
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('mousedown', initAudio);
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('mousedown', initAudio);
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

  /**
   * 보스 공격 기 모으기 사운드
   * 신비롭고 강렬한 에너지가 응집되는 사운드
   */
  playBossChargeSound(): void {
    if (!this.ensureContext()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;
    const duration = 0.6;

    // 1. 신비로운 사인파 하모닉스 (여러 층의 상승음)
    const freqs = [200, 400, 600];
    freqs.forEach((baseFreq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';

      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + duration);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + duration * 0.5);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + duration);
    });

    // 2. 에너지 소용돌이 소리 (Rising Bandpass Noise)
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.Q.value = 5;
    bpf.frequency.setValueAtTime(400, now);
    bpf.frequency.exponentialRampToValueAtTime(3000, now + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.2, now + duration * 0.8);
    noiseGain.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(bpf);
    bpf.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);
  }

  /**
   * 보스 공격 발사 사운드
   * 묵직한 타격감과 에너지가 실린 레이저 발사음
   */
  playBossFireSound(): void {
    if (!this.ensureContext()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 1. 초기 어택 "퍽" 소리 (Low Thump)
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(150, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
    thumpGain.gain.setValueAtTime(0.6, now);
    thumpGain.gain.linearRampToValueAtTime(0, now + 0.08);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain!);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.08);

    // 2. 메인 에너지 레이저 (Resonant Filter Sweep)
    const laserOsc = ctx.createOscillator();
    const laserGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    laserOsc.type = 'sawtooth';
    laserOsc.frequency.setValueAtTime(400, now);
    laserOsc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    filter.Q.value = 10; // 레조넌스로 "쀼웅" 하는 느낌 강조

    laserGain.gain.setValueAtTime(0.4, now);
    laserGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    laserOsc.connect(filter);
    filter.connect(laserGain);
    laserGain.connect(this.masterGain!);
    laserOsc.start(now);
    laserOsc.stop(now + 0.25);

    // 3. 고주파 스파크 노이즈 (High-freq Sizzle)
    const noiseSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseSize);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noiseSrc.connect(hpf);
    hpf.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noiseSrc.start(now);
  }

  /**
   * 보스 공격 적중(폭발) 사운드
   * 묵직하고 거대한 폭발음
   */
  playBossImpactSound(): void {
    if (!this.ensureContext()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 1. 초저역 서브 베이스 (Sub Bass) - 묵직함
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(10, now + 1.0); // 길게 여운

    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain!);
    subOsc.start(now);
    subOsc.stop(now + 1.0);

    // 2. 중간 대역 임팩트 (Sawtooth Drop)
    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = 'sawtooth';
    midOsc.frequency.setValueAtTime(200, now);
    midOsc.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    midGain.gain.setValueAtTime(0.4, now);
    midGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    // 로우패스 필터로 부드럽게
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    midOsc.connect(filter);
    filter.connect(midGain);
    midGain.connect(this.masterGain!);
    midOsc.start(now);
    midOsc.stop(now + 0.3);

    // 3. 노이즈 럼블 (Rumble) - 잔해 소리
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    noiseFilter.frequency.linearRampToValueAtTime(100, now + 0.8); // 점점 먹먹해짐

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noiseSrc.start(now);
  }

  /**
   * 업그레이드 선택 사운드 (마리오 파워업 스타일)
   */
  playUpgradeSound(): void {
    if (this.scene) {
      // 오디오 파일이 로드되어 있으면 그것을 사용
      if (this.scene.sound.get('upgrade_selected')) {
        this.scene.sound.play('upgrade_selected');
        return;
      }
    }

    // 파일이 없거나 로드되지 않았으면 신디사이저로 폴백
    if (!this.ensureContext()) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;

    // 마리오 파워업 스타일: 빠른 아르페지오 상승 (G3 -> B3 -> D4 -> G4 -> B4 -> D5 ...)
    // Mushroom sound: g3(196), b3(246.9), d4(293.7), g4(392), b4(493.9), d5(587.3), g5(784), b5(987.8) ...
    // 대략적인 주파수 상승 시퀀스
    const freqs = [196, 247, 294, 392, 494, 587, 784, 988, 1175, 1568]; 
    const duration = 0.06; // 각 노트 길이

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square'; // 8비트 느낌을 위해 square 파형 사용
      osc.frequency.setValueAtTime(freq, now + i * duration);

      gain.gain.setValueAtTime(0.1, now + i * duration);
      gain.gain.linearRampToValueAtTime(0.1, now + i * duration + duration * 0.8);
      gain.gain.linearRampToValueAtTime(0, now + i * duration + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + i * duration);
      osc.stop(now + i * duration + duration);
    });
  }

  /**
   * 업그레이드 선택 사운드 (마리오 파워업 스타일)
   * 실제 오디오 파일(.wav) 재생을 우선하며, 실패 시 신디사이저로 대체합니다.
   */
  playUpgradeSound(): void {
    const config = Data.gameConfig.audio.upgrade_selected;
    if (!config) return;

    if (this.scene) {
      // 1. 실제 오디오 파일이 캐시에 존재하는지 확인
      if (this.scene.cache.audio.exists(config.key)) {
        try {
          this.scene.sound.play(config.key, { volume: config.volume });
          return;
        } catch (e) {
          console.warn('Failed to play upgrade sound file, falling back to synth:', e);
        }
      }
    }

    // 2. 파일 재생 실패 또는 부재 시 신디사이저로 폴백
    if (!this.ensureContext() || !config.synth) return;
    const ctx = this.audioContext!;
    const now = ctx.currentTime;
    const synth = config.synth;

    // 마리오 파워업 스타일: 빠른 아르페지오 상승
    synth.notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = synth.waveType; // 데이터에서 파형 결정 (square 권장)
      osc.frequency.setValueAtTime(freq, now + i * synth.noteDuration);

      gain.gain.setValueAtTime(synth.gain, now + i * synth.noteDuration);
      gain.gain.linearRampToValueAtTime(synth.gain, now + i * synth.noteDuration + synth.noteDuration * 0.8);
      gain.gain.linearRampToValueAtTime(0, now + i * synth.noteDuration + synth.noteDuration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + i * synth.noteDuration);
      osc.stop(now + i * synth.noteDuration + synth.noteDuration);
    });
  }

  /**
   * Phaser 씬 설정 (BGM 재생에 필요)
   */
  setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * BGM 재생
   */
  playBGM(key: string = 'bgm', volume: number = 0.3): void {
    if (!this.scene) return;

    // 기존 BGM이 있으면 정지
    this.stopBGM();

    // 새 BGM 재생
    this.bgm = this.scene.sound.add(key, {
      loop: true,
      volume: volume,
    });
    this.bgm.play();
  }

  /**
   * BGM 정지
   */
  stopBGM(): void {
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
    }
  }

  /**
   * BGM 볼륨 설정
   */
  setBGMVolume(volume: number): void {
    if (this.bgm && 'setVolume' in this.bgm) {
      (this.bgm as Phaser.Sound.WebAudioSound).setVolume(Math.max(0, Math.min(1, volume)));
    }
  }
}
