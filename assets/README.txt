Assets Drop-In Folder
=====================

Drop optional WebP images into this directory to automatically replace the
built-in SVG/CSS visuals with zero code changes:

- icon.webp    -> Replaces the inline SVG app icon (recommended: 256x256px WebP, < 25 KB)
- preview.webp -> Replaces the coded macroeconomic telemetry preview card (recommended: 720x420px WebP, < 80 KB)

If either file is absent or fails to load, the page seamlessly retains its
lightweight built-in SVG/CSS fallback visuals.
