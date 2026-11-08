/* Visual Novel Effect Engine
 * Catalog-driven effects. No arbitrary JavaScript is loaded from the library.
 */
(function (global) {
  'use strict';

  class VisualNovelEffectEngine {
    constructor(libraryUrl) {
      this.libraryUrl = libraryUrl || './assets/Config/effect_library.json';
      this.library = { library_version: 1, effects: [] };
      this.effects = new Map();
      this.activeClasses = [];
      this.ready = this.loadLibrary();
    }

    async loadLibrary() {
      try {
        const response = await fetch(this.libraryUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (!data || !Array.isArray(data.effects)) throw new Error('Cấu trúc thư viện không hợp lệ');
        this.library = data;
        this.effects = new Map(data.effects.filter(x => x && typeof x.id === 'string').map(x => [x.id, x]));
      } catch (error) {
        console.error('[EffectEngine] Không tải được effect_library.json:', error);
        this.libraryError = error;
      }
    }

    clear() {
      this.activeClasses.forEach(item => {
        try {
          item.element.classList.remove(item.className);
          item.properties.forEach(name => item.element.style.removeProperty(name));
          item.element.style.removeProperty('animation-play-state');
        } catch (_) {}
      });
      this.activeClasses = [];
    }
    pause() {
      this.activeClasses.forEach(item => { try { item.element.style.animationPlayState = 'paused'; } catch (_) {} });
    }
    resume() {
      this.activeClasses.forEach(item => { try { item.element.style.animationPlayState = 'running'; } catch (_) {} });
    }

    normalizeSlot(slot) {
      if (!slot) return null;
      if (typeof slot === 'string') return slot ? { id: slot } : null;
      if (typeof slot === 'object' && typeof slot.id === 'string') return slot;
      return null;
    }

    legacySlot(value, target) {
      if (!value || typeof value !== 'object') return null;
      const kind = String(value.kieu || value.type || value.effect || value.loai || '').toLowerCase();
      const maps = {
        character: {
          shake: 'char.shake', tremble: 'char.shake', rung: 'char.shake',
          bounce: 'char.bob', jump: 'char.bob', nhay: 'char.bob',
          walk: 'char.bob', walking: 'char.bob', 'di-bo': 'char.bob',
          'enter-left': 'char.walk_left', 'slide-left': 'char.walk_left',
          'enter-right': 'char.walk_right', 'slide-right': 'char.walk_right'
        },
        background: { zoom: 'bg.zoom_slow', 'zoom-in': 'bg.zoom_slow', pan: 'bg.pan_left', move: 'bg.pan_left', shake: 'bg.shake', rung: 'bg.shake' },
        camera: { shake: 'camera.shake', rung: 'camera.shake', zoom: 'camera.zoom_in', 'zoom-in': 'camera.zoom_in', 'zoom-out': 'camera.zoom_out', pan: 'camera.pan_left', move: 'camera.pan_left', flash: 'camera.flash' }
      };
      const id = maps[target] && maps[target][kind];
      if (!id) return null;
      return { id, params: {
        duration_ms: Number(value.thoi_gian || value.duration || 0) || undefined,
        intensity: Number(value.cuong_do || value.intensity || 1)
      }};
    }


    applyDefinition(slot, expectedTarget, elements) {
      const ref = this.normalizeSlot(slot);
      if (!ref) return;
      const definition = this.effects.get(ref.id);
      if (!definition) {
        console.warn('[EffectEngine] Bỏ qua ID hiệu ứng không tồn tại:', ref.id);
        return;
      }
      if (definition.target !== expectedTarget) {
        console.warn('[EffectEngine] Sai target cho hiệu ứng:', ref.id, definition.target, expectedTarget);
        return;
      }
      const params = ref.params && typeof ref.params === 'object' ? ref.params : {};
      const intensity = Math.max(0.25, Math.min(2, Number(params.intensity ?? definition.intensity ?? 1)));
      const duration = Math.max(120, Math.min(12000, Number(params.duration_ms ?? definition.duration_ms ?? 900)));
      const el = expectedTarget === 'character' ? elements.character
        : expectedTarget === 'background' ? elements.background : elements.camera;
      if (!el) return;
      const type = definition.engine_type;
      const classMap = {
        'character-shake': [['character', 'effect-char-shake']],
        'character-bob': [['character', 'effect-char-bob']],
        'character-walk-left': [['character', 'effect-char-walk-left']],
        'character-walk-right': [['character', 'effect-char-walk-right']],
        'background-zoom': [['background', 'effect-bg-zoom']],
        'background-pan-left': [['background', 'effect-bg-pan-left']],
        'background-pan-right': [['background', 'effect-bg-pan-right']],
        'background-shake': [['background', 'effect-bg-shake']],
        'camera-shake': [['camera', 'effect-camera-shake']],
        'camera-pan': [['camera', definition.direction === 'right' ? 'effect-camera-pan-right' : 'effect-camera-pan-left']],
        'camera-zoom': [
          ['background', definition.direction === 'out' ? 'effect-camera-zoom-out' : 'effect-camera-zoom-in'],
          ['character', definition.direction === 'out' ? 'effect-camera-zoom-out' : 'effect-camera-zoom-in']
        ],
        'camera-flash': [['flash', 'effect-camera-flash']]
      };
      const targets = classMap[type];
      if (!targets) {
        console.warn('[EffectEngine] Chưa có CSS cho engine_type:', type);
        return;
      }
      const distance = Math.max(5, Math.min(22, Number(params.distance_vw ?? definition.distance_vw ?? 14)));
      targets.forEach(([key, className]) => {
        const target = key === 'character' ? elements.character
          : key === 'background' ? elements.background
          : key === 'flash' ? elements.flash : elements.camera;
        if (!target) return;
        target.style.setProperty('--vn-effect-duration', duration + 'ms');
        target.style.setProperty('--vn-effect-intensity', String(intensity));
        target.style.setProperty('--vn-effect-distance', distance + 'vw');
        target.classList.add(className);
        this.activeClasses.push({
          element: target,
          className,
          properties: ['--vn-effect-duration', '--vn-effect-intensity', '--vn-effect-distance']
        });
      });
    }

    applyFrame(frame, elements) {
      this.clear();
      if (!frame || typeof frame !== 'object') return;
      const v2 = frame.hieu_ung && typeof frame.hieu_ung === 'object';
      const slots = v2 ? frame.hieu_ung : null;
      if (v2) {
        this.applyDefinition(slots.nhan_vat, 'character', elements);
        this.applyDefinition(slots.nen, 'background', elements);
        this.applyDefinition(slots.camera, 'camera', elements);
        return;
      }
      // Tương thích kịch bản schema v1 trong giai đoạn chuyển đổi.
      this.applyDefinition(this.legacySlot(frame.hieu_ung_nhan_vat || frame.character_effect || frame.characterEffect, 'character'), 'character', elements);
      this.applyDefinition(this.legacySlot(frame.hieu_ung_nen || frame.background_effect || frame.backgroundEffect, 'background'), 'background', elements);
      this.applyDefinition(this.legacySlot(frame.hieu_ung_camera || frame.camera_effect || frame.cameraEffect, 'camera'), 'camera', elements);
    }
  }

  global.VisualNovelEffectEngine = VisualNovelEffectEngine;
})(window);
