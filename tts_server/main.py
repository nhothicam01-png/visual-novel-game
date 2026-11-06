import io
import re
import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Visual Novel TTS", version="1.0.0")

# GitHub Pages + local development. Add your deployed site origin here if it changes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    voice: str = Field(default="vi-VN-HoaiMyNeural", min_length=3, max_length=100)
    rate: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: float = Field(default=1.0, ge=0.5, le=2.0)

def edge_rate(value: float) -> str:
    # Edge TTS uses percentage strings; 1.0 means normal speed.
    pct = round((value - 1.0) * 100)
    return f"{pct:+d}%"

def edge_pitch(value: float) -> str:
    # Edge TTS pitch is expressed in Hz. Keep the UI's 0.5–2 range subtle.
    hz = round((value - 1.0) * 20)
    return f"{hz:+d}Hz"

@app.get("/health")
async def health():
    return {"ok": True, "service": "visual-novel-tts"}

@app.post("/tts")
async def synthesize(payload: TTSRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nội dung thoại đang trống.")
    if re.search(r"[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]", text):
        raise HTTPException(status_code=400, detail="Nội dung chứa ký tự không hợp lệ.")

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=payload.voice,
            rate=edge_rate(payload.rate),
            pitch=edge_pitch(payload.pitch),
        )
        audio = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.write(chunk["data"])
        if audio.tell() == 0:
            raise RuntimeError("Edge TTS không trả về dữ liệu âm thanh.")
        audio.seek(0)
        return StreamingResponse(
            audio,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Không tạo được MP3: {str(exc)[:300]}")

if __name__ == "__main__":
    import os
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
