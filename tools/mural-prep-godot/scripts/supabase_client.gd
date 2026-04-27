class_name SupabaseClient extends Node

# Stridekeep Mural Prep — Slice 4.
# TODO(slice-4): wrap HTTPRequest with proper headers (Authorization, apikey)
# for Supabase REST + Storage operations.
# Pattern: spawn fresh HTTPRequest per call (single-shot) — see SKILL.md §12.
# Methods to implement:
#   await upload_png(path: String, png_bytes: PackedByteArray) -> Dictionary
#   await rpc(name: String, body: Dictionary) -> Variant
#   await queue_status() -> Dictionary
