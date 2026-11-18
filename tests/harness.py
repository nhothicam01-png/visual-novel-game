import asyncio, json, os, sys, subprocess, urllib.parse, mimetypes, time
from playwright.async_api import async_playwright
REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME=os.environ.get('CHROME','/usr/bin/google-chrome')
STORY=os.environ.get('STORY','assets/KichBan/TestHieuUngSamSetDiaChanVetNutThoiKhong/TestHieuUngSamSetDiaChanVetNutThoiKhong.json')
RAW='https://raw.githubusercontent.com/nhothicam01-png/visual-novel-game/main/'
BPS=float(os.environ.get('BPS','0'))  # bytes/sec throttle for raw files, 0 = none
files=subprocess.check_output(['git','-c','core.quotepath=false','-C',REPO,'ls-files'],text=True).splitlines()
tree={'tree':[{'path':f,'type':'blob'} for f in files]}
story=json.load(open(os.path.join(REPO,STORY)))
logs=[]
async def main(scenario):
    server=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=REPO,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        await _run(scenario)
    finally:
        server.terminate()
async def _run(scenario):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        ctx=await b.new_context(viewport={'width':412,'height':915},has_touch=True,is_mobile=True)
        await ctx.add_init_script("localStorage.setItem('vns.cinematic.pending.v1',%s)"%json.dumps(json.dumps({'data':story,'name':'Test'})))
        page=await ctx.new_page()
        page.on('console',lambda m:logs.append(('console.'+m.type,m.text[:300])))
        page.on('pageerror',lambda e:logs.append(('PAGEERROR',str(e)[:300])))
        async def route(r):
            u=r.request.url
            if u.startswith(RAW):
                rel=urllib.parse.unquote(u[len(RAW):].split('?')[0]); fp=os.path.join(REPO,rel)
                if os.path.isfile(fp):
                    data=open(fp,'rb').read()
                    if BPS and rel.startswith('assets/HieuUng/'): await asyncio.sleep(len(data)/BPS)
                    ct=mimetypes.guess_type(fp)[0] or 'application/octet-stream'
                    return await r.fulfill(status=200,body=data,headers={'content-type':ct,'access-control-allow-origin':'*'})
                return await r.fulfill(status=404,body='',headers={'access-control-allow-origin':'*'})
            if u.startswith('https://api.github.com/'):
                return await r.fulfill(status=200,body=json.dumps(tree),headers={'content-type':'application/json','access-control-allow-origin':'*'})
            if u.split('?')[0]=='http://127.0.0.1:8765/phong_video.html':
                html=open(os.environ.get('PAGE',os.path.join(REPO,'phong_video.html')),encoding='utf-8').read()
                marker='\n})();\n</script>\n<script src="./github-manager.js">'
                assert marker in html, 'marker missing'
                html=html.replace(marker,'\nwindow.__dbg=c=>eval(c);\n})();\n</script>\n<script src="./github-manager.js">',1)
                return await r.fulfill(status=200,body=html,headers={'content-type':'text/html; charset=utf-8'})
            if u.startswith('http://127.0.0.1:8765/'):
                return await r.continue_()
            return await r.abort()
        await ctx.route('**/*',route)
        await page.goto('http://127.0.0.1:8765/phong_video.html?cinematic=1')
        await page.wait_for_function("window.__dbg&&window.__dbg('activeStoryName')==='Test'&&window.__dbg('scenes.length')>1",timeout=120000)
        await scenario(page)
        await b.close()
