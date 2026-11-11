# Google Colab renderer

## Current files
- `renderer.py`: native Python renderer. It reads `timeline.json`, uses the embedded TTS WAV files, fetches referenced library assets from the repository, renders the video in Colab, and muxes audio with FFmpeg.
- `colab_render.ipynb`: notebook for uploading the ZIP package, mounting Google Drive, and starting the render.

## Workflow
1. Open `phong_video.html` and choose **Chuẩn bị gói render Colab**.
2. Upload the resulting `*_colab_render_package.zip` in the notebook.
3. Run the notebook cells in order.
4. The MP4 is saved to `Google Drive/MyDrive/VisualNovelRenders`.

The ZIP is a timeline/audio package, not a video. Colab builds the video locally from source assets; browser-rendered frames are not uploaded.

## Implemented in this first engine version
- Reads package schema v1 and embedded dialogue WAV files.
- Fetches background images/videos, transparent character WebM, BGM and SFX from the repository raw asset URLs.
- Renders at the package's FPS and resolution.
- Background cover and character portrait/landscape placement follow the current browser renderer's fit rules.
- Dialogue box, speaker label, line timing, pause timing, camera/background/character motion, and atmosphere overlays (rain, snow, petals, dust, rays, fog, sparkle, lightning, flash, vignette).
- Mixes TTS, looping BGM segments and SFX with FFmpeg; writes H.264/AAC MP4.

## Known limitations — not yet browser parity
- This is an initial native implementation, not pixel-perfect parity with the Canvas renderer.
- Atmosphere overlays and text rendering are approximations; they may differ in shape, timing and blending from Canvas.
- Some visual details, font metrics, blur compositing and effect timing can differ from the browser.
- Custom/local-only assets that are not in the repository are not automatically included by the current ZIP exporter. Use assets already in the repository for the first test.
- Very long/high-FPS projects can exceed free Colab time or RAM. A free GPU is not guaranteed; this version uses CPU video composition and FFmpeg.
- Transparent WebM decoding depends on FFmpeg/PyAV codec support in the Colab runtime.

Test a short scene first and compare its duration, dialogue timing, character transparency, background, and audio before rendering a full story.
