const UPGRADE_SYMBOLS: Record<string, string> = {
  damage_up: '⚔',
  attack_speed: '⚡',
  dish_slow: '⏱',
  hp_up: '♥',
  heal_on_wave: '✚',
  aoe_destroy: '◎',
  bomb_shield: '🛡',
  lifesteal: '♡',
  combo_heal: '❤',
  health_pack: '✚',
  cursor_size: '◯',
  critical_chance: '✦',
  aoe_destroy_enhanced: '◉',
  freeze_aura: '❄',
  electric_shock: '⚡',
  bomb_convert: '↻',
  second_chance: '↺',
  magnet_pull: '⊕',
  magnet: '⊕',
  chain_reaction: '⁂',
  black_hole: '●',
  immortal: '∞',
  time_stop: '⏸',
  auto_destroy: '⟳',
  missile: '✹',
  orbiting_orb: '◎',
};

export function getUpgradeFallbackSymbol(upgradeId: string): string {
  return UPGRADE_SYMBOLS[upgradeId] || '★';
}
