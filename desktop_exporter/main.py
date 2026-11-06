import json
import os
import queue
import subprocess
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from pathlib import Path

try:
    import pyttsx3
    from PIL import Image, ImageDraw, ImageFont
    import imageio_ffmpeg
except ImportError as exc:
    raise SystemExit(f"Thiếu thư viện: {exc}\nHãy chạy: pip install -r requirements.txt")

APP_TITLE = "Visual Novel Offline Video Exporter"
DEFAULT_FPS = 30


def ffmpeg_path():
    return imageio_ffmpeg.get_ffmpeg_exe()


def find_font(size):
    candidates = [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\msyh.ttc",
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size)
            except Exception:
                pass
    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    words = str(text or "").split()
    lines, current = [], ""
    for word in words:
        trial = word if not current else current + " " + word
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def make_dialogue_overlay(text, width, height, output_path):
    scale = width / 1920
    font = find_font(max(24, int(42 * scale)))
    pad_x, pad_y = int(55 * scale), int(28 * scale)
    max_text_width = int(width * 0.88) - pad_x * 2
    temp = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(temp)
    lines = wrap_text(draw, text, font, max_text_width)
    line_h = int(58 * scale)
    box_h = max(int(100 * scale), len(lines) * line_h + pad_y * 2)
    y0 = height - box_h - int(35 * scale)
    x0 = int(width * 0.045)
    x1 = width - x0
    draw.rounded_rectangle((x0, y0, x1, height - int(25 * scale)),
                           radius=int(22 * scale), fill=(5, 8, 17, 155))
    y = y0 + pad_y
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font, stroke_width=max(1, int(2 * scale)))
        tw = bbox[2] - bbox[0]
        x = (width - tw) // 2
        draw.text((x, y), line, font=font, fill="white",
                  stroke_width=max(1, int(2 * scale)), stroke_fill="black")
        y += line_h
    temp.save(output_path)


class OfflineRenderer:
    def __init__(self, progress, log, cancelled):
        self.progress = progress
        self.log = log
        self.cancelled = cancelled
        self.engine = None
        self.voices = []

    def check_cancel(self):
        if self.cancelled():
            raise RuntimeError("Đã hủy xuất video.")

    def init_tts(self):
        self.engine = pyttsx3.init()
        self.voices = self.engine.getProperty("voices") or []
        return self.voices

    def choose_voice(self, text, speaker, voice_map):
        wanted = voice_map.get(speaker, "").lower()
        if wanted:
            for voice in self.voices:
                if voice.id == wanted:
                    return voice.id
        # Ưu tiên tiếng Việt khi văn bản có dấu; nếu không thì dùng voice mặc định.
        if any(ch in text for ch in "ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởợúùủũụứừửữựýỳỷỹỵ"):
            for voice in self.voices:
                desc = (voice.id + " " + voice.name).lower()
                if "vi-vn" in desc or "vietnam" in desc or "an" in desc:
                    return voice.id
        return None

    def make_tts(self, text, speaker, voice_map, rate, output_path):
        if not text.strip():
            return 0.0
        self.engine.setProperty("rate", int(rate))
        voice_id = self.choose_voice(text, speaker, voice_map)
        if voice_id:
            self.engine.setProperty("voice", voice_id)
        self.engine.save_to_file(text, str(output_path))
        self.engine.runAndWait()
        # SAPI save_to_file is synchronous after runAndWait.
        probe = subprocess.run(
            [ffmpeg_path(), "-i", str(output_path), "-f", "null", "-"],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True
        )
        import re
        match = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr)
        if not match:
            return 0.0
        return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3))

    def render(self, json_path, asset_root, output_path, width, height, fps, rate, bgm_volume, sfx_volume):
        data = json.loads(Path(json_path).read_text(encoding="utf-8-sig"))
        scenes = data.get("danh_sach") or data.get("KichBanToanBo") or []
        if not scenes:
            raise ValueError("JSON không có danh_sach hoặc danh sách đang trống.")
        root = Path(asset_root)
        self.init_tts()
        work = Path(output_path).with_suffix("")
        work_dir = work.parent / (work.name + "_render_temp")
        work_dir.mkdir(parents=True, exist_ok=True)
        segments, audio_events, bgm_events = [], [], []
        timeline = 0.0
        current_bgm = ""
        bgm_start = 0.0
        voice_map = {}
        speakers = sorted({str(x.get("nhan_vat", "")).strip() for x in scenes if x.get("nhan_vat")})
        for idx, speaker in enumerate(speakers):
            voice_map[speaker] = ""

        try:
            for i, scene in enumerate(scenes):
                self.check_cancel()
                speaker = str(scene.get("nhan_vat") or "").strip()
                text = str(scene.get("noi_dung") or "")
                bg = str(scene.get("anh_nen") or scene.get("background") or "").strip()
                expression = str(scene.get("bieu_cam") or scene.get("expression") or "").strip()
                vfx = str(scene.get("anh_hieu_ung") or scene.get("vfx") or "").strip()
                bgm = str(scene.get("am_thanh_nen") or scene.get("bgm") or "").strip()
                sfx = str(scene.get("am_thanh_hieu_ung") or scene.get("sfx") or "").strip()
                if bgm and bgm != current_bgm:
                    if current_bgm and timeline > bgm_start:
                        bgm_events.append((root / "assets" / "AmThanh" / "Nen" / current_bgm,
                                           bgm_start, timeline - bgm_start, bgm_volume))
                    current_bgm = bgm
                    bgm_start = timeline
                tts_path = work_dir / f"tts_{i:05d}.wav"
                duration = self.make_tts(text, speaker, voice_map, rate, tts_path) if text else 0
                if text and duration <= 0:
                    duration = max(2.5, len(text) / 12)
                duration = max(1.0, duration + float(data.get("thoi_gian_cho_giua", 0.02)))
                if text and tts_path.exists():
                    audio_events.append((tts_path, timeline, 1.0))
                if sfx:
                    sfx_path = root / "assets" / "AmThanh" / "HieuUng" / sfx
                    if sfx_path.exists():
                        audio_events.append((sfx_path, timeline, sfx_volume))
                bg_path = root / "assets" / "Nen" / bg if bg else None
                char_path = root / "assets" / "NhanVat" / speaker / f"{expression}.webm" if speaker and expression else None
                vfx_path = root / "assets" / "HieuUng" / vfx if vfx else None
                overlay_path = work_dir / f"text_{i:05d}.png"
                if text:
                    make_dialogue_overlay(text, width, height, overlay_path)
                segment_path = work_dir / f"scene_{i:05d}.mp4"
                self.render_scene(bg_path, char_path, vfx_path, overlay_path if text else None,
                                  segment_path, duration, width, height, fps)
                segments.append((segment_path, duration))
                timeline += duration
                self.progress((i + 1) / len(scenes) * 85, f"Đã dựng cảnh {i + 1}/{len(scenes)}")
            if current_bgm and timeline > bgm_start:
                bgm_events.append((root / "assets" / "AmThanh" / "Nen" / current_bgm,
                                   bgm_start, timeline - bgm_start, bgm_volume))
            self.join_segments(segments, work_dir / "video_silent.mp4", fps)
            self.mix_audio(audio_events, bgm_events, timeline, work_dir / "mix.wav")
            self.mux(work_dir / "video_silent.mp4", work_dir / "mix.wav", output_path)
            self.progress(100, f"Hoàn tất: {output_path}")
        finally:
            try:
                self.engine.stop()
            except Exception:
                pass

    def render_scene(self, bg, char, vfx, overlay, output, duration, width, height, fps):
        args = [ffmpeg_path(), "-y", "-hide_banner", "-loglevel", "error"]
        inputs, filters = [], []
        if bg and bg.exists():
            if bg.suffix.lower() in (".mp4", ".webm", ".mov", ".mkv", ".avi"):
                args += ["-stream_loop", "-1", "-i", str(bg)]
            else:
                args += ["-loop", "1", "-t", str(duration), "-i", str(bg)]
        else:
            args += ["-f", "lavfi", "-i", f"color=c=black:s={width}x{height}:r={fps}:d={duration}"]
        inputs.append("0:v")
        filters.append(f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1[base0]")
        current = "base0"
        input_index = 1
        if char and char.exists():
            args += ["-stream_loop", "-1", "-i", str(char)]
            filters.append(f"[{input_index}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,setsar=1[char]")
            filters.append(f"[{current}][char]overlay=(W-w)/2:H-h:shortest=1[base{input_index}]")
            current = f"base{input_index}"
            input_index += 1
        if vfx and vfx.exists():
            args += ["-loop", "1", "-t", str(duration), "-i", str(vfx)]
            filters.append(f"[{input_index}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,setsar=1[vfx]")
            filters.append(f"[{current}][vfx]overlay=(W-w)/2:(H-h)/2[base{input_index}]")
            current = f"base{input_index}"
            input_index += 1
        if overlay and overlay.exists():
            args += ["-loop", "1", "-t", str(duration), "-i", str(overlay)]
            filters.append(f"[{current}][{input_index}:v]overlay=0:0:format=auto[outv]")
            current = "outv"
        else:
            filters.append(f"[{current}]null[outv]")
        args += ["-filter_complex", ";".join(filters), "-map", "[outv]",
                 "-t", str(duration), "-r", str(fps), "-an", "-c:v", "libx264",
                 "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(output)]
        self.run(args)

    def run(self, args):
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr[-2500:] or "FFmpeg gặp lỗi.")

    def join_segments(self, segments, output, fps):
        list_file = output.with_suffix(".txt")
        list_file.write_text("\n".join(f"file '{p.as_posix()}'" for p, _ in segments), encoding="utf-8")
        self.run([ffmpeg_path(), "-y", "-hide_banner", "-loglevel", "error", "-f", "concat",
                  "-safe", "0", "-i", str(list_file), "-c", "copy", str(output)])

    def mix_audio(self, events, bgm_events, total_duration, output):
        args = [ffmpeg_path(), "-y", "-hide_banner", "-loglevel", "error"]
        filters, labels = [], []
        n = 0
        for path, start, volume in events:
            if not Path(path).exists():
                continue
            args += ["-i", str(path)]
            delay = max(0, int(start * 1000))
            filters.append(f"[{n}:a]volume={volume},adelay={delay}|{delay},apad[a{n}]")
            labels.append(f"[a{n}]")
            n += 1
        for path, start, duration, volume in bgm_events:
            if not Path(path).exists():
                continue
            args += ["-stream_loop", "-1", "-i", str(path)]
            delay = max(0, int(start * 1000))
            filters.append(f"[{n}:a]atrim=duration={duration},volume={volume},adelay={delay}|{delay},apad[b{n}]")
            labels.append(f"[b{n}]")
            n += 1
        if not labels:
            args += ["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={total_duration}"]
            args += ["-t", str(total_duration), str(output)]
            self.run(args)
            return
        filters.append("".join(labels) + f"amix=inputs={len(labels)}:duration=longest:normalize=0,atrim=duration={total_duration}[out]")
        args += ["-filter_complex", ";".join(filters), "-map", "[out]", "-t", str(total_duration),
                 "-ar", "44100", "-ac", "2", str(output)]
        self.run(args)

    def mux(self, video, audio, output):
        self.run([ffmpeg_path(), "-y", "-hide_banner", "-loglevel", "error", "-i", str(video),
                  "-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                  "-shortest", "-movflags", "+faststart", str(output)])


class App:
    def __init__(self, root):
        self.root = root
        self.root.title(APP_TITLE)
        self.root.geometry("720x520")
        self.root.minsize(650, 480)
        self.events = queue.Queue()
        self.cancelled = False
        self.json_var = tk.StringVar()
        self.assets_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.orientation = tk.StringVar(value="landscape")
        self.status = tk.StringVar(value="Chọn JSON và thư mục chứa assets để bắt đầu.")
        self.build()
        self.root.after(100, self.poll)

    def build(self):
        frame = ttk.Frame(self.root, padding=18)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Visual Novel → MP4", font=("Segoe UI", 20, "bold")).pack(anchor="w")
        ttk.Label(frame, text="Dựng video offline từ JSON và thư mục tài nguyên của dự án.",
                  foreground="#555").pack(anchor="w", pady=(0, 18))
        self.path_row(frame, "Kịch bản JSON", self.json_var, self.pick_json)
        self.path_row(frame, "Thư mục dự án / assets", self.assets_var, self.pick_assets)
        self.path_row(frame, "Video MP4 xuất ra", self.output_var, self.pick_output)
        opts = ttk.LabelFrame(frame, text="Thiết lập video", padding=12)
        opts.pack(fill="x", pady=12)
        ttk.Radiobutton(opts, text="Ngang 1920 × 1080", variable=self.orientation,
                        value="landscape").pack(side="left", padx=8)
        ttk.Radiobutton(opts, text="Dọc 1080 × 1920", variable=self.orientation,
                        value="portrait").pack(side="left", padx=8)
        ttk.Label(opts, text="FPS: 30").pack(side="right", padx=8)
        self.progress = ttk.Progressbar(frame, maximum=100)
        self.progress.pack(fill="x", pady=(10, 4))
        ttk.Label(frame, textvariable=self.status, wraplength=660).pack(anchor="w")
        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=16)
        self.export_btn = ttk.Button(buttons, text="Bắt đầu xuất video", command=self.start)
        self.export_btn.pack(side="left")
        self.cancel_btn = ttk.Button(buttons, text="Hủy", command=self.cancel, state="disabled")
        self.cancel_btn.pack(side="left", padx=8)
        ttk.Label(frame, text="Lưu ý: giọng đọc dùng Windows SAPI5 đã cài trên máy. FFmpeg được đóng gói qua imageio-ffmpeg.",
                  wraplength=660, foreground="#666").pack(anchor="w", side="bottom")

    def path_row(self, parent, label, variable, command):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=6)
        ttk.Label(row, text=label, width=22).pack(side="left")
        ttk.Entry(row, textvariable=variable).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(row, text="Chọn...", command=command).pack(side="right")

    def pick_json(self):
        p = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if p:
            self.json_var.set(p)
            if not self.assets_var.get():
                self.assets_var.set(str(Path(p).parent))

    def pick_assets(self):
        p = filedialog.askdirectory()
        if p:
            self.assets_var.set(p)

    def pick_output(self):
        p = filedialog.asksaveasfilename(defaultextension=".mp4", filetypes=[("MP4", "*.mp4")])
        if p:
            self.output_var.set(p)

    def start(self):
        if not all((self.json_var.get(), self.assets_var.get(), self.output_var.get())):
            messagebox.showwarning("Thiếu thông tin", "Hãy chọn JSON, thư mục dự án và nơi lưu MP4.")
            return
        self.cancelled = False
        self.export_btn.configure(state="disabled")
        self.cancel_btn.configure(state="normal")
        self.progress["value"] = 0
        width, height = (1920, 1080) if self.orientation.get() == "landscape" else (1080, 1920)
        def worker():
            try:
                renderer = OfflineRenderer(
                    lambda p, m: self.events.put(("progress", p, m)),
                    lambda m: self.events.put(("status", m)),
                    lambda: self.cancelled
                )
                renderer.render(self.json_var.get(), self.assets_var.get(), self.output_var.get(),
                                width, height, DEFAULT_FPS, 180, 0.3, 0.4)
                self.events.put(("done", None, "Xuất video thành công."))
            except Exception as exc:
                self.events.put(("error", None, str(exc)))
        threading.Thread(target=worker, daemon=True).start()

    def cancel(self):
        self.cancelled = True
        self.status.set("Đang yêu cầu hủy...")

    def poll(self):
        try:
            while True:
                kind, value, message = self.events.get_nowait()
                if kind == "progress":
                    self.progress["value"] = value
                    self.status.set(message)
                elif kind == "done":
                    self.finish()
                    messagebox.showinfo("Hoàn tất", message)
                elif kind == "error":
                    self.finish()
                    messagebox.showerror("Không thể xuất video", message)
        except queue.Empty:
            pass
        self.root.after(100, self.poll)

    def finish(self):
        self.export_btn.configure(state="normal")
        self.cancel_btn.configure(state="disabled")


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
