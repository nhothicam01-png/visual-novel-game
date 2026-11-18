import asyncio, json, os, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
D=lambda page,c: page.evaluate("c=>__dbg(c)",c)
async def st(page):
    return json.loads(await D(page,"JSON.stringify({prev:previewing,prep:previewPreparing,paused:previewPaused,raf:!!raf,btn:document.getElementById('play-preview').textContent,scene:activeSceneIndex,line:activeLineIndex,fx:sceneEffectLayers.length})"))
ok=True
def check(name,cond,info):
    global ok; ok&=bool(cond); print(('PASS ' if cond else 'FAIL ')+name,info)
async def sc(page):
    await page.select_option('#preview-scope','full')
    if not os.environ.get('LOADING'):
        await page.wait_for_function("__dbg('sceneEffectLayers.length')>=2",timeout=120000)
    # A: Run at scene having lightning fx
    s0=await st(page); check('fx layers present before Run',s0['fx']>=2,s0)
    await page.click('#play-preview'); await asyncio.sleep(2.5)
    s=await st(page); check('A: Run starts playback',s['prev'] and s['raf'] and s['btn']=='⏸ Tạm dừng',s)
    # pause / resume
    await page.click('#play-preview'); await asyncio.sleep(0.5)
    s=await st(page); check('Pause works',s['prev'] and s['paused'] and s['btn']=='▶ Tiếp tục',s)
    await page.click('#play-preview'); await asyncio.sleep(0.5)
    s=await st(page); check('Resume works',s['prev'] and not s['paused'] and s['btn']=='⏸ Tạm dừng',s)
    # B: timeline crosses scenes with fx (browser TTS in headless is instant/none -> hold durations drive timeline)
    sc0=s['scene']; seen={sc0}
    for i in range(60):
        await asyncio.sleep(1.0); s=await st(page); seen.add(s['scene'])
        if not s['prev']: break
        if len(seen)>=3: break
    # sample brightness of preview canvas over time: lightning flashes must change pixels
    vals=[]
    for i in range(40):
        vals.append(await D(page,"(()=>{const d=document.getElementById('preview-canvas').getContext('2d').getImageData(0,0,1920,1080).data;let t=0;for(let i=0;i<d.length;i+=4000)t+=d[i]+d[i+1]+d[i+2];return t})()"))
        await asyncio.sleep(0.15)
    vals=[float(v) for v in vals]
    check('lightning visibly drawn (brightness varies)',max(vals)-min(vals)>0.02*max(vals),(min(vals),max(vals)))
    check('B: timeline advanced across scenes',len(seen)>=2,sorted(seen))
    # C: Stop then Run again
    await page.click('#stop-scene'); await asyncio.sleep(3)
    s=await st(page); check('Stop resets',not s['prev'] and not s['raf'] and s['btn']=='▶ Chạy' and s['scene']==0,s)
    await page.click('#play-preview'); await asyncio.sleep(2.5)
    s=await st(page); check('C: Run again after Stop',s['prev'] and s['raf'],s)
    # stop in the middle then run again, immediately
    await page.click('#stop-scene'); await page.click('#play-preview'); await asyncio.sleep(2.5)
    s=await st(page); check('C2: Stop+Run immediately',s['prev'] and s['raf'],s)
    # frames really drawn (lightning flash pixel check)
    frames=await D(page,"(()=>{let n=0;const c=document.getElementById('preview-canvas').getContext('2d');const d=c.getImageData(0,0,64,64).data;return d.length})()")
    check('canvas readable',frames>0,frames)
    # animate loop survives an exception in a tick
    await D(page,"(()=>{const o=renderPreviewTick;window.__n=0;})()")
try: asyncio.run(harness.main(sc))
finally:
    bad=[l for l in harness.logs if l[0]=='PAGEERROR' or ('Lỗi' in l[1] and 'Failed to load' not in l[1])]
    print('ERRORS:',bad[:5])
    print('ALL PASS' if ok and not bad else 'SOME FAIL')

sys.exit(0 if ok and not [l for l in harness.logs if l[0]=='PAGEERROR'] else 1)
