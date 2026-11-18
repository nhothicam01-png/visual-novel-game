"""Bố cục nhiều nhân vật: sprite bán thân phải chạm đáy khung; bố cục tự nhiên không được đều tăm tắp."""
import asyncio, os, sys
os.environ.setdefault('STORY','assets/KichBan/DemTongDuyetAnhSang/DemTongDuyetAnhSang.json')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
fails=[]
async def sc(page):
    for row in (8,18,21,10):
        info=await page.evaluate("""r=>__dbg(`(async()=>{const it=allSourceLines().find(i=>i.sourceIndex==${r});await loadSourceLineForPlayback(it);
          return charLayerVideos.map(l=>({id:l.spec.id,y:l.spec.y,scale:l.spec.scale,x:l.spec.x,z:l.spec.z_index,cut:!!l.spec.bottomCut}))})()`)""",row)
        print('row',row,[(c['id'][-6:],round(c['x'],1),round(c['scale'],3),c['y'],c['z'],c['cut']) for c in info])
        if len(info)<2: fails.append(('no layers',row)); continue
        if any(c['cut'] and c['y']<102 for c in info): fails.append(('half-body sprite floats above bottom',row))
        if len({round(c['scale'],3) for c in info})<2: fails.append(('all characters same size',row))
        if any(not(0<c['x']<100) for c in info): fails.append(('x outside frame',row))
asyncio.run(harness.main(sc))
print('FAILS:',fails or 'none'); sys.exit(1 if fails else 0)
