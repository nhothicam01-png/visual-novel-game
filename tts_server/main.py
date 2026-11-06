import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
import edge_tts

app = FastAPI(title="Visual Novel TTS", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

VOICE_BY_LANG = {
    "vi": "vi-VN-HoaiMyNeural",
    "en": "en-US-JennyNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "es": "es-ES-ElviraNeural",
    "pt": "pt-PT-RaquelNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "ar": "ar-SA-ZariyahNeural",
}

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    lang: str = "vi-VN"
    rate: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: float = Field(default=1.0, ge=0.5, le=2.0)

@app.get("/health")
async def health():
    return {"ok": True, "service": "visual-novel-tts"}

@app.post("/tts")
async def create_tts(payload: TTSRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")
    if re.search(r"[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]", text):
        raise HTTPException(status_code=400, detail="Text contains unsupported control characters")

    lang_key = (payload.lang or "vi-VN").split("-")[0].lower()
    voice = VOICE_BY_LANG.get(lang_key, VOICE_BY_LANG["en"])
    rate_pct = round((payload.rate - 1.0) * 100)
    pitch_pct = round((payload.pitch - 1.0) * 20)
    rate = f"{rate_pct:+d}%"
    pitch = f"{pitch_pct:+d}Hz"

    try:
        communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        chunks = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                chunks.append(chunk["data"])
        audio = b"".join(chunks)
        if not audio:
            raise RuntimeError("TTS provider returned empty audio")
        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS generation failed: {exc}") from exc
