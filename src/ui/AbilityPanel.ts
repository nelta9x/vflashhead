import { EventBus, GameEvents } from '../utils/EventBus';
import { UPGRADES, UpgradeSystem } from '../systems/UpgradeSystem';

interface UpgradeInfo {
  id: string;
  name: string;
  maxStack: number;
  icon: string;
}

const UPGRADE_ICONS: Record<string, string> = {
  cursor_size: '◯',
  electric_shock: '⚡',
  magnet: '🧲',
};

export class AbilityPanel {
  private panelElement: HTMLElement | null;
  private upgradeInfoMap: Map<string, UpgradeInfo>;
  private upgradeSystem: UpgradeSystem | null = null;
  private onUpgradesChangedBound: (...args: unknown[]) => void;

  constructor() {
    this.panelElement = document.getElementById('ability-panel');

    // 업그레이드 정보 맵 생성
    this.upgradeInfoMap = new Map();
    for (const upgrade of UPGRADES) {
      this.upgradeInfoMap.set(upgrade.id, {
        id: upgrade.id,
        name: upgrade.name,
        maxStack: upgrade.maxStack,
        icon: UPGRADE_ICONS[upgrade.id] || '✦',
      });
    }

    // EventBus 구독
    this.onUpgradesChangedBound = this.onUpgradesChanged.bind(this);
    EventBus.getInstance().on(GameEvents.UPGRADES_CHANGED, this.onUpgradesChangedBound);

    // 초기 상태 (빈 패널)
    this.render(new Map());
  }

  setUpgradeSystem(upgradeSystem: UpgradeSystem): void {
    this.upgradeSystem = upgradeSystem;
  }

  private onUpgradesChanged(...args: unknown[]): void {
    const stacks = args[0] as Map<string, number>;
    this.render(stacks);
  }

  private render(stacks: Map<string, number>): void {
    if (!this.panelElement) return;

    // 기존 카드 제거
    this.panelElement.innerHTML = '';

    // 보유한 어빌리티만 표시
    stacks.forEach((level, upgradeId) => {
      if (level <= 0) return;

      const info = this.upgradeInfoMap.get(upgradeId);
      if (!info) return;

      const card = this.createAbilityCard(info, level);
      this.panelElement!.appendChild(card);
    });
  }

  private createAbilityCard(info: UpgradeInfo, level: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'ability-card';

    const isMaxLevel = level >= info.maxStack;

    // 동적 설명 생성 (UpgradeSystem이 연결된 경우)
    const description = this.upgradeSystem
      ? this.upgradeSystem.getFormattedDescription(info.id)
      : '';

    card.innerHTML = `
      <div class="ability-icon">${info.icon}</div>
      <div class="ability-info">
        <div class="ability-header">
          <span class="ability-name">${info.name}</span>
          <span class="ability-level ${isMaxLevel ? 'max-level' : ''}">Lv.${level}${isMaxLevel ? ' MAX' : ''}</span>
        </div>
        <div class="ability-desc">${description}</div>
      </div>
    `;

    return card;
  }

  destroy(): void {
    EventBus.getInstance().off(GameEvents.UPGRADES_CHANGED, this.onUpgradesChangedBound);

    if (this.panelElement) {
      this.panelElement.innerHTML = '';
    }
  }
}
