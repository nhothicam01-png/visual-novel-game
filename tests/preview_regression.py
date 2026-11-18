import asyncio, json, os, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import harness
D=lambda page,c: page.evaluate("c=>__dbg(c)",c)
async def state(page):
    return json.loads(await D(page,"JSON.stringify({prev:previewing,prep:previewPreparing,paused:previewPaused,raf:!!raf,btn:document.getElementById('play-preview').textContent,scene:activeSceneIndex,line:activeLineIndex})"))
results=[]
def check(name,cond,info):
    results.append(bool(cond)); print(("PASS " if cond else "FAIL ")+name,info)
async def sc(page):
    await page.select_option('#preview-scope','full')
    await page.click('#play-preview')
    await asyncio.sleep(1.5)
    s=await state(page)
    check('Run starts playback',s['prev'] and s['raf'] and s['btn']=='⏸ Tạm dừng',s)
    await page.click('#play-preview'); await asyncio.sleep(.35)
    s=await state(page)
    check('Pause works',s['prev'] and s['paused'] and s['btn']=='▶ Tiếp tục',s)
    await page.click('#play-preview'); await asyncio.sleep(.35)
    s=await state(page)
    check('Resume works',s['prev'] and not s['paused'] and s['btn']=='⏸ Tạm dừng',s)
    start=s['line']
    for _ in range(30):
        await asyncio.sleep(.25); s=await state(page)
        if s['line']!=start: break
    check('Timeline advances',s['line']!=start or not s['prev'],s)
    await page.click('#stop-scene'); await asyncio.sleep(.5)
    s=await state(page)
    check('Stop resets playback',not s['prev'] and not s['raf'] and s['btn']=='▶ Chạy',s)
    await page.click('#play-preview'); await asyncio.sleep(1.5)
    s=await state(page)
    check('Run works again after Stop',s['prev'] and s['raf'],s)
    await page.click('#stop-scene')
try:
    asyncio.run(harness.main(sc))
finally:
    bad=[x for x in harness.logs if x[0]=='PAGEERROR']
    print('PAGE ERRORS:',bad[:10])
    print('ALL PASS' if all(results) and not bad else 'SOME FAIL')
sys.exit(0 if results and all(results) and not [x for x in harness.logs if x[0]=='PAGEERROR'] else 1)
