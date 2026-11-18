"""Bố cục nhiều nhân vật: sprite bán thân phải chạm đáy khung; bố cục tự nhiên không được đều tăm tắp."""
import asyncio, os, sys
os.environ.setdefault('STORY','assets/KichBan/DemTongDuyetAnhSang/DemTongDuyetAnhSang.json')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
fails=[]
async def sc(page):
    for row in (8,18,21,10):
        info=await page.evaluate("""r=>__dbg(`(async()=>{const lines=allSourceLines();const it=lines[Math.min(Math.max(0,Number(${r})||0),lines.length-1)];if(!it)throw new Error('Timeline không có dòng để kiểm tra; count='+lines.length);await loadSourceLineForPlayback(it);
          return charLayerVideos.map(l=>({id:l.spec.id,y:l.spec.y,scale:l.spec.scale,x:l.spec.x,z:l.spec.z_index,cut:!!l.spec.bottomCut}))})()`)""",row)
        print('row',row,[(c['id'][-6:],round(c['x'],1),round(c['scale'],3),c['y'],c['z'],c['cut']) for c in info])
        if len(info)<2: fails.append(('no layers',row)); continue
        if any(c['cut'] and c['y']<102 for c in info): fails.append(('half-body sprite floats above bottom',row))
        xs=sorted(round(c['x'],1) for c in info)
        if len(set(xs))<len(info) or any(xs[i+1]-xs[i]<8 for i in range(len(xs)-1)): fails.append(('characters too close or share a position',row))
        if any(not(0<c['x']<100) for c in info): fails.append(('x outside frame',row))
asyncio.run(harness.main(sc))
print('FAILS:',fails or 'none'); sys.exit(1 if fails else 0)
