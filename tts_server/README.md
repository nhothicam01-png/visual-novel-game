# Visual Novel TTS service

This small API generates MP3 speech with Edge TTS. It runs online, so both phones and computers use the same service; nothing needs to be installed on the user's device.

## Deploy on Render

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** and select this repository.
3. Render detects `tts_server/render.yaml` and creates the web service.
4. After deployment, open `https://YOUR-SERVICE.onrender.com/health`. It should return `{"ok":true,...}`.
5. Copy the service URL into the Visual Novel player's TTS server setting.

## API

`POST /tts`

JSON body:

```json
{
  "text": "Xin chào!",
  "voice": "vi-VN-HoaiMyNeural",
  "rate": 1.1,
  "pitch": 1.0
}
```

Returns an `audio/mpeg` MP3 response.

## Notes

- Edge TTS requires an internet connection and depends on Microsoft's online speech service.
- Free hosting may sleep when idle, so the first request can take longer.
- Do not send private or sensitive text to a third-party TTS service.
