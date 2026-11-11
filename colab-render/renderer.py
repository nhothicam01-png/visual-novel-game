#!/usr/bin/env python3
"""Native Colab renderer for Visual Novel editor package v1.
Renders frames in Colab from source assets; it does not consume browser-rendered PNG frames.
"""
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, urllib.request, urllib.parse, zipfile
from pathlib import Path
from typing import Any
import cv2
import av
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path.cwd()
BASE_FALLBACK = "https://raw.githubusercontent.com/nhothicam01-png/visual-novel-game/main/assets/"

def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if p.returncode:
        raise RuntimeError(p.stdout[-5000:])
    return p.stdout

def download(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as response, open(dest, "wb") as f:
        total=int(response.headers.get("Content-Length") or 0)
        done=0
        while True:
            chunk=response.read(1024*1024)
            if not chunk: break
            f.write(chunk); done+=len(chunk)
            if total:
                pct=int(done*100/total)
                print(f"    Tải {dest.name}: {pct}% ({done//1024}/{total//1024} KB)",flush=True)
        if done==0: raise RuntimeError("Tệp tải về rỗng")
    return dest

def load_package(zip_path: Path, work: Path):
    with zipfile.ZipFile(zip_path) as z:
        bad = z.testzip()
        if bad: raise ValueError("ZIP bị lỗi tại: " + bad)
        z.extractall(work)
    timeline_path = work / "timeline.json"
    if not timeline_path.exists(): raise ValueError("Gói ZIP không có timeline.json")
    data = json.loads(timeline_path.read_text(encoding="utf-8"))
    if data.get("kind") != "visual-novel-colab-timeline":
        raise ValueError("Không đúng loại gói render Visual Novel.")
    return data

def asset_url_map(timeline):
    return {a["path"]: a.get("source_url") for a in timeline.get("assets", []) if a.get("path")}

def resolve_asset(rel, urlmap, work):
    if not rel: return None
    rel = str(rel).lstrip("/")
    local = work / rel
    if local.exists(): return local
    url = urlmap.get(rel) or (BASE_FALLBACK + urllib.parse.quote(rel, safe="/"))
    url = urllib.parse.quote(url, safe=":/%")
    try: return download(url, local)
    except Exception as e:
        print(f"⚠ Không tải được tài nguyên {rel}: {e}",flush=True)
        return None

def cover_image(src: Image.Image, size):
    w,h=size; sw,sh=src.size
    scale=max(w/sw,h/sh); nw,nh=round(sw*scale),round(sh*scale)
    src=src.resize((nw,nh),Image.Resampling.LANCZOS)
    x=(nw-w)//2; y=(nh-h)//2
    return src.crop((x,y,x+w,y+h))

def character_image(src: Image.Image, size, portrait=False):
    w,h=size; sw,sh=src.size
    scale=(h/sh) if portrait else min(w/sw,h/sh)
    nw,nh=round(sw*scale),round(sh*scale)
    src=src.resize((nw,nh),Image.Resampling.LANCZOS)
    out=Image.new("RGBA",(w,h),(0,0,0,0))
    out.alpha_composite(src.convert("RGBA"),((w-nw)//2,h-nh))
    return out

def font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p,size)
    return ImageFont.load_default()

def wrap_text(draw, text, fnt, max_width):
    words=str(text or "").split()
    lines=[]; line=""
    for word in words:
        test=(line+" "+word).strip()
        if line and draw.textbbox((0,0),test,font=fnt)[2] > max_width:
            lines.append(line); line=word
        else: line=test
    if line: lines.append(line)
    return lines or [""]

def dialogue_layer(frame, interval, global_cfg, visual):
    if not global_cfg.get("show_dialogue", True): return frame
    text=str(interval.get("text") or "").strip()
    if not text: return frame
    w,h=frame.size
    pad=max(12,int(w*.018)); fs=max(24,round(w*.022))
    f=font(fs); name=str(interval.get("speaker") or "").strip()
    maxw=int(w*.88 if visual.get("dialogueMode")=="fit" else w*float(visual.get("dialogueWidth",75) or 75)/100)
    dummy=ImageDraw.Draw(frame)
    lines=wrap_text(dummy,text,f,maxw-pad*2)
    line_h=int(fs*1.28)
    name_on=bool(global_cfg.get("show_speaker",True) and name)
    nf=font(round(fs*.75))
    boxw=maxw
    if visual.get("dialogueMode")=="fit":
        measured=max([dummy.textbbox((0,0),x,font=f)[2] for x in lines] or [0])
        boxw=min(int(w*.92),measured+pad*2)
    name_h=round(fs*1.05) if name_on else 0
    boxh=int(pad*.84+name_h+len(lines)*line_h)
    x=(w-boxw)//2; y=h-boxh-int(h*.025)
    overlay=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(overlay)
    rad=max(12,int(w*.009))
    d.rounded_rectangle((x,y,x+boxw,y+boxh),radius=rad,fill=(5,8,17,184))
    ty=y+int(pad*.42)
    if name_on:
        bb=d.textbbox((0,0),name,font=nf); d.text((w/2-(bb[2]-bb[0])/2,ty),name,font=nf,fill=(196,181,253,255))
    ty+=name_h
    for line in lines:
        bb=d.textbbox((0,0),line,font=f)
        d.text((w/2-(bb[2]-bb[0])/2,ty),line,font=f,fill=(255,255,255,255),stroke_width=1,stroke_fill=(0,0,0,150))
        ty+=line_h
    return Image.alpha_composite(frame.convert("RGBA"),overlay).convert("RGB")

def effect_ids(interval):
    vals=interval.get("effect_settings") or []
    out={"bg":[],"char":[],"camera":[],"atm":[]}
    for value in vals:
        if not isinstance(value,str) or ":" not in value: continue
        group,key=value.split(":",1)
        if group in out: out[group].append(key)
    return out

def apply_visual_effects(frame, bg, char, elapsed, interval, strength):
    w,h=frame.size; ids=effect_ids(interval)
    # Background motion / blur
    if bg is not None:
        z=1.0; dx=dy=0
        if "bg-zoom" in ids["bg"]: z+=np.sin(elapsed*1.2)*.035*strength
        if "bg-left" in ids["bg"]: dx-=np.sin(elapsed*.8)*w*.025*strength
        if "bg-right" in ids["bg"]: dx+=np.sin(elapsed*.8)*w*.025*strength
        if "bg-float" in ids["bg"]:
            z+=.035*strength; dx+=np.sin(elapsed*.45)*w*.012*strength; dy+=np.cos(elapsed*.38)*h*.009*strength
        if "bg-pulse" in ids["bg"]: z+=np.sin(elapsed*2)*.012*strength
        if abs(z-1)>1e-4 or dx or dy:
            nw,nh=round(w*z),round(h*z); bg=bg.resize((nw,nh),Image.Resampling.BICUBIC)
            canvas=Image.new("RGB",(w,h),(0,0,0)); canvas.paste(bg,((w-nw)//2+int(dx),(h-nh)//2+int(dy))); bg=canvas
        if "bg-blur" in ids["bg"]: bg=bg.filter(ImageFilter.GaussianBlur(max(1,round(2*strength))))
        frame=Image.alpha_composite(frame.convert("RGBA"),bg.convert("RGBA"))
    if char is not None:
        # Character movement uses the same scene-local clock as the browser renderer.
        dx=dy=0; angle=0; scale=1.0; alpha=255
        if "char-bob" in ids["char"]: dy+=np.sin(elapsed*5)*h*.008*strength
        if "char-sway" in ids["char"]: angle=np.sin(elapsed*1.8)*1.03*strength
        if "char-shake" in ids["char"] and elapsed<2: dx+=np.sin(elapsed*42)*w*.009*strength
        if "char-zoom" in ids["char"] or "char-breathe" in ids["char"]:
            scale+=np.sin(elapsed*(1.6 if "char-breathe" in ids["char"] else 2.2))*(.012 if "char-breathe" in ids["char"] else .018)*strength
        if "char-float" in ids["char"]:
            dx+=np.sin(elapsed*1.15)*w*.012*strength; dy+=np.sin(elapsed*1.7)*h*.006*strength
        if "char-enter" in ids["char"]: dy+=(1-min(1,elapsed/1.1))*h*.22
        if "char-fade" in ids["char"]: alpha=round(255*min(1,elapsed/1.4))
        if scale!=1:
            char=char.resize((max(1,round(w*scale)),max(1,round(h*scale))),Image.Resampling.BICUBIC)
            c=Image.new("RGBA",(w,h),(0,0,0,0)); c.alpha_composite(char,((w-char.width)//2,int(h-char.height+dy))); char=c
        if abs(angle)>.01: char=char.rotate(angle,resample=Image.Resampling.BICUBIC,center=(w//2,h))
        if alpha<255: char.putalpha(char.getchannel("A").point(lambda x:int(x*alpha/255)))
        layer=Image.new("RGBA",(w,h),(0,0,0,0)); layer.alpha_composite(char,(int(dx),int(dy)))
        frame=Image.alpha_composite(frame.convert("RGBA"),layer)
    # Atmosphere overlays: deterministic particle positions follow the browser renderer clock.
    atm=ids["atm"]
    if atm:
        overlay=Image.new("RGBA",(w,h),(0,0,0,0)); ad=ImageDraw.Draw(overlay)
        if "rays" in atm:
            ad.polygon([(int(w*.12),0),(int(w*.48),0),(int(w*.78),h),(int(w*.42),h)],fill=(255,244,190,round(18*strength)))
        if any(x in atm for x in ("snow","rain","petals","dust","sparkle")):
            count=95 if "rain" in atm else (65 if "snow" in atm else 42)
            for i in range(count):
                seed=i*127.1
                x=int(((seed*np.sin(i+2)*.5+.5)*w+np.sin(elapsed*.8+i)*w*.025+w*2)%w)
                y=int(((i/count*h+elapsed*(h*1.25 if "rain" in atm else h*.16))%h))
                if "rain" in atm:
                    ad.line((x,y,x-int(w*.008),y+int(h*.035)),fill=(190,220,255,122),width=max(1,round(w*.0008)))
                elif "petals" in atm:
                    rr=max(2,round(w*.004))
                    ad.ellipse((x-rr,y-rr*2,x+rr,y+rr*2),fill=(255,160,195,184))
                else:
                    rr=max(1,round(w*(.0025 if "snow" in atm else .0015)))
                    color=(255,255,255,199) if "snow" in atm else (255,235,170,166)
                    ad.ellipse((x-rr,y-rr,x+rr,y+rr),fill=color)
        if "sparkle" in atm:
            for i in range(18):
                x=int((i*7919%997)/997*w); y=int((i*3571%991)/991*h)
                alpha=round(64+166*abs(np.sin(elapsed*2+i)))
                rr=max(1,round(w*.002))
                ad.rectangle((x,y,x+rr,y+rr),fill=(255,247,204,alpha))
        if "fog" in atm:
            fog=Image.new("RGBA",(w,h),(210,220,235,0))
            alpha=np.zeros((h,w),dtype=np.uint8)
            y0=int(h*.55)
            alpha[y0:,:]=np.linspace(0,255*.16*strength,h-y0,dtype=np.uint8)[:,None]
            fog.putalpha(Image.fromarray(alpha))
            overlay=Image.alpha_composite(overlay,fog)
        if "vignette" in atm:
            yy,xx=np.mgrid[0:h:1,0:w:1]
            dist=np.sqrt(((xx-w/2)/(max(w,h)*.72))**2+((yy-h/2)/(max(w,h)*.72))**2)
            alpha=np.clip((dist-.22)*.55*strength/.50,0,.55*strength)
            vig=Image.new("RGBA",(w,h),(0,0,0,0))
            vig.putalpha(Image.fromarray(np.uint8(alpha*255)))
            overlay=Image.alpha_composite(overlay,vig)
        if "lightning" in atm and np.sin(elapsed*2.7)>.985:
            overlay=Image.alpha_composite(overlay,Image.new("RGBA",(w,h),(220,235,255,107)))
        if "flash" in atm and np.sin(elapsed*1.4)>.995:
            overlay=Image.alpha_composite(overlay,Image.new("RGBA",(w,h),(255,255,255,166)))
        frame=Image.alpha_composite(frame.convert("RGBA"),overlay)
    # Camera motion is intentionally applied to the combined visual layer.
    cam=ids["camera"]; zoom=1.; dx=dy=0
    if "camera-shake" in cam and elapsed<1.5:
        dx=np.sin(elapsed*55)*w*.008*strength; dy=np.cos(elapsed*48)*h*.008*strength
    if "camera-zoom" in cam: zoom*=1+min(.10,np.sin(min(elapsed/2,1)*np.pi)*.10*strength)
    if "camera-pull" in cam: zoom*=1-min(.08,np.sin(min(elapsed/2,1)*np.pi)*.08*strength)
    if "camera-drift" in cam:
        dx+=np.sin(elapsed*.55)*w*.012*strength; dy+=np.cos(elapsed*.4)*h*.008*strength
    if zoom!=1 or dx or dy:
        nw,nh=round(w*zoom),round(h*zoom); tmp=frame.resize((nw,nh),Image.Resampling.BICUBIC)
        out=Image.new("RGBA",(w,h),(0,0,0,255)); out.alpha_composite(tmp,((w-nw)//2+int(dx),(h-nh)//2+int(dy))); frame=out
    return frame.convert("RGB")

class VideoAsset:
    """PyAV decoder keeps RGBA alpha for transparent character WebM clips."""
    def __init__(self,path):
        self.path=str(path)
        self.container=av.open(self.path)
        self.stream=self.container.streams.video[0]
        self.fps=float(self.stream.average_rate or 30)
        self.frames=int(self.stream.frames or 0)
        tb=float(self.stream.time_base)
        self.duration=(float(self.stream.duration)*tb) if self.stream.duration else max(.001,self.frames/self.fps if self.frames else 1)
        self.last_index=-1
        self.last_image=None
        self.iterator=None
    def _seek(self,index):
        timestamp=int((index/self.fps)/float(self.stream.time_base))
        self.container.seek(max(0,timestamp),stream=self.stream,backward=True,any_frame=False)
        self.iterator=iter(self.container.decode(self.stream))
        self.last_index=-1
        self.last_image=None
    def frame(self,t):
        index=max(0,int((float(t)%self.duration)*self.fps))
        if self.iterator is None or index<self.last_index or index>self.last_index+4:
            self._seek(index)
        if index==self.last_index and self.last_image is not None:
            return self.last_image
        chosen=None
        try:
            while self.last_index<index:
                fr=next(self.iterator)
                frame_index=int(round(float(fr.pts or 0)*float(self.stream.time_base)*self.fps))
                self.last_index=frame_index
                chosen=fr
            if chosen is not None:
                self.last_image=chosen.to_image().convert("RGBA")
            return self.last_image
        except StopIteration:
            self._seek(0)
            try:
                fr=next(self.iterator)
                self.last_index=int(round(float(fr.pts or 0)*float(self.stream.time_base)*self.fps))
                self.last_image=fr.to_image().convert("RGBA")
                return self.last_image
            except StopIteration:
                return self.last_image
    def close(self):
        self.container.close()

def render_video(timeline, work: Path, output: Path):
    width=int(timeline["video"]["width"]); height=int(timeline["video"]["height"])
    fps=int(timeline["video"]["fps"]); duration=float(timeline["duration"])
    portrait=bool(timeline["video"].get("portrait"))
    total_frames=int(np.ceil(duration*fps))
    urlmap=asset_url_map(timeline)
    image_cache={}; video_cache={}
    def get_bg(rel):
        if not rel:return None
        path=resolve_asset("Nen/"+str(rel),urlmap,work)
        if not path:return None
        if str(rel).lower().endswith((".mp4",".webm")):
            if str(path) not in video_cache: video_cache[str(path)]=VideoAsset(path)
            return video_cache[str(path)]
        if str(path) not in image_cache:
            image_cache[str(path)]=cover_image(Image.open(path).convert("RGB"),(width,height))
        return image_cache[str(path)]
    def get_char(rel,expr):
        if not rel or not expr:return None
        path=resolve_asset(f"NhanVat/{rel}/{expr}.webm",urlmap,work)
        if not path:return None
        if str(path) not in video_cache: video_cache[str(path)]=VideoAsset(path)
        return video_cache[str(path)]
    scenes=timeline.get("scenes",[])
    intervals=[]
    for scene in scenes:
        for it in scene.get("intervals",[]):
            intervals.append((float(it.get("start",0)),float(it.get("end",0)),scene,it))
    intervals.sort(key=lambda x:x[0])
    # Preload unique referenced media with visible progress.
    preload=[]
    seen=set()
    for _,_,_,it in intervals:
        bg=it.get("background")
        ch=it.get("character_asset")
        ex=it.get("expression")
        for key,kind in [(( "bg",str(bg)), "background") if bg else (None,None),
                         (( "char",str(ch),str(ex)), "character") if ch and ex else (None,None)]:
            if key and key not in seen:
                seen.add(key); preload.append((kind,it))
    print(f"📦 Chuẩn bị {len(preload)} tài nguyên hình ảnh/video…",flush=True)
    for idx,(kind,it) in enumerate(preload,1):
        print(f"  [{idx}/{len(preload)}] Đang tải/đọc {kind}…",flush=True)
        if kind=="background": get_bg(it.get("background"))
        else: get_char(it.get("character_asset"),it.get("expression"))
    print("✅ Chuẩn bị tài nguyên xong.",flush=True)
    silent=[]
    for sc in scenes:
        if sc.get("silent_duration"): silent.append((sc.get("silent_start",0),sc.get("silent_start",0)+sc["silent_duration"]))
    tmp_video=work/"video_no_audio.mp4"
    fourcc=cv2.VideoWriter_fourcc(*"mp4v")
    writer=cv2.VideoWriter(str(tmp_video),fourcc,fps,(width,height))
    if not writer.isOpened(): raise RuntimeError("Không khởi tạo được MP4 writer.")
    print(f"🎞️ Bắt đầu render: {total_frames:,} khung hình · {fps} FPS · {width}×{height} · {duration:.1f}s",flush=True)
    current_idx=0
    for fi in range(total_frames):
        t=fi/fps
        while current_idx+1<len(intervals) and intervals[current_idx][1]<=t: current_idx+=1
        active=None
        if intervals and intervals[current_idx][0]<=t<intervals[current_idx][1]: active=intervals[current_idx]
        base=Image.new("RGBA",(width,height),(0,0,0,255))
        ch=None
        if active:
            start,end,scene,it=active
            local=t-float(scene.get("start",start))
            bgsrc=get_bg(it.get("background"))
            if isinstance(bgsrc,VideoAsset):
                bgframe=bgsrc.frame(local)
                bg=cover_image(bgframe.convert("RGB"),(width,height)) if bgframe else None
            else: bg=bgsrc
            if bg: base=Image.alpha_composite(base,bg.convert("RGBA"))
            csrc=get_char(it.get("character_asset"),it.get("expression"))
            if csrc:
                cf=csrc.frame(local)
                if cf:
                    ch=character_image(cf,(width,height),portrait)
                    base=Image.alpha_composite(base,ch)
            strength=float(it.get("effect_strength",50))/50
            base=apply_visual_effects(Image.new("RGBA",(width,height),(0,0,0,255)),bg,ch,local,it,strength) if (bg is not None or ch is not None) else base.convert("RGB")
            base=dialogue_layer(base.convert("RGB"),it,timeline.get("global",{}),it.get("scene_visual") or {})
        frame=cv2.cvtColor(np.asarray(base.convert("RGB")),cv2.COLOR_RGB2BGR)
        writer.write(frame)
        if (fi+1)%max(1,fps*2)==0 or fi+1==total_frames: print(f"  🎬 {fi+1:,}/{total_frames:,} khung hình ({(fi+1)/total_frames*100:.1f}%)",flush=True)
    writer.release()
    for v in video_cache.values(): v.close()
    if not shutil.which("ffmpeg"): raise RuntimeError("Không tìm thấy FFmpeg.")
    mix_audio(timeline,work,tmp_video,output)
    print("✅ Render xong:",output,flush=True)
    return output

def mix_audio(timeline,work,video_path,output):
    events=timeline.get("audio",{}).get("events",[])
    mix=timeline.get("audio",{}).get("mix",{})
    duration=float(timeline.get("duration",0))
    cmd=["ffmpeg","-y","-i",str(video_path)]
    chains=[]; labels=[]; input_index=1
    tts_dir=work/"tts"
    asset_map=asset_url_map(timeline)
    for ev in events:
        typ=ev.get("type")
        if typ=="dialogue":
            p=work/str(next((x.get("path") for x in timeline.get("tts_assets",[]) if x.get("id")==ev.get("asset_id")),""))
            vol=float(mix.get("tts",1))*float(ev.get("gain",1))
            start=float(ev.get("start",0)); dur=float(ev.get("duration",0))
        elif typ in ("bgm","sfx"):
            rel=ev.get("file")
            if not rel: continue
            folder="Nen/" if typ=="bgm" else "HieuUng/"
            p=resolve_asset("AmThanh/"+folder+str(rel),asset_map,work)
            vol=float(mix.get("bgm" if typ=="bgm" else "sfx",1))
            start=float(ev.get("start",0))
            dur=max(0,float(ev.get("end",duration))-start) if typ=="bgm" else duration-start
        else: continue
        if not p or not Path(p).exists() or dur<=0: continue
        if typ=="bgm": cmd += ["-stream_loop","-1","-i",str(p)]
        else: cmd += ["-i",str(p)]
        label=f"a{input_index}"
        delay=max(0,round(start*1000))
        chains.append(f"[{input_index}:a]aformat=channel_layouts=stereo,aresample=48000,atrim=duration={dur:.4f},asetpts=PTS-STARTPTS,volume={vol:.4f},adelay={delay}|{delay}[{label}]")
        labels.append(f"[{label}]"); input_index+=1
    if labels:
        chains.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0,apad,atrim=duration={duration:.4f}[mix]")
        graph=";".join(chains)
        cmd += ["-filter_complex",graph,"-map","0:v:0","-map","[mix]","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-t",str(duration),str(output)]
    else:
        cmd += ["-f","lavfi","-i",f"anullsrc=r=48000:cl=stereo","-map","0:v:0","-map",f"{input_index}:a:0","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-t",str(duration),str(output)]
    run(cmd)

def srt_time(seconds):
    ms=max(0,int(round(float(seconds)*1000)))
    hh,ms=divmod(ms,3600000); mm,ms=divmod(ms,60000); ss,ms=divmod(ms,1000)
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"

def write_sidecar_files(timeline, output):
    intervals=[]
    for scene in timeline.get("scenes", []):
        for item in scene.get("intervals", []):
            text=str(item.get("text") or "").strip()
            if text:
                start=float(item.get("start", 0))
                end=min(float(timeline.get("duration", start)), start+float(item.get("duration", 0)))
                intervals.append((start,end,str(item.get("speaker") or "").strip(),text))
    intervals.sort(key=lambda x:x[0])
    srt_lines=[]
    for idx,(start,end,speaker,text) in enumerate(intervals,1):
        caption=(speaker+"\n" if speaker and timeline.get("global",{}).get("show_speaker",True) else "")+text
        srt_lines.extend([str(idx),srt_time(start)+" --> "+srt_time(end),caption,""])
    srt_path=output.with_suffix(".srt")
    srt_path.write_text("\n".join(srt_lines),encoding="utf-8")

    audio_path=output.with_name(output.stem+"_audio_manifest.json")
    audio_manifest={
        "schema_version":1,
        "kind":"visual-novel-audio-manifest",
        "video":output.name,
        "duration":timeline.get("duration",0),
        "mix":timeline.get("audio",{}).get("mix",{}),
        "tts_assets":timeline.get("tts_assets",[]),
        "events":timeline.get("audio",{}).get("events",[])
    }
    audio_path.write_text(json.dumps(audio_manifest,ensure_ascii=False,indent=2),encoding="utf-8")

    metadata_path=output.with_name(output.stem+"_metadata.json")
    metadata={
        "schema_version":1,
        "kind":"visual-novel-render-metadata",
        "story":timeline.get("story",{}),
        "created_at":timeline.get("created_at"),
        "rendered_at":__import__("datetime").datetime.now().astimezone().isoformat(),
        "video":{**timeline.get("video",{}),"duration":timeline.get("duration",0),"frames":int(round(float(timeline.get("duration",0))*int(timeline.get("video",{}).get("fps",30))))},
        "scene_count":len(timeline.get("scenes",[])),
        "dialogue_count":len(intervals),
        "asset_count":len(timeline.get("assets",[])),
        "files":{"video":output.name,"subtitles":srt_path.name,"audio_manifest":audio_path.name}
    }
    metadata_path.write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
    print("📄 Phụ đề:",srt_path)
    print("🔊 Audio manifest:",audio_path)
    print("🧾 Metadata:",metadata_path)
    return [srt_path,audio_path,metadata_path]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--zip",required=True,help="Đường dẫn ZIP xuất từ phòng_video.html")
    ap.add_argument("--output",default="video_colab.mp4")
    ap.add_argument("--work",default="/content/colab_render_work")
    args=ap.parse_args()
    work=Path(args.work); work.mkdir(parents=True,exist_ok=True)
    timeline=load_package(Path(args.zip),work)
    out=Path(args.output)
    render_video(timeline,work,out)
    write_sidecar_files(timeline,out)

if __name__=="__main__":
    main()
