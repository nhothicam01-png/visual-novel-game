#!/usr/bin/env python3
"""Native Colab renderer for Visual Novel editor package v1.
Renders frames in Colab from source assets; it does not consume browser-rendered PNG frames.
"""
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, urllib.request, urllib.parse, zipfile
from pathlib import Path
from typing import Any
import cv2
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
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
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
    try: return download(url, local)
    except Exception as e:
        print(f"⚠ Không tải được tài nguyên {rel}: {e}")
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
    def __init__(self,path):
        self.cap=cv2.VideoCapture(str(path))
        if not self.cap.isOpened(): raise RuntimeError("Không mở được video: "+str(path))
        self.fps=self.cap.get(cv2.CAP_PROP_FPS) or 30
        self.frames=self.cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1
        self.duration=max(.001,self.frames/self.fps)
    def frame(self,t):
        t=float(t)%self.duration
        self.cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
        ok,bgr=self.cap.read()
        if not ok:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES,0); ok,bgr=self.cap.read()
        if not ok: return None
        return Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGBA))
    def close(self): self.cap.release()

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
    # Preload referenced media once.
    for _,_,_,it in intervals:
        get_bg(it.get("background")); get_char(it.get("character_asset"),it.get("expression"))
    silent=[]
    for sc in scenes:
        if sc.get("silent_duration"): silent.append((sc.get("silent_start",0),sc.get("silent_start",0)+sc["silent_duration"]))
    tmp_video=work/"video_no_audio.mp4"
    fourcc=cv2.VideoWriter_fourcc(*"mp4v")
    writer=cv2.VideoWriter(str(tmp_video),fourcc,fps,(width,height))
    if not writer.isOpened(): raise RuntimeError("Không khởi tạo được MP4 writer.")
    print(f"🎞️ Bắt đầu render: {total_frames:,} khung hình · {fps} FPS · {width}×{height} · {duration:.1f}s")
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
            local=t-start
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
        if (fi+1)%max(1,fps*10)==0: print(f"  {fi+1:,}/{total_frames:,} khung hình ({(fi+1)/total_frames*100:.1f}%)")
    writer.release()
    for v in video_cache.values(): v.close()
    if not shutil.which("ffmpeg"): raise RuntimeError("Không tìm thấy FFmpeg.")
    mix_audio(timeline,work,tmp_video,output)
    print("✅ Render xong:",output)
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
        chains.append(f"[{input_index}:a]aresample=48000,atrim=duration={dur:.4f},asetpts=PTS-STARTPTS,volume={vol:.4f},adelay={delay}|{delay}[{label}]")
        labels.append(f"[{label}]"); input_index+=1
    if labels:
        chains.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:dropout_transition=0,apad,atrim=duration={duration:.4f}[mix]")
        graph=";".join(chains)
        cmd += ["-filter_complex",graph,"-map","0:v:0","-map","[mix]","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-t",str(duration),str(output)]
    else:
        cmd += ["-f","lavfi","-i",f"anullsrc=r=48000:cl=stereo","-map","0:v:0","-map",f"{input_index}:a:0","-c:v","copy","-c:a","aac","-t",str(duration),str(output)]
    run(cmd)

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

if __name__=="__main__":
    main()
