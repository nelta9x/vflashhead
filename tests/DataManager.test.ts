import { describe, it, expect, beforeEach } from 'vitest';
import { Data } from '../src/data/DataManager';

describe('DataManager', () => {
  describe('Color Resolution (getColor & getColorHex)', () => {
    it('should resolve standard color keys correctly (case-insensitive)', () => {
      // colors.json에 정의된 기본 색상 확인
      const cyanHex = Data.getColorHex('cyan');
      const cyanHexUpper = Data.getColorHex('CYAN');
      
      expect(cyanHex).toBe('#00ffff');
      expect(cyanHexUpper).toBe('#00ffff');
      
      const cyanNum = Data.getColor('cyan');
      expect(cyanNum).toBe(0x00ffff);
    });

    it('should resolve newly added color keys', () => {
      // 리팩토링 과정에서 추가한 색상들
      expect(Data.getColorHex('darkCyan')).toBe('#003333');
      expect(Data.getColorHex('brightGreen')).toBe('#44ff88');
    });

    it('should handle raw hex strings correctly', () => {
      expect(Data.getColorHex('#ff00ff')).toBe('#ff00ff');
      expect(Data.getColor('#ff0000')).toBe(0xff0000);
    });

    it('should return fallback values for unknown keys', () => {
      expect(Data.getColorHex('non_existent_color')).toBe('#ffffff');
      expect(Data.getColor('non_existent_color')).toBe(0xffffff);
    });
  });

  describe('Localization & Fonts', () => {
    it('should return correct font family based on language', () => {
      // 기본값 (index.html에서 ko로 설정되어 있을 수 있음)
      const currentLang = Data.getLanguage();
      
      Data.setLanguage('ko');
      expect(Data.getFont()).toContain('NeoDunggeunmoPro');
      
      Data.setLanguage('en');
      expect(Data.getFont()).toContain('NeoDunggeunmoPro'); // 현재 영어도 네오둥근모로 설정됨
      
      // 복구
      Data.setLanguage(currentLang);
    });

    it('should translate keys correctly', () => {
      Data.setLanguage('ko');
      expect(Data.t('menu.title')).toBe('FLASHHEAD');
      
      // 인자 치환 테스트
      const waveText = Data.t('hud.wave', 5);
      expect(waveText).toBe('웨이브 5');
    });

    it('should format templates correctly', () => {
      Data.setLanguage('ko');
      const template = 'upgrade.cursor_size.desc_template';
      const result = Data.formatTemplate(template, { sizeBonus: 30, damage: 5 });
      
      expect(result).toContain('30%');
      expect(result).toContain('5');
    });
  });

  describe('Configuration Access', () => {
    it('should load complex nested configurations', () => {
      expect(Data.gameConfig.upgradeUI.boxHeight).toBeDefined();
      expect(Data.gameConfig.hud.hpDisplay.heartSize).toBe(12);
      expect(Data.mainMenu.startPrompt.fontSize).toBeDefined();
    });
  });
});
