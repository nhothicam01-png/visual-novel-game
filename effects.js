/* Visual Novel Effects Library
 * Tất cả hiệu ứng được đăng ký tại đây; JSON chỉ được gọi ID đã có.
 * Các transform dùng Web Animations API với composite:add để có thể cộng hưởng.
 */
(() => {
  'use strict';
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const registry = {
    nhan_vat: {
      char_walk_bob: { label:'Nhân vật nhún nhẹ khi bước nhưng giữ chân chạm đất', transform:[{transform:'scaleY(1)'},{transform:'scaleY(1.018)'},{transform:'scaleY(1)'}], duration:520 },
      char_sway: { label:'Nhân vật nghiêng nhẹ quanh điểm tiếp đất', transform:[{transform:'rotate(-2.5deg)'},{transform:'rotate(2.5deg)'},{transform:'rotate(-2.5deg)'}], duration:1500 },
      char_fear_shake: { label:'Nhân vật run rẩy tại chỗ, neo chân ở đáy', transform:[{transform:'translateX(-3px) rotate(-1deg)'},{transform:'translateX(3px) rotate(1deg)'},{transform:'translateX(-2px) rotate(-0.5deg)'}], duration:105 },
      char_move_left: { label:'Nhân vật di chuyển sang trái, không nhấc khỏi mặt đất', transform:[{transform:'translateX(0)'},{transform:'translateX(-17px)'},{transform:'translateX(-34px)'}], duration:900, once:true },
      char_move_right: { label:'Nhân vật di chuyển sang phải, không nhấc khỏi mặt đất', transform:[{transform:'translateX(0)'},{transform:'translateX(17px)'},{transform:'translateX(34px)'}], duration:900, once:true },
      char_fade_out: { label:'Nhân vật mờ dần biến mất', opacity:[{opacity:1},{opacity:0}], duration:1100, once:true },
      char_ghost: { label:'Nhân vật trong suốt như linh hồn', filter:'opacity(0.48) saturate(0.65) brightness(1.12)' },
      char_blur: { label:'Nhân vật từ từ mất nét rồi nhòe rõ rệt', filter:[{filter:'blur(0px)'},{filter:'blur(4px)'}], duration:1500, once:true },
      char_giant: { label:'Nhân vật phóng to từ điểm tiếp đất', transform:[{transform:'scale(1)'},{transform:'scale(1.65)'}], duration:900, once:true }
    },
    nen: {
      bg_zoom_in: { label:'Nền zoom gần', transform:[{transform:'scale(1)'},{transform:'scale(1.18)'}], duration:6500, once:true },
      bg_zoom_out: { label:'Nền zoom xa', transform:[{transform:'scale(1.18)'},{transform:'scale(1)'}], duration:6500, once:true },
      bg_sway: { label:'Nền lắc lư nhẹ trái phải', transform:[{transform:'translateX(-1.2%) rotate(-0.25deg)'},{transform:'translateX(1.2%) rotate(0.25deg)'},{transform:'translateX(-1.2%) rotate(-0.25deg)'}], duration:5000 },
      bg_earthquake: { label:'Nền rung lắc như động đất', transform:[{transform:'translate(-1.2%,0.7%) rotate(-0.6deg)'},{transform:'translate(1.1%,-0.8%) rotate(0.6deg)'},{transform:'translate(-0.8%,-0.6%) rotate(-0.4deg)'},{transform:'translate(0.8%,0.6%) rotate(0.4deg)'}], duration:115 },
      bg_pan_left: { label:'Nền trượt sang trái', transform:[{transform:'translateX(0)'},{transform:'translateX(-12%)'}], duration:7000, once:true },
      bg_pan_right: { label:'Nền trượt sang phải', transform:[{transform:'translateX(-12%)'},{transform:'translateX(0)'}], duration:7000, once:true },
      bg_pan_up: { label:'Nền trượt lên trên', transform:[{transform:'translateY(0)'},{transform:'translateY(-10%)'}], duration:7000, once:true },
      bg_pan_down: { label:'Nền trượt xuống dưới', transform:[{transform:'translateY(-10%)'},{transform:'translateY(0)'}], duration:7000, once:true },
      bg_misty: { label:'Nền mờ ảo', filter:'blur(1.5px) brightness(1.12) saturate(0.8)' },
      bg_dizzy_spin: { label:'Nền xoay vòng chóng mặt', transform:[{transform:'rotate(-3deg) scale(1.12)'},{transform:'rotate(3deg) scale(1.12)'},{transform:'rotate(-3deg) scale(1.12)'}], duration:1800 }
    },
    camera: {
      camera_zoom_in: { label:'Camera zoom gần', transform:[{transform:'scale(1)'},{transform:'scale(1.16)'}], duration:4200, once:true },
      camera_zoom_out: { label:'Camera zoom xa', transform:[{transform:'scale(1.16)'},{transform:'scale(1)'}], duration:4200, once:true },
      camera_sway: { label:'Camera lắc lư nhẹ', transform:[{transform:'translateX(-0.7%) rotate(-0.25deg)'},{transform:'translateX(0.7%) rotate(0.25deg)'},{transform:'translateX(-0.7%) rotate(-0.25deg)'}], duration:2600 },
      camera_shake: { label:'Camera rung lắc mạnh', transform:[{transform:'translate(-1.1%,0.7%) rotate(-0.45deg)'},{transform:'translate(1.1%,-0.7%) rotate(0.45deg)'},{transform:'translate(-0.8%,-0.6%) rotate(-0.3deg)'},{transform:'translate(0.8%,0.6%) rotate(0.3deg)'}], duration:100 },
      camera_pan_left: { label:'Camera trượt trái', transform:[{transform:'translateX(0)'},{transform:'translateX(-5%)'}], duration:2800, once:true },
      camera_pan_right: { label:'Camera trượt phải', transform:[{transform:'translateX(0)'},{transform:'translateX(5%)'}], duration:2800, once:true },
      camera_pan_up: { label:'Camera trượt lên', transform:[{transform:'translateY(0)'},{transform:'translateY(-5%)'}], duration:2800, once:true },
      camera_pan_down: { label:'Camera trượt xuống', transform:[{transform:'translateY(0)'},{transform:'translateY(5%)'}], duration:2800, once:true },
      camera_misty: { label:'Toàn cảnh từ từ mất nét: nền, nhân vật và lớp hiệu ứng', filter:[{filter:'blur(0px) brightness(1)'},{filter:'blur(3.5px) brightness(1.08)'}], duration:1600, once:true },
      camera_spin: { label:'Camera xoay vòng', transform:[{transform:'rotate(-2deg) scale(1.1)'},{transform:'rotate(2deg) scale(1.1)'},{transform:'rotate(-2deg) scale(1.1)'}], duration:2200 },
      camera_tilt_left: { label:'Camera nghiêng trái', transform:[{transform:'rotate(0deg)'},{transform:'rotate(-7deg)'}], duration:900, once:true },
      camera_tilt_right: { label:'Camera nghiêng phải', transform:[{transform:'rotate(0deg)'},{transform:'rotate(7deg)'}], duration:900, once:true }
    }
  };
  const catalog = [
    {id:'char-bob',label:'Nhấp nhô',targets:['character'],renderAs:{character:'char-bob'}},
    {id:'char-sway',label:'Đung đưa',targets:['character'],renderAs:{character:'char-sway'}},
    {id:'char-shake',label:'Rung',targets:['character'],renderAs:{character:'char-shake'}},
    {id:'char-zoom',label:'Phóng to nhẹ',targets:['character'],renderAs:{character:'char-zoom'}},
    {id:'char-float',label:'Trôi nhẹ',targets:['character'],renderAs:{character:'char-float'}},
    {id:'char-breathe',label:'Thở nhẹ',targets:['character'],renderAs:{character:'char-breathe'}},
    {id:'char-enter',label:'Đi vào cảnh',targets:['character'],renderAs:{character:'char-enter'}},
    {id:'char-fade',label:'Mờ dần xuất hiện',targets:['character'],renderAs:{character:'char-fade'}},
    {id:'bg-zoom',label:'Zoom chậm',targets:['background'],renderAs:{background:'bg-zoom'}},
    {id:'bg-left',label:'Lia trái',targets:['background'],renderAs:{background:'bg-left'}},
    {id:'bg-right',label:'Lia phải',targets:['background'],renderAs:{background:'bg-right'}},
    {id:'bg-float',label:'Trôi nhẹ',targets:['background'],renderAs:{background:'bg-float'}},
    {id:'bg-blur',label:'Mờ điện ảnh',targets:['background'],renderAs:{background:'bg-blur'}},
    {id:'bg-pulse',label:'Ánh sáng nhịp',targets:['background'],renderAs:{background:'bg-pulse'}},
    {id:'camera-shake',label:'Rung lắc',targets:['camera'],renderAs:{camera:'camera-shake'}},
    {id:'camera-zoom',label:'Zoom gần',targets:['camera'],renderAs:{camera:'camera-zoom'}},
    {id:'camera-pull',label:'Zoom xa',targets:['camera'],renderAs:{camera:'camera-pull'}},
    {id:'camera-drift',label:'Lia máy nhẹ',targets:['camera'],renderAs:{camera:'camera-drift'}},
    {id:'soft-sway',label:'Chuyển động đung đưa mềm',targets:['character','background','camera'],renderAs:{character:'char-sway',background:'bg-float',camera:'camera-drift'}}
  ];
  const active = new WeakMap();
  const allNodes = new Set();
  function cancelNode(node) {
    if (!node) return;
    (active.get(node) || []).forEach(a => { try { a.cancel(); } catch (_) {} });
    active.delete(node);
    node.style.filter = '';
  }
  function addAnimation(node, def) {
    if (!node || reducedMotion()) return;
    const list = active.get(node) || [];
    if (def.transform) {
      const a = node.animate(def.transform, {duration:def.duration || 1000, iterations:def.once ? 1 : Infinity, easing:def.easing || 'ease-in-out', fill:def.once ? 'forwards' : 'none', composite:'add'});
      list.push(a);
    }
    if (def.opacity) {
      const a = node.animate(def.opacity, {duration:def.duration || 1000, iterations:def.once ? 1 : Infinity, easing:'ease-in-out', fill:def.once ? 'forwards' : 'none'});
      list.push(a);
    }
    if (Array.isArray(def.filter)) {
      // Filter keyframes tạo blur chuyển dần thay vì bật mờ tức thì.
      const a = node.animate(def.filter, {duration:def.duration || 1000, iterations:def.once ? 1 : Infinity, easing:def.easing || 'ease-in-out', fill:def.once ? 'forwards' : 'none'});
      list.push(a);
    } else if (def.filter) {
      node.style.filter = [node.style.filter, def.filter].filter(Boolean).join(' ');
    }
    active.set(node, list); allNodes.add(node);
  }
  function apply(config, targets) {
    clear();
    const normalized = config && typeof config === 'object' ? config : {};
    const groups = [
      ['nen', targets?.nen ? [targets.nen] : []],
      ['nhan_vat', targets?.nhan_vat ? [targets.nhan_vat] : []],
      ['camera', Array.isArray(targets?.camera) ? targets.camera : []]
    ];
    for (const [category, nodes] of groups) {
      const ids = Array.isArray(normalized[category]) ? normalized[category] : [];
      for (const id of ids) {
        const def = registry[category]?.[id];
        if (!def) { console.warn('[VNEffects] Bỏ qua ID hiệu ứng không tồn tại:', category, id); continue; }
        // camera_misty là hiệu ứng nhòe toàn cảnh; các chuyển động camera khác chỉ tác động nền.
        const effectNodes = category === 'camera' && id === 'camera_misty' && Array.isArray(targets?.scene)
          ? targets.scene
          : nodes;
        effectNodes.forEach(node => addAnimation(node, def));
      }
    }
  }
  function clear() {
    allNodes.forEach(cancelNode);
    allNodes.clear();
  }
  function list(target) {
    return catalog.filter(item => !target || item.targets.includes(target)).map(item => ({id:item.id,label:item.label,targets:item.targets.slice()}));
  }
  function renderKey(target,id) {
    const item=catalog.find(entry=>entry.id===id);
    return item?.renderAs?.[target] || id;
  }
  window.VNEffects = Object.freeze({apply, clear, list, renderKey, registry, catalog});
})();
