/* Shared local cache for authoritative world profiles used by Studio and playback. */
(()=>{'use strict';
const PREFIX='vn.world.profile.v1:';
function key(slug){return PREFIX+encodeURIComponent(String(slug||''))}
function read(slug){if(!slug)return null;try{const raw=localStorage.getItem(key(slug));if(!raw)return null;const item=JSON.parse(raw);return item&&item.data&&typeof item.data==='object'?item.data:null}catch(e){return null}}
function save(slug,data){if(!slug||!data||typeof data!=='object')throw new Error('Thiếu mã thế giới hoặc dữ liệu thế giới.');const value=JSON.stringify({savedAt:new Date().toISOString(),data});try{localStorage.setItem(key(slug),value)}catch(e){throw new Error('Không thể lưu hồ sơ thế giới cục bộ: '+(e&&e.message||e))}return data}
async function load(slug,fetcher){const cached=read(slug);if(cached)return cached;if(typeof fetcher!=='function')throw new Error('Chưa có hồ sơ thế giới cục bộ và không có nguồn tải dự phòng.');const fresh=await fetcher();save(slug,fresh);return fresh}
function remove(slug){if(slug)try{localStorage.removeItem(key(slug))}catch(e){}}
window.WorldCache={key,read,save,load,remove};
})();