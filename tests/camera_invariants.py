"""Kiểm tra camera shot trên MỌI dòng của một kịch bản (mặc định DemTongDuyetAnhSang):
 - vùng nhìn luôn nằm trọn trong khung (không lộ viền nền);
 - nhân vật neo y>=100% vẫn chạm/vượt đáy màn hình sau khi zoom (không hở đáy)."""
import asyncio, json, os, sys
os.environ.setdefault('STORY','assets/KichBan/DemTongDuyetAnhSang/DemTongDuyetAnhSang.json')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
bad=[]; checked=0
async def sc(page):
    global checked
    rows=harness.story['danh_sach']
    res=await page.evaluate("""rows=>__dbg(`(${JSON.stringify(rows)}).map((r,i)=>{
      const cam=r.camera||{},shot=String(cam.shot||'').toLowerCase().replace(/[- ]+/g,'_');
      const z=Number(cam.zoom)||(shot==='close_up'?1.52:shot==='medium'?1.18:shot==='over_shoulder'?1.32:0);
      const layers=(r.nhan_vat_hien_thi||[]).filter(c=>c.visible!==false&&c.remove_from_scene!==true).map(c=>({spec:c}));
      return [1920,1080,false].concat([1080,1920,true]).length&&[[1920,1080,false],[1080,1920,true]].map(([w,h,p])=>{
        const c=computeShotCamera(w,h,z,String(cam.target||r.nhan_vat||''),layers,p);return {i,w,h,c,
          ys:layers.map(l=>Number(l.spec.y??102))}})})`)""",rows)
    for pair in res:
        for e in pair:
            c=e['c']
            if not c: continue
            checked+=1; w,h=e['w'],e['h']; hw,hh=w/2/c['zoom'],h/2/c['zoom']
            if c['cx']-hw<-1e-6 or c['cx']+hw>w+1e-6 or c['cy']-hh<-1e-6 or c['cy']+hh>h+1e-6: bad.append(('view outside frame',e['i'],w,h,c))
            feet=lambda y:h/2+c['zoom']*(h*1.02-c['cy'])
            if min(e['ys'] or [102])>=100 and feet(0)<h-1e-6: bad.append(('feet above frame bottom',e['i'],w,h,c))
asyncio.run(harness.main(sc))
print('camera shots checked:',checked,'violations:',len(bad)); [print(b) for b in bad[:5]]
sys.exit(1 if bad or not checked else 0)
