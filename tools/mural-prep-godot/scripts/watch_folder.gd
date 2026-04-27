class_name WatchFolder extends Node

# Stridekeep Mural Prep — Slice 4.
# TODO(slice-4): poll the configured ComfyUI output dir every 2s, surface
# new .png files (sorted by mtime desc) to the left sidebar.
# Use Timer + DirAccess.get_files() — not OS file-watch APIs (cross-platform
# support uneven). See SKILL.md §12.
