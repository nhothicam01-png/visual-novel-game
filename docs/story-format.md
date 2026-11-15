# Story JSON format (v1)

- `project`: id, name, fps, resolution, duration.
- `assets.characters[]`: id, name, image/source, defaultAnimation, optional parts {body,hair,outfit,face}.
- `assets.backgrounds[]`: id, src.
- `assets.audio[]`: id, src, kind.
- `scenes[]`: id, start, duration, background {id,src,effects}, music {id,src,volume,loop,fadeIn,fadeOut}, camera {type,x,y,zoom,effects}, characters[], dialogues[], soundEffects[], effects[].
- Scene character entries: characterId, start, duration, x/y or position, scale, layer, animations[].
- Animation entries: animationId (or id), start, duration, loop, repeat, stopAtEnd, x/y/rotation/scale, effects[].
- Dialogue entries: id, start, duration, text, audio (asset id or URL), speakers[].
- Speaker entries: characterId, lipSync, animationId/animation, expression, effects[].
- Effect entries support preset: fade, shake, flash, blur, grayscale, sepia, glow, rain, sparkle; unknown effects are ignored with validation warnings.

All times are seconds. Each scene's own timeline starts at zero; scene.start positions it in the global project. Concurrent speakers allow multi-character dialogue. For overlapping scenes, scene start/duration determine active composition; the engine renders all active scenes in order.
