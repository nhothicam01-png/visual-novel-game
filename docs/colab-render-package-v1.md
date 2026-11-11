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


## Findings verified in `phong_video.html` (2026-11-11)

The current browser export timeline is built inside `exportVideo()` after TTS blobs have been prepared and decoded. Its timing rules are:

- Each non-empty dialogue line becomes an entry with `start`, decoded WAV `duration`, `pause`, `gain`, `sceneIndex`, and a reference to its source line.
- The next line starts at the previous line's `start + duration + pause`.
- A scene with no non-empty dialogue receives a 3-second silent interval.
- Final duration is rounded up to a whole output frame: `ceil(totalDuration * fps) / fps`.
- The browser renderer uses the selected FPS and either 1280x720 / 1920x1080, swapped for portrait output.

The actual visual state is not just `scene.visual`. At render time the browser applies:

1. Scene-level visual selection (`character`, `expression`, `background`, dialogue width mode and width).
2. Per-line character/background overrides from `sourceFrame` when present.
3. Per-line effects from `effectSettings` and `effectStrength`.
4. Global dialogue visibility and speaker-name visibility.
5. Video backgrounds and character clips, sampled as looping clips at the scene-local elapsed time.

The browser draws dialogue once per line into a cached dialogue layer. The dialogue box uses the current line's text/speaker, global visibility toggles, and the scene's dialogue width settings.

### Audio timing verified

The browser mixes:
- TTS at each dialogue entry's `start`, multiplied by global TTS volume and per-entry gain.
- SFX at the dialogue entry's `start`, with global SFX volume.
- BGM as looping segments. A segment continues while consecutive lines resolve to the same BGM; it ends when the selected BGM changes.
- Audio output is stereo AAC, currently 48 kHz where supported by the browser AudioContext, at 160 kbps.

The package exporter must include the actual generated TTS audio bytes. A voice ID and dialogue text alone are not sufficient to reproduce the browser's exact timing or voice output.

### Required normalized timeline record

The package builder should serialize a deterministic, DOM-independent record for every render interval. The following is the target shape (illustrative field names; values must be copied from the live prepared timeline, not guessed):

```json
{
  "scene_index": 0,
  "scene_name": "Cảnh 1",
  "scene_start": 0.0,
  "scene_end": 8.25,
  "scene_visual": {
    "character": "1",
    "expression": "Happy",
    "background": "garden.png",
    "dialogue_mode": "percent",
    "dialogue_width": 75,
    "portrait": false
  },
  "intervals": [
    {
      "kind": "dialogue",
      "start": 0.0,
      "duration": 2.75,
      "pause": 0.5,
      "speaker": "Aki",
      "speaker_id": "1",
      "text": "Example dialogue",
      "character_asset": "1",
      "expression": "Happy",
      "background": "garden.png",
      "effect_settings": ["bg:zoom"],
      "effect_strength": 50,
      "source_frame": {},
      "tts_asset_id": "tts_000001",
      "sfx_asset_id": null,
      "bgm_asset_id": "bgm_000001"
    }
  ]
}
```

A scene-local elapsed clock is used for the browser's looping background/character video clips and time-based effects. The exporter must preserve that clock behavior rather than using one global elapsed value for every scene.

### Porting boundary / known parity risks

- The browser effect renderer currently uses Canvas 2D transforms, blur, gradients, text measurement, and deterministic time-based particle formulas. A Python port must implement these explicitly; a simple FFmpeg overlay is not equivalent.
- The browser character fit rule is different in portrait and landscape: portrait fits to full frame height and center-crops horizontally; landscape uses `min(width/source_width, height/source_height)` and bottom-aligns.
- The browser background uses cover scaling and center alignment.
- The selected scene visual settings and per-line overrides must be resolved before rendering each interval.
- Do not advertise pixel-identical parity until comparison frames and audio sync tests pass.

