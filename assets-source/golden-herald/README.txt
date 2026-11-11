GOLDEN HERALD ART ASSETS — TRANSPARENT PNG PACK

Contents
- golden_herald_all_assets_transparent.png: original 2000 x 1545 composition with the white background removed.
- 11 individually cropped transparent PNGs, including a separate crown_overlay.
- manifest.json: original pixel positions and crop dimensions for each asset.

Animation / implementation notes
- Each PNG is an independent RGBA layer. Import each as its own sprite/image node in Cursor, Claude, Godot, Unity, web canvas, etc.
- Animate position (x/y), rotation, scale, opacity, or a subtle float/bob independently. Keep aspect ratio unless intentionally changing it.
- The crown is a separate transparent PNG: place it above any target building/object, then animate its position/rotation/scale independently. It can be reused on multiple targets.
- manifest.json coordinates refer to the original 2000 x 1545 source canvas. Use them to reconstruct the original layout or map objects to the original composition.
- Shadows are retained as semi-transparent pixels where separable from the white background.
- These are raster PNGs, not vector layers. They can be moved, rotated, scaled, and animated, but individual architectural details inside a building are not separately editable.
