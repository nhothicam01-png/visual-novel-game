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
      this.animations = [];
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
        } catch (_) {}
      });
      this.activeClasses = [];
      this.animations.forEach(animation => {
        try {
          const target = animation.effect && animation.effect.target;
          animation.cancel();
          if (target && target.style) target.style.willChange = '';
        } catch (_) {}
      });
      this.animations = [];
    }
    pause() { this.animations.forEach(animation => { try { animation.pause(); } catch (_) {} }); }
    resume() { this.animations.forEach(animation => { try { animation.play(); } catch (_) {} }); }

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

    play(element, frames, options) {
      if (!element || typeof element.animate !== 'function' || !frames) return;
      const animation = element.animate(frames, {
        duration: Math.max(120, Math.min(12000, Number(options.duration_ms) || 900)),
        iterations: Math.max(1, Math.min(8, Number(options.iterations) || 1)),
        direction: 'normal',
        easing: options.easing || 'ease-in-out',
        fill: 'both'
      });
      this.animations.push(animation);
      element.style.willChange = 'transform, opacity, filter';
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

      // Nhấp nhô bằng CSS riêng: không động vào transform định vị video.
      if (type === 'character-bob') {
        const lift = Math.max(10, Math.min(28, 16 * intensity));
        el.style.setProperty('--vn-bob-duration', duration + 'ms');
        el.style.setProperty('--vn-bob-height', lift + 'px');
        el.classList.add('effect-char-bob');
        this.activeClasses.push({
          element: el,
          className: 'effect-char-bob',
          properties: ['--vn-bob-duration', '--vn-bob-height']
        });
        return;
      }

      const center = 'translateX(-50%)';
      let frames = null, iterations = 1, actualDuration = duration;

      if (type === 'character-shake') {
        frames = [
          { transform: center + ' translate(0,0) rotate(0deg)' },
          { transform: center + ' translate(' + (-5*intensity) + 'px,' + (2*intensity) + 'px) rotate(' + (-1.1*intensity) + 'deg)' },
          { transform: center + ' translate(' + (5*intensity) + 'px,' + (-2*intensity) + 'px) rotate(' + (1.1*intensity) + 'deg)' },
          { transform: center + ' translate(' + (-3*intensity) + 'px,0) rotate(' + (-.6*intensity) + 'deg)' },
          { transform: center + ' translate(0,0) rotate(0deg)' }
        ];
      } else if (type === 'character-walk-left' || type === 'character-walk-right') {
        const sign = type === 'character-walk-left' ? -1 : 1;
        const travel = Math.max(5, Math.min(22, Number(params.distance_vw ?? definition.distance_vw ?? 14))) * sign;
        frames = [
          { transform: center + ' translate(0,0)' },
          { transform: center + ' translate(' + (travel*.22) + 'vw,' + (-7*intensity) + 'px)' },
          { transform: center + ' translate(' + (travel*.48) + 'vw,0)' },
          { transform: center + ' translate(' + (travel*.74) + 'vw,' + (-7*intensity) + 'px)' },
          { transform: center + ' translate(' + travel + 'vw,0)' }
        ];
      } else if (type === 'background-zoom') {
        frames = [{ transform: 'scale(1)' }, { transform: 'scale(' + (1+.06*intensity) + ')' }, { transform: 'scale(1)' }];
      } else if (type === 'background-pan-left' || type === 'background-pan-right') {
        const sign = type === 'background-pan-left' ? 1 : -1;
        frames = [{ transform: 'scale(1.035) translate(0,0)' }, { transform: 'scale(1.035) translate(' + (sign*2.5*intensity) + '%,0)' }, { transform: 'scale(1.035) translate(0,0)' }];
      } else if (type === 'background-shake') {
        frames = [{ transform:'translateX(0)' }, { transform:'translateX(' + (-3*intensity) + 'px)' }, { transform:'translateX(' + (3*intensity) + 'px)' }, { transform:'translateX(0)' }];
      } else if (type === 'camera-shake') {
        frames = [{ transform:'translate(0,0)' }, { transform:'translate(' + (-4*intensity) + 'px,2px)' }, { transform:'translate(' + (4*intensity) + 'px,-2px)' }, { transform:'translate(0,0)' }];
      } else if (type === 'camera-zoom') {
        const target = definition.direction === 'out' ? 1-.035*intensity : 1+.045*intensity;
        const cameraFrames = [{ scale:'1' }, { scale:String(target) }, { scale:'1' }];
        this.play(elements.background, cameraFrames, { duration_ms: duration });
        this.play(elements.character, cameraFrames, { duration_ms: duration });
        return;
      } else if (type === 'camera-pan') {
        const sign = definition.direction === 'right' ? -1 : 1;
        frames = [{ transform:'translateX(0)' }, { transform:'translateX(' + (sign*7*intensity) + 'px)' }, { transform:'translateX(0)' }];
      } else if (type === 'camera-flash') {
        this.play(elements.flash, [{opacity:0},{opacity:Math.min(.55,.3*intensity)},{opacity:0}], {duration_ms:duration, easing:'ease-out'});
        return;
      }

      if (frames) this.play(el, frames, { duration_ms: actualDuration, iterations, easing: definition.easing });
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
