# Colab Render Engine — Package Contract v1 (design baseline)

Status: contract/design baseline only. The browser renderer remains the production renderer until the Python engine passes parity tests.

## Goals
- Render from original project assets and timeline data in Colab; never upload browser-rendered PNG frame sequences.
- Keep the existing browser Canvas + Mediabunny renderer unchanged and selectable as fallback.
- Produce MP4 with deterministic frame timing and a synchronized audio mix.
- Make long renders resumable by rendering short segments and persisting checkpoints to Google Drive.

## Proposed package
A ZIP named `colab_render_package.zip` containing:

```
manifest.json
timeline.json
render_config.json
audio/
  dialogue/...
  bgm/...
  sfx/...
```

Backgrounds and character clips already present in the repository are referenced by repository-relative paths in manifest.json and downloaded by Colab. Only generated/local audio blobs and files not present in the repository need to be included in the ZIP.

### render_config.json
```json
{
  "schema_version": 1,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "quality": "high",
  "video_codec": "h264",
  "audio_codec": "aac",
  "audio_sample_rate": 48000
}
```

### manifest.json
```json
{
  "schema_version": 1,
  "kind": "visual-novel-colab-render",
  "repository": "nhothicam01-png/visual-novel-game",
  "asset_base": "assets/",
  "assets": [
    {
      "id": "background_001",
      "kind": "background",
      "path": "assets/Nen/example.png",
      "sha256": null,
      "included_in_zip": false
    }
  ]
}
```

### timeline.json
The final exporter must serialize the actual prepared render timeline, not merely the editable scene list. Every frame-relevant value must be explicit and independent of current DOM state:
- ordered scene/line segments with exact start, end, duration and pause;
- background and character asset paths, including video-vs-image type;
- expression/character folder resolution already used by the browser;
- per-line and per-scene visual overrides;
- resolved effect IDs and strength, plus dialogue/speaker visibility and width settings;
- dialogue text, speaker, subtitle timing and audio event IDs;
- BGM/SFX event start/end, loop, gain and override/off behavior;
- output canvas size, FPS and aspect ratio.

All timestamps use seconds as floating-point values, rounded only for serialization to 1/10000 second. Frame index is authoritative at render time: `frame_index / fps`.

## Python renderer parity checklist
The browser's drawFrame currently includes:
- camera shake, zoom, pull and drift;
- cover-fit backgrounds with independent zoom/left/right/float/pulse/blur;
- bottom-aligned character clips with bob/sway/shake/zoom/breathe/float/enter/fade;
- atmosphere: rays, snow, rain, petals, dust, sparkle, fog, lightning, flash and vignette;
- dialogue box, optional speaker label, wrapping, rounded background and shadow;
- still images and video assets, with source-time seeking;
- audio mix with dialogue, BGM loops, SFX, volume and exact offsets.

Python implementation should use Pillow/NumPy for deterministic compositing/effects, OpenCV or FFmpeg for video frame decoding, and FFmpeg for final video/audio muxing. Fonts must be bundled or selected explicitly to avoid Colab font differences.

## Rendering strategy
1. Validate package schema, required assets, dimensions, FPS and timeline monotonicity.
2. Resolve repository assets and verify hashes when provided.
3. Render fixed-duration chunks (initial target: 5–10 seconds) to temporary lossless segments.
4. Persist completed chunks and a checkpoint manifest to Drive.
5. Concatenate chunks in order and mux the audio mix once, preserving exact offsets.
6. Verify output duration, frame count, audio stream and MP4 readability before exposing the download.

## Safety and compatibility
- Do not modify or remove the current browser renderer while developing this engine.
- Do not silently skip missing assets or unknown effect IDs; report the exact path/ID and stop or require an explicit fallback.
- Do not claim pixel parity until the same test timeline has been rendered by both engines and compared.
- Colab GPU is optional. CPU rendering must remain possible; runtime/GPU availability and session duration are not guaranteed.
- No GitHub token or private credential may be embedded in the notebook or exported package.

## Current known browser implementation
- Preview/export drawing is centralized in `drawFrame(elapsed, st)`.
- The export loop renders each frame and sends it to Mediabunny CanvasSource.
- Audio is prepared/mixed separately before the final MP4 is finalized.
- Scene capture currently stores character, expression, background and dialogue width/portrait values; the final package must include additional global and per-line state required by the prepared render.
