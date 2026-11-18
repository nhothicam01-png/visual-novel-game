import asyncio, os, sys
os.environ.setdefault('STORY','assets/KichBan/PipunBuocVaoLop/PipunBuocVaoLop.json')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
async def sc(page):
    rows=harness.story['danh_sach']
    first=next(i for i,x in enumerate(rows) if x.get('loai_phat_ngon')=='narration')
    await page.evaluate("i=>__dbg('loadSourceLineForPlayback(allSourceLines().find(x=>x.sourceIndex==='+i+'))')",first)
    await page.wait_for_function("()=>__dbg('charLayerVideos.some(x=>x.spec.id===\"char_pipun_char_02\"&&x.media&&x.canPlayAnimation)')",timeout=30000)
    before=await page.evaluate("()=>__dbg(\"(()=>{const x=charLayerVideos.find(x=>x.spec.id==='char_pipun_char_02');return {src:x.media.currentSrc,paused:x.media.paused,time:x.media.currentTime,matched:x.animationMatched,canPlay:x.canPlayAnimation}})()\")")
    await asyncio.sleep(1.2)
    after=await page.evaluate("()=>__dbg(\"(()=>{const x=charLayerVideos.find(x=>x.spec.id==='char_pipun_char_02');return {src:x.media.currentSrc,paused:x.media.paused,time:x.media.currentTime,matched:x.animationMatched,canPlay:x.canPlayAnimation}})()\")")
    semantic=await page.evaluate("()=>__dbg(\"({file:normalizeExpression('Pipun-24fps-1795001788335.webm'),front:canonicalAnimationValue('face_angle','0°'),angled:canonicalAnimationValue('face_angle','135°')})\")")
    checks={'extension stripped':semantic['file']=='Pipun-24fps-1795001788335','front bucket':semantic['front']=='front','angled bucket':semantic['angled']=='angled','real WEBM path':'Pipun-24fps-1795001788335.webm' in before['src'] and not before['src'].endswith('.webm.webm'),'WEBM playing':before['canPlay'] and not before['paused'],'video time advances':after['time']>before['time']+0.2}
    for name,ok in checks.items(): print(('PASS ' if ok else 'FAIL ')+name,before,after)
    if not all(checks.values()): raise AssertionError('Pipun WEBM regression failed')
asyncio.run(harness.main(sc))
