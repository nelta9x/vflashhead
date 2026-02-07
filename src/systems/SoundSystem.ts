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
   * 일반적인 사운드 재생 헬퍼
   * Config에서 키를 찾아 파일 재생을 시도하고, 실패 시 콘솔 경고
   */
  private playSound(configKey: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioConfig = (Data.gameConfig.audio as any)[configKey];
    if (!audioConfig) return;

    if (this.scene) {
      if (this.scene.cache.audio.exists(audioConfig.key)) {
        try {
          this.scene.sound.play(audioConfig.key, { volume: audioConfig.volume });
          return;
        } catch (e) {
          console.warn(`Failed to play sound file ${configKey}:`, e);
        }
      }
    }
    
    // 파일 재생 실패 시 Web Audio API fallback이 필요한 경우 여기에 로직 추가 가능
    // 현재는 모든 사운드를 파일로 대체했으므로 생략하거나, 기존 로직을 유지할 수 있음.
    // 여기서는 upgrade_selected와 같이 특수한 경우만 별도 메서드로 유지하고 나머지는 파일 재생만 수행.
  }

  /**
   * 접시 타입별 파괴음 재생
   */
  playDestroySound(dishType: string): void {
    switch (dishType) {
      case 'basic':
        this.playSound('destroy_basic');
        break;
      case 'golden':
        this.playSound('destroy_golden');
        break;
      case 'crystal':
        this.playSound('destroy_crystal');
        break;
      case 'bomb':
        this.playSound('destroy_bomb');
        break;
      default:
        this.playSound('destroy_basic');
    }
  }

  /**
   * 히트 사운드 (접시에 데미지)
   */
  playHitSound(): void {
    this.playSound('hit');
  }

  /**
   * 놓침 사운드 재생
   */
  playMissSound(): void {
    this.playSound('miss');
  }

  /**
   * 안전 사운드 (Bomb 회피) - 현재 별도 파일 없으므로 miss나 hit 재사용 고려하거나,
   * 기존처럼 합성음 유지 가능. 여기서는 'heal' 사운드를 긍정적 피드백으로 사용하거나 보류.
   * 요청 사항은 "모든 사운드를 파일로" 이므로, 안전 사운드는 'heal'과 유사한 긍정음이므로 heal 재사용 또는 별도 파일 생성 필요.
   * 스크립트에서 safe_sound는 생성 안했으므로, 우선 기존 합성음 로직을 유지하거나 추후 추가.
   * => 스크립트에서 safe sound 누락됨. 일단 heal 사운드(긍정적)로 대체하거나 유지.
   * => 안전하게 기존 합성음 유지 (지침 준수: 파일로 만들라 했으나 파일이 없으면 유지해야 함)
   * => 하지만 사용자 요청은 "모든 사운드 파일 관리"이므로 heal 사운드를 재활용.
   * => 메인 메뉴 시작 사운드로 사용됨. 사용자 요청에 따라 업그레이드 사운드로 변경.
   */
  playSafeSound(): void {
    // 사용자 요청에 따라 업그레이드 선택 사운드 사용
    this.playUpgradeSound();
  }

  /**
   * 콤보 사운드 (콤보 마일스톤)
   * 파일 시스템으로는 피치 조절이 제한적이므로,
   * 일단은 'hit' 사운드를 피치 조절하여 사용하거나, 
   * 기존 로직 유지. 
   * 여기서는 'hit' 사운드를 rate 조절하여 재생 시도.
   */
  playComboSound(combo: number): void {
    // 콤보에 따른 피치(rate) 조절
    const baseRate = 1.0;
    const rateMultiplier = Math.min(1 + combo / 50, 2.0); // 최대 2배 속도/피치
    
    const config = Data.gameConfig.audio.hit; // hit 사운드 기반으로 콤보음 대체
    if (this.scene && this.scene.cache.audio.exists(config.key)) {
       this.scene.sound.play(config.key, { 
         volume: config.volume, 
         rate: baseRate * rateMultiplier 
       });
    }
  }

  /**
   * 힐 사운드 재생
   */
  playHealSound(): void {
    this.playSound('heal');
  }

  /**
   * 플레이어 공격 기 모으기 사운드
   */
  playPlayerChargeSound(): void {
    this.playSound('player_charge');
  }

  /**
   * 보스 공격 기 모으기 사운드
   */
  playBossChargeSound(): void {
    this.playSound('boss_charge');
  }

  /**
   * 보스 공격 발사 사운드
   */
  playBossFireSound(): void {
    this.playSound('boss_fire');
  }

  /**
   * 보스 공격 적중(폭발) 사운드
   */
  playBossImpactSound(): void {
    const config = Data.gameConfig.audio.boss_impact;
    if (this.scene && this.scene.cache.audio.exists(config.key)) {
      this.scene.sound.play(config.key, { volume: config.volume });
    }
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