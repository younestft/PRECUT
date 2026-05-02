import os
import re
import shutil
import subprocess
import json
import logging
from array import array
from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer

from .precut_node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, comfy_entrypoint
from .precut_node import _find_ffmpeg, _input_path

WEB_DIRECTORY = "./web"

VIDEO_EXTENSIONS = {".webm", ".mp4", ".mkv", ".gif", ".mov", ".avi", ".m4v"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"}
MEDIA_EXTENSIONS = VIDEO_EXTENSIONS | AUDIO_EXTENSIONS
PRECUT_MAX_UPLOAD_MB = float(os.environ.get("PRECUT_MAX_UPLOAD_MB", "999999999"))


def _raise_comfy_upload_limit():
    max_bytes = round(PRECUT_MAX_UPLOAD_MB * 1024 * 1024)
    app = getattr(PromptServer.instance, "app", None)
    if app is not None and hasattr(app, "_client_max_size"):
        current = int(getattr(app, "_client_max_size", 0) or 0)
        if current < max_bytes:
            app._client_max_size = max_bytes
            logging.info("[PRECUT] Raised ComfyUI upload limit to %.0f MB for media uploads.", PRECUT_MAX_UPLOAD_MB)

    try:
        from comfy.cli_args import args

        if float(getattr(args, "max_upload_size", 0) or 0) < PRECUT_MAX_UPLOAD_MB:
            args.max_upload_size = PRECUT_MAX_UPLOAD_MB
    except Exception:
        pass


_raise_comfy_upload_limit()


def _safe_filename(filename):
    name = os.path.basename(filename or "")
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    return name or "video.mp4"


def _unique_destination(input_dir, original):
    stem = Path(original).stem
    ext = Path(original).suffix.lower()
    filename = original
    destination = input_dir / filename
    counter = 1
    while destination.exists():
        filename = f"{stem}_{counter}{ext}"
        destination = input_dir / filename
        counter += 1
    return filename, destination


def _input_relative_payload(path):
    input_dir = Path(folder_paths.get_input_directory()).resolve()
    resolved = Path(path).resolve()
    relative = resolved.relative_to(input_dir).as_posix()
    filename = resolved.name
    subfolder = Path(relative).parent.as_posix()
    if subfolder == ".":
        subfolder = ""
    return {
        "name": filename,
        "subfolder": subfolder,
        "type": "input",
        "path": relative,
        "url": f"/view?filename={filename}&subfolder={subfolder}&type=input",
        "media_type": "audio" if resolved.suffix.lower() in AUDIO_EXTENSIONS else "video",
    }


@PromptServer.instance.routes.post("/precut/upload_video")
async def upload_video(request):
    reader = await request.multipart()
    field = await reader.next()
    if field is None or field.name != "video":
        return web.json_response({"error": "Missing video file field."}, status=400)

    original = _safe_filename(field.filename)
    ext = Path(original).suffix.lower()
    if ext not in MEDIA_EXTENSIONS:
        return web.json_response(
            {"error": f"Unsupported media format '{ext}'. Supported: {', '.join(sorted(MEDIA_EXTENSIONS))}"},
            status=400,
        )

    input_dir = Path(folder_paths.get_input_directory()) / "PRECUT"
    input_dir.mkdir(parents=True, exist_ok=True)

    filename, destination = _unique_destination(input_dir, original)

    with destination.open("wb") as output:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            output.write(chunk)

    return web.json_response(
        {
            "name": filename,
            "subfolder": "PRECUT",
            "type": "input",
            "path": f"PRECUT/{filename}",
            "url": f"/view?filename={filename}&subfolder=PRECUT&type=input",
            "media_type": "audio" if ext in AUDIO_EXTENSIONS else "video",
        }
    )


@PromptServer.instance.routes.post("/precut/register_video_path")
async def register_video_path(request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    raw_path = str(payload.get("path") or "").strip()
    if not raw_path:
        return web.json_response({"error": "No connected video path was found."}, status=400)

    ext = Path(raw_path).suffix.lower()
    if ext not in MEDIA_EXTENSIONS:
        return web.json_response(
            {"error": f"Unsupported connected media format '{ext}'. Supported: {', '.join(sorted(MEDIA_EXTENSIONS))}"},
            status=400,
        )

    input_root = Path(folder_paths.get_input_directory()).resolve()
    candidates = []
    raw = Path(raw_path)
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.append(input_root / raw_path)
        candidates.append(input_root / Path(raw_path).name)

    source = None
    for candidate in candidates:
        try:
            resolved = candidate.resolve()
        except Exception:
            continue
        if resolved.exists() and resolved.is_file():
            source = resolved
            break

    if source is None:
        return web.json_response({"error": f"Could not find connected video file: {raw_path}"}, status=404)

    try:
        if os.path.commonpath([str(input_root), str(source)]) == str(input_root):
            return web.json_response(_input_relative_payload(source))
    except ValueError:
        pass

    destination_dir = input_root / "PRECUT"
    destination_dir.mkdir(parents=True, exist_ok=True)
    filename, destination = _unique_destination(destination_dir, _safe_filename(source.name))
    shutil.copy2(source, destination)

    return web.json_response(
        {
            "name": filename,
            "subfolder": "PRECUT",
            "type": "input",
            "path": f"PRECUT/{filename}",
            "url": f"/view?filename={filename}&subfolder=PRECUT&type=input",
            "media_type": "audio" if ext in AUDIO_EXTENSIONS else "video",
        }
    )


@PromptServer.instance.routes.get("/precut/waveform")
async def waveform(request):
    video_path = request.query.get("path", "")
    if not video_path:
        return web.json_response({"error": "Missing video path."}, status=400)

    try:
        ffmpeg_path = _find_ffmpeg()
        resolved = _input_path(video_path)
        cache_path = Path(folder_paths.get_temp_directory()) / "precut_waveforms"
        cache_path.mkdir(parents=True, exist_ok=True)
        stat = os.stat(resolved)
        cache_file = cache_path / f"{Path(resolved).stem}_{stat.st_size}_{int(stat.st_mtime)}.json"
        if cache_file.exists():
            return web.json_response(json.loads(cache_file.read_text(encoding="utf-8")))

        sample_rate = 8000
        process = subprocess.run(
            [
                ffmpeg_path,
                "-v",
                "error",
                "-i",
                resolved,
                "-vn",
                "-ac",
                "1",
                "-ar",
                str(sample_rate),
                "-f",
                "f32le",
                "-",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except Exception as exc:
        return web.json_response({"error": str(exc), "peaks": [], "real": False}, status=200)

    samples = array("f")
    samples.frombytes(process.stdout)
    if not samples:
        return web.json_response({"sample_rate": sample_rate, "peaks": [], "real": False})

    if os.name == "nt" and samples.itemsize != 4:
        return web.json_response({"sample_rate": sample_rate, "peaks": [], "real": False})

    target = 4096
    bucket = max(1, len(samples) // target)
    peaks = []
    for index in range(0, len(samples), bucket):
        chunk = samples[index : index + bucket]
        peaks.append(round(min(1.0, max(abs(value) for value in chunk)), 4))

    payload = {"sample_rate": sample_rate, "peaks": peaks, "real": True}
    cache_file.write_text(json.dumps(payload), encoding="utf-8")
    return web.json_response(payload)


__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "comfy_entrypoint"]
