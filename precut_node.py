import json
import math
import os
import re
import shutil
import subprocess
import hashlib
from fractions import Fraction
from pathlib import Path

import numpy as np
import torch

import folder_paths
from comfy.utils import ProgressBar
from comfy_api.latest import ComfyExtension, InputImpl, Types, io

try:
    import comfy.model_management as comfy_model_management
except Exception:
    comfy_model_management = None


AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"}
PRECUT_VIDEO_INFO_TYPE = "PRECUT_VIDEO_INFO"
FRAME_DURATION_PRIORITY_TOOLTIP = "Frames is prioritized when both frames and duration are connected."


def _throw_if_interrupted():
    if comfy_model_management is not None:
        comfy_model_management.throw_exception_if_processing_interrupted()


def _stop_process(process):
    if process.poll() is not None:
        return process.communicate()
    try:
        process.terminate()
        return process.communicate(timeout=1.0)
    except subprocess.TimeoutExpired:
        process.kill()
        return process.communicate()


def _run_interruptible_subprocess(args, cleanup_paths=()):
    _throw_if_interrupted()
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        while True:
            _throw_if_interrupted()
            try:
                stdout, stderr = process.communicate(timeout=0.1)
                return subprocess.CompletedProcess(args, process.returncode, stdout, stderr)
            except subprocess.TimeoutExpired:
                continue
    except BaseException:
        _stop_process(process)
        for path in cleanup_paths or ():
            try:
                path = Path(path)
                if path.exists():
                    path.unlink()
            except Exception:
                pass
        raise


def _find_ffmpeg():
    forced = os.environ.get("PRECUT_FFMPEG_PATH") or os.environ.get("VHS_FORCE_FFMPEG_PATH")
    candidates = []
    if forced:
        candidates.append(forced)
    try:
        from imageio_ffmpeg import get_ffmpeg_exe

        candidates.append(get_ffmpeg_exe())
    except Exception:
        pass
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        candidates.append(system_ffmpeg)
    candidates.extend(
        [
            os.path.abspath("ffmpeg.exe"),
            os.path.abspath("ffmpeg"),
            r"E:\ffmpeg\ffmpeg.exe",
        ]
    )
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    raise RuntimeError(
        "PRECUT could not find FFmpeg. Install imageio-ffmpeg, add ffmpeg to PATH, "
        "or set PRECUT_FFMPEG_PATH."
    )


def _parse_state(precut_state):
    if isinstance(precut_state, dict):
        return precut_state
    if not precut_state:
        return {}
    try:
        return json.loads(precut_state)
    except Exception:
        return {}


def _input_path(video_path):
    video_path = (video_path or "").replace("\\", "/").strip()
    if not video_path:
        return ""

    raw = Path(video_path)
    if raw.is_absolute():
        resolved_raw = raw.resolve()
        if resolved_raw.exists():
            return str(resolved_raw)

    input_dir = Path(folder_paths.get_input_directory()).resolve()
    resolved = (input_dir / video_path).resolve()
    if os.path.commonpath([str(input_dir), str(resolved)]) != str(input_dir):
        raise RuntimeError("PRECUT video path must stay inside ComfyUI/input.")
    if not resolved.exists():
        raise RuntimeError(f"PRECUT video not found: {video_path}")
    return str(resolved)


def _video_path_from_value(video):
    if video is None:
        return ""
    if isinstance(video, (str, os.PathLike)):
        return str(video)
    if isinstance(video, dict):
        for key in ("video_path", "path", "filename", "file", "name"):
            value = video.get(key)
            if isinstance(value, (str, os.PathLike)):
                return str(value)
    for attr in ("video_path", "path", "filename", "file", "name"):
        value = getattr(video, attr, None)
        if isinstance(value, (str, os.PathLike)):
            return str(value)
    stream_source = getattr(video, "get_stream_source", None)
    if callable(stream_source):
        try:
            value = stream_source()
            if isinstance(value, (str, os.PathLike)):
                return str(value)
        except Exception:
            pass
    return ""


def _empty_audio(sample_rate=44100):
    return {
        "waveform": torch.zeros((1, 2, 0), dtype=torch.float32, device="cpu"),
        "sample_rate": sample_rate,
    }


def _trim_audio(audio, start_seconds, duration_seconds):
    _throw_if_interrupted()
    if audio is None:
        return _empty_audio()
    if not isinstance(audio, dict) or "waveform" not in audio:
        return audio

    waveform = audio["waveform"]
    sample_rate = int(audio.get("sample_rate", 44100))
    if not torch.is_tensor(waveform) or waveform.ndim < 3:
        return audio

    start = max(0, int(round(start_seconds * sample_rate)))
    length = max(0, int(round(duration_seconds * sample_rate)))
    end = min(waveform.shape[-1], start + length)
    trimmed = waveform[..., start:end].clone()
    _throw_if_interrupted()
    return {"waveform": trimmed, "sample_rate": sample_rate}


def _audio_duration(audio):
    if not isinstance(audio, dict) or "waveform" not in audio:
        return 0.0
    waveform = audio["waveform"]
    sample_rate = int(audio.get("sample_rate", 44100))
    if not torch.is_tensor(waveform) or waveform.ndim < 3 or sample_rate <= 0:
        return 0.0
    return float(waveform.shape[-1]) / float(sample_rate)


def _is_audio_path(path):
    return Path(str(path)).suffix.lower() in AUDIO_EXTENSIONS


def _load_audio_segment(video_file, start_seconds, duration_seconds):
    _throw_if_interrupted()
    ffmpeg = _find_ffmpeg()
    sample_rate = 44100
    args = [
        ffmpeg,
        "-v",
        "error",
        "-ss",
        str(max(0.0, start_seconds)),
        "-t",
        str(max(0.0, duration_seconds)),
        "-i",
        video_file,
        "-vn",
        "-ac",
        "2",
        "-ar",
        str(sample_rate),
        "-f",
        "f32le",
        "-",
    ]
    result = _run_interruptible_subprocess(args)
    _throw_if_interrupted()
    if result.returncode != 0 or not result.stdout:
        return _empty_audio(sample_rate)

    audio = np.frombuffer(result.stdout, dtype=np.float32)
    if audio.size == 0:
        return _empty_audio(sample_rate)
    audio = audio.reshape((-1, 2)).T
    waveform = torch.from_numpy(audio.copy()).unsqueeze(0)
    _throw_if_interrupted()
    return {"waveform": waveform, "sample_rate": sample_rate}


def _probe_video_size(video_file):
    ffmpeg = _find_ffmpeg()
    result = _run_interruptible_subprocess([ffmpeg, "-hide_banner", "-i", str(video_file)])
    text = (result.stderr or b"").decode("utf-8", errors="replace")
    match = re.search(r"Video:.*?,\s*(\d+)x(\d+)", text)
    if not match:
        raise RuntimeError("PRECUT could not read video dimensions for image output.")
    return int(match.group(1)), int(match.group(2))


def _load_image_segment(video_file, start_seconds, duration_seconds, fps, frame_count=None):
    _throw_if_interrupted()
    width, height = _probe_video_size(video_file)
    frame_size = width * height * 3
    if frame_size <= 0:
        raise RuntimeError("PRECUT image output has invalid video dimensions.")

    target_frames = int(frame_count or round(max(0.0, duration_seconds) * fps) or 1)
    target_frames = max(1, target_frames)
    args = [
        _find_ffmpeg(),
        "-v",
        "error",
        "-ss",
        str(max(0.0, start_seconds)),
        "-t",
        str(max(0.0, duration_seconds)),
        "-i",
        str(video_file),
        "-an",
        "-vf",
        f"fps=fps={fps},format=rgb24",
        "-frames:v",
        str(target_frames),
        "-f",
        "rawvideo",
        "-",
    ]
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frames = []
    pbar = ProgressBar(target_frames)
    try:
        while len(frames) < target_frames:
            _throw_if_interrupted()
            data = process.stdout.read(frame_size)
            if not data:
                break
            if len(data) != frame_size:
                break
            frame = np.frombuffer(data, dtype=np.uint8).reshape((height, width, 3))
            frames.append(frame.astype(np.float32) / 255.0)
            pbar.update(1)
        stdout, stderr = process.communicate()
    except BaseException:
        _stop_process(process)
        raise

    if process.returncode != 0:
        message = (stderr or b"").decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"PRECUT failed to load image frames. {message}")
    if not frames:
        raise RuntimeError("PRECUT image output did not produce any frames.")
    _throw_if_interrupted()
    return torch.from_numpy(np.stack(frames, axis=0))


def _media_edit(state):
    edit = state.get("edit")
    if not isinstance(edit, dict):
        edit = {}
    source_width = int(state.get("media_width") or 0)
    source_height = int(state.get("media_height") or 0)
    crop_px = edit.get("crop_px")
    crop = None
    if isinstance(crop_px, dict) and source_width > 0 and source_height > 0:
        x_px = max(-source_width * 2, min(source_width * 2 - 2, int(round(float(crop_px.get("x") or 0)))))
        y_px = max(-source_height * 2, min(source_height * 2 - 2, int(round(float(crop_px.get("y") or 0)))))
        w_px = max(2, min(source_width * 4, int(round(float(crop_px.get("w") or source_width)))))
        h_px = max(2, min(source_height * 4, int(round(float(crop_px.get("h") or source_height)))))
        if x_px != 0 or y_px != 0 or w_px != source_width or h_px != source_height:
            crop = {"x": x_px, "y": y_px, "w": w_px, "h": h_px}
    elif isinstance(edit.get("crop"), dict):
        source_crop = edit.get("crop")
        x = max(0.0, min(0.98, float(source_crop.get("x") or 0.0)))
        y = max(0.0, min(0.98, float(source_crop.get("y") or 0.0)))
        w = max(0.02, min(1.0 - x, float(source_crop.get("w") or 1.0)))
        h = max(0.02, min(1.0 - y, float(source_crop.get("h") or 1.0)))
        if x > 0.0001 or y > 0.0001 or w < 0.9999 or h < 0.9999:
            crop = {
                "x": int(round(x * source_width)),
                "y": int(round(y * source_height)),
                "w": int(round(w * source_width)),
                "h": int(round(h * source_height)),
            }
    scale = max(0.05, min(8.0, float(edit.get("scale") or 1.0)))
    rotation = float(edit.get("rotation") or 0.0)
    rotation = ((rotation + 180.0) % 360.0) - 180.0
    background = str(edit.get("background") or "#000000").strip()
    if not re.match(r"^#?[0-9a-fA-F]{6}$", background):
        background = "#000000"
    background = "#" + background.lstrip("#").upper()
    return {"crop": crop, "scale": scale, "rotation": rotation, "background": background}


def _has_media_edit(edit):
    return bool(edit["crop"]) or abs(edit["scale"] - 1.0) > 0.0001 or abs(edit["rotation"]) > 0.0001


def _output_dimensions(state):
    source_width = int(state.get("media_width") or 0)
    source_height = int(state.get("media_height") or 0)
    if source_width <= 0 or source_height <= 0 or state.get("media_type") == "audio":
        return 0, 0

    edit = _media_edit(state)
    crop = edit["crop"] or {"x": 0, "y": 0, "w": source_width, "h": source_height}
    cropped_width = max(1, int(round(crop["w"])))
    cropped_height = max(1, int(round(crop["h"])))
    scaled_width = max(1, int(round(cropped_width * edit["scale"])))
    scaled_height = max(1, int(round(cropped_height * edit["scale"])))
    if edit["crop"]:
        return scaled_width, scaled_height

    radians = abs((edit["rotation"] * math.pi) / 180.0)
    sin_value = abs(math.sin(radians))
    cos_value = abs(math.cos(radians))
    width = max(1, int(round(scaled_width * cos_value + scaled_height * sin_value)))
    height = max(1, int(round(scaled_width * sin_value + scaled_height * cos_value)))
    return width, height


def _video_info(state, duration, fps, frame_count):
    width, height = _output_dimensions(state)
    return {
        "duration": float(duration),
        "fps": float(fps),
        "length": int(max(0, frame_count)),
        "width": int(width),
        "height": int(height),
    }


def _normalize_video_info(video_info):
    if not isinstance(video_info, dict):
        video_info = {}
    return {
        "duration": float(video_info.get("duration") or 0.0),
        "fps": float(video_info.get("fps") or 0.0),
        "length": int(video_info.get("length") or video_info.get("frames") or 0),
        "width": int(video_info.get("width") or 0),
        "height": int(video_info.get("height") or 0),
    }


def _merge_video_info(primary, fallback=None):
    primary = _normalize_video_info(primary)
    fallback = _normalize_video_info(fallback)
    return {
        key: primary[key] if primary[key] not in (0, 0.0) else fallback[key]
        for key in ("duration", "fps", "length", "width", "height")
    }


def _source_fps(state, fallback):
    try:
        fps = float(state.get("source_fps") or fallback)
    except Exception:
        fps = fallback
    if not math.isfinite(fps) or fps <= 0:
        fps = fallback
    return fps


def _fps_filter_needed(state, fps):
    source_fps = _source_fps(state, fps)
    return abs(source_fps - fps) > 0.0001


def _fps_fraction(fps):
    return Fraction(float(fps)).limit_denominator(100000)


def _resample_images_by_fps(images, source_fps, target_fps, duration_seconds):
    _throw_if_interrupted()
    if not torch.is_tensor(images) or images.ndim < 1:
        return images, 0
    source_count = int(images.shape[0])
    if source_count <= 0:
        return images, 0
    target_count = max(1, int(round(max(0.0, duration_seconds) * target_fps)))
    if abs(source_fps - target_fps) <= 0.0001 and source_count == target_count:
        cloned = images.clone()
        _throw_if_interrupted()
        return cloned, source_count
    indices = torch.arange(target_count, dtype=torch.float64) * (source_fps / target_fps)
    indices = torch.clamp(indices.round().to(torch.long), 0, source_count - 1)
    resampled = images.index_select(0, indices).clone()
    _throw_if_interrupted()
    return resampled, target_count


def _process_video_file(video_file, state, start_seconds, duration_seconds, fps):
    _throw_if_interrupted()
    edit = _media_edit(state)
    force_fps = _fps_filter_needed(state, fps)
    if not _has_media_edit(edit) and not force_fps:
        return video_file, start_seconds, duration_seconds

    ffmpeg = _find_ffmpeg()
    source_width = int(state.get("media_width") or 0)
    source_height = int(state.get("media_height") or 0)
    filters = []

    crop = edit["crop"]
    crop_filter = None
    has_rotation = abs(edit["rotation"]) > 0.0001
    background = "0x" + edit["background"].lstrip("#")
    if crop and source_width > 0 and source_height > 0:
        crop_w = max(2, int(round(crop["w"])))
        crop_h = max(2, int(round(crop["h"])))
        crop_w -= crop_w % 2
        crop_h -= crop_h % 2
        crop_x = int(round(crop["x"]))
        crop_y = int(round(crop["y"]))
        crop_x -= crop_x % 2
        crop_y -= crop_y % 2
        if has_rotation:
            source_center_x = source_width / 2.0
            source_center_y = source_height / 2.0
            half_w = max(source_center_x, source_width - source_center_x, crop_x + crop_w - source_center_x, source_center_x - crop_x)
            half_h = max(source_center_y, source_height - source_center_y, crop_y + crop_h - source_center_y, source_center_y - crop_y)
            pad_w = max(source_width, int(math.ceil(half_w * 2.0)))
            pad_h = max(source_height, int(math.ceil(half_h * 2.0)))
            pad_w += pad_w % 2
            pad_h += pad_h % 2
            pad_x = int(round(pad_w / 2.0 - source_center_x))
            pad_y = int(round(pad_h / 2.0 - source_center_y))
            filters.append(f"pad={pad_w}:{pad_h}:{pad_x}:{pad_y}:color={background}")
            crop_x += pad_x
            crop_y += pad_y
        else:
            pad_left = max(0, -crop_x)
            pad_top = max(0, -crop_y)
            pad_right = max(0, crop_x + crop_w - source_width)
            pad_bottom = max(0, crop_y + crop_h - source_height)
            if pad_left or pad_top or pad_right or pad_bottom:
                pad_w = source_width + pad_left + pad_right
                pad_h = source_height + pad_top + pad_bottom
                pad_w += pad_w % 2
                pad_h += pad_h % 2
                filters.append(f"pad={pad_w}:{pad_h}:{pad_left}:{pad_top}:color={background}")
                crop_x += pad_left
                crop_y += pad_top
        crop_filter = f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"

    if has_rotation and crop_filter:
        angle = edit["rotation"] * math.pi / 180.0
        filters.append(f"rotate={angle}:ow=iw:oh=ih:c={background}")
        filters.append(crop_filter)
    elif crop_filter:
        filters.append(crop_filter)

    if abs(edit["scale"] - 1.0) > 0.0001:
        scale = edit["scale"]
        filters.append(f"scale=trunc(iw*{scale}/2)*2:trunc(ih*{scale}/2)*2")

    if has_rotation and not crop_filter:
        angle = edit["rotation"] * math.pi / 180.0
        filters.append(f"rotate={angle}:ow=rotw({angle}):oh=roth({angle}):c={background}")

    if force_fps:
        filters.append(f"fps=fps={fps}")

    filters.append("scale=trunc(iw/2)*2:trunc(ih/2)*2")
    filters.append("format=yuv420p")
    stat = os.stat(video_file)
    cache_payload = json.dumps(
        {
            "source": str(video_file),
            "mtime": stat.st_mtime,
            "size": stat.st_size,
            "start": round(start_seconds, 6),
            "duration": round(duration_seconds, 6),
            "fps": round(fps, 6),
            "source_fps": round(_source_fps(state, fps), 6),
            "edit": edit,
        },
        sort_keys=True,
    )
    cache_key = hashlib.sha256(cache_payload.encode("utf-8")).hexdigest()[:24]
    cache_dir = Path(folder_paths.get_temp_directory()) / "precut_processed"
    cache_dir.mkdir(parents=True, exist_ok=True)
    output = cache_dir / f"{Path(video_file).stem}_{cache_key}.mp4"
    if output.exists() and output.stat().st_size > 0:
        return str(output), 0.0, duration_seconds

    args = [
        ffmpeg,
        "-y",
        "-v",
        "error",
        "-ss",
        str(max(0.0, start_seconds)),
        "-t",
        str(max(0.0, duration_seconds)),
        "-i",
        video_file,
        "-vf",
        ",".join(filters),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        str(output),
    ]
    result = _run_interruptible_subprocess(args, cleanup_paths=(output,))
    _throw_if_interrupted()
    if result.returncode != 0 or not output.exists() or output.stat().st_size <= 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"PRECUT failed to process crop/transform output. {message}")
    return str(output), 0.0, duration_seconds


def _trim_video_object(video, start_seconds, duration_seconds, target_fps=None):
    _throw_if_interrupted()
    as_trimmed = getattr(video, "as_trimmed", None)
    if not callable(as_trimmed):
        as_trimmed = None
    if target_fps is None and as_trimmed is not None:
        try:
            trimmed = as_trimmed(start_seconds, duration_seconds, strict_duration=False)
            _throw_if_interrupted()
            if trimmed is not None:
                return trimmed
        except Exception:
            pass

    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return video

    try:
        _throw_if_interrupted()
        components = get_components()
        _throw_if_interrupted()
        fps = float(components.frame_rate)
        output_fps = float(target_fps or fps)
        images = components.images
        if torch.is_tensor(images) and images.ndim >= 1:
            start = max(0, min(int(round(start_seconds * fps)), int(images.shape[0])))
            length = max(0, int(round(duration_seconds * fps)))
            end = max(start, min(int(images.shape[0]), start + length))
            images = images[start:end].clone()
            _throw_if_interrupted()
            images, _ = _resample_images_by_fps(images, fps, output_fps, duration_seconds)
        audio = _trim_audio(getattr(components, "audio", None), start_seconds, duration_seconds)
        return InputImpl.VideoFromComponents(
            Types.VideoComponents(images=images, audio=audio, frame_rate=_fps_fraction(output_fps))
        )
    except Exception:
        return video


def _audio_from_video_object(video):
    _throw_if_interrupted()
    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return _empty_audio()
    try:
        components = get_components()
        _throw_if_interrupted()
        audio = getattr(components, "audio", None)
        return audio if audio is not None else _empty_audio()
    except Exception:
        return _empty_audio()


def _images_from_video_object(video):
    _throw_if_interrupted()
    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return None
    try:
        images = getattr(get_components(), "images", None)
        _throw_if_interrupted()
        if torch.is_tensor(images):
            if images.ndim == 4:
                cloned = images.clone()
                _throw_if_interrupted()
                return cloned
            if images.ndim == 3:
                cloned = images.unsqueeze(0).clone()
                _throw_if_interrupted()
                return cloned
    except Exception:
        pass
    return None


class PRECUT:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "precut_state": (
                    "STRING",
                    {
                        "default": "{}",
                        "multiline": True,
                    },
                ),
            },
            "optional": {
                "video": ("VIDEO",),
                "audio": ("AUDIO",),
                "media_specs_in": (PRECUT_VIDEO_INFO_TYPE, {"display_name": "media specs IN"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
            },
        }

    RETURN_TYPES = ("VIDEO", "IMAGE", "AUDIO", PRECUT_VIDEO_INFO_TYPE)
    RETURN_NAMES = ("video", "images", "audio", "media specs OUT")
    FUNCTION = "cut"
    CATEGORY = "PRECUT"
    DESCRIPTION = "Editor Edit Video Editor Audio Editor Cut Cutter Trim Trimmer Loader Load Video Audio"

    def cut(self, precut_state="{}", video=None, audio=None, media_specs_in=None, unique_id=None, prompt=None):
        _throw_if_interrupted()
        state = _parse_state(precut_state)
        fps = float(state.get("fps") or 24.0)
        if not math.isfinite(fps) or fps <= 0:
            fps = 24.0
        fps = min(60.0, fps)

        in_frame = int(state.get("in_frame") or 0)
        out_frame = int(state.get("out_frame") if state.get("out_frame") is not None else in_frame)
        if out_frame < in_frame:
            in_frame, out_frame = out_frame, in_frame

        frame_count = max(1, out_frame - in_frame + 1)
        duration = frame_count / fps
        start_seconds = in_frame / fps
        video_info = _merge_video_info(_video_info(state, duration, fps, frame_count), media_specs_in)

        if video is not None and audio is not None:
            raise RuntimeError("PRECUT: connect either VIDEO or AUDIO input, not both.")

        video_path = state.get("video_path") or _video_path_from_value(video)
        _throw_if_interrupted()

        if video is not None and not video_path:
            video_out = _trim_video_object(video, start_seconds, duration, fps)
            images_out = _images_from_video_object(video_out)
            audio_out = _audio_from_video_object(video_out)
            return (video_out, images_out, audio_out, video_info)

        if not video_path and audio is not None:
            audio_total = _audio_duration(audio)
            start_seconds = min(start_seconds, audio_total) if audio_total > 0 else start_seconds
            if audio_total > 0:
                duration = min(duration, max(0.0, audio_total - start_seconds))
                frame_count = max(0, int(round(duration * fps)))
                video_info = _merge_video_info(_video_info(state, duration, fps, frame_count), media_specs_in)
            audio_out = _trim_audio(audio, start_seconds, duration)
            return (None, None, audio_out, video_info)

        if not video_path:
            raise RuntimeError("PRECUT needs a loaded media file, connected VIDEO input, or connected AUDIO input.")

        resolved = _input_path(video_path)
        _throw_if_interrupted()

        if state.get("media_type") == "audio" or _is_audio_path(resolved):
            loaded_audio = _load_audio_segment(resolved, start_seconds, duration)
            return (None, None, loaded_audio, video_info)

        video_source, video_start, video_duration = _process_video_file(resolved, state, start_seconds, duration, fps)
        video_out = InputImpl.VideoFromFile(video_source, start_time=video_start, duration=video_duration)
        _throw_if_interrupted()
        images_out = _load_image_segment(video_source, video_start, video_duration, fps, frame_count)
        loaded_audio = _load_audio_segment(resolved, start_seconds, duration)
        return (video_out, images_out, loaded_audio, video_info)

    @classmethod
    def IS_CHANGED(cls, precut_state="{}", **kwargs):
        state = _parse_state(precut_state)
        video_path = state.get("video_path") or ""
        if not video_path:
            return precut_state

        try:
            resolved = _input_path(video_path)
            return f"{precut_state}:{os.path.getmtime(resolved)}:{os.path.getsize(resolved)}"
        except Exception:
            return precut_state


class PRECUTVideoInfo:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"video_info": (PRECUT_VIDEO_INFO_TYPE, {"display_name": "media specs OUT"})}}

    RETURN_TYPES = ("FLOAT", "INT", "INT", "INT", "FLOAT")
    RETURN_NAMES = ("fps", "width", "height", "frames", "duration")
    FUNCTION = "get_video_info"
    CATEGORY = "PRECUT"
    OUTPUT_NODE = True

    @staticmethod
    def _values(video_info):
        video_info = _normalize_video_info(video_info)
        return (
            float(video_info.get("fps") or 0.0),
            int(video_info.get("width") or 0),
            int(video_info.get("height") or 0),
            int(video_info.get("length") or 0),
            float(video_info.get("duration") or 0.0),
        )

    @staticmethod
    def _format_float(value):
        text = f"{float(value):.6f}".rstrip("0").rstrip(".")
        return text or "0"

    @classmethod
    def _ui(cls, values):
        fps, width, height, frames, duration = values
        return {
            "text": [
                cls._format_float(fps),
                str(int(width)),
                str(int(height)),
                str(int(frames)),
                f"{float(duration):.2f} (s)",
            ]
        }

    def get_video_info(self, video_info):
        values = self._values(video_info)
        return {
            "ui": self._ui(values),
            "result": values,
        }


class PRECUTMediaSpecsIn:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "fps": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 60.0, "step": 0.01}),
                "width": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "height": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "frames": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": 9999999,
                        "tooltip": FRAME_DURATION_PRIORITY_TOOLTIP,
                    },
                ),
                "duration": (
                    "FLOAT",
                    {
                        "default": 0.0,
                        "min": 0.0,
                        "step": 0.01,
                        "tooltip": FRAME_DURATION_PRIORITY_TOOLTIP,
                    },
                ),
            }
        }

    RETURN_TYPES = (PRECUT_VIDEO_INFO_TYPE,)
    RETURN_NAMES = ("media specs IN",)
    FUNCTION = "make_video_info"
    CATEGORY = "PRECUT"

    def make_video_info(self, fps=0.0, width=0, height=0, frames=0, duration=0.0):
        return (
            _normalize_video_info(
                {
                    "fps": fps,
                    "width": width,
                    "height": height,
                    "length": frames,
                    "duration": duration,
                }
            ),
        )


NODE_CLASS_MAPPINGS = {
    "PRECUT": PRECUT,
    "PRECUTVideoInfo": PRECUTVideoInfo,
    "PRECUTMediaSpecsIn": PRECUTMediaSpecsIn,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PRECUT": "PRECUT",
    "PRECUTVideoInfo": "PRECUT Media Specs OUT",
    "PRECUTMediaSpecsIn": "PRECUT Media Specs IN",
}


class PRECUTV2(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PRECUT",
            display_name="PRECUT",
            category="PRECUT",
            description="Visually select IN and OUT points for video or audio media.",
            search_aliases=[
                "Editor",
                "Edit",
                "Video Editor",
                "Audio Editor",
                "Cut",
                "Cutter",
                "Trim",
                "Trimmer",
                "Loader",
                "Load",
                "Video",
                "Audio",
            ],
            inputs=[
                io.String.Input("precut_state", multiline=True, default="{}"),
                io.Video.Input("video", optional=True),
                io.Audio.Input("audio", optional=True),
                io.Custom(PRECUT_VIDEO_INFO_TYPE).Input("media_specs_in", display_name="media specs IN", optional=True),
            ],
            outputs=[
                io.Video.Output(display_name="video"),
                io.Image.Output(display_name="images"),
                io.Audio.Output(display_name="audio"),
                io.Custom(PRECUT_VIDEO_INFO_TYPE).Output(display_name="media specs OUT"),
            ],
            hidden=[io.Hidden.unique_id, io.Hidden.prompt],
        )

    @classmethod
    def execute(cls, precut_state="{}", video=None, audio=None, media_specs_in=None, **kwargs) -> io.NodeOutput:
        hidden = getattr(cls, "hidden", None)
        if hidden is not None:
            kwargs.setdefault("unique_id", hidden.unique_id)
            kwargs.setdefault("prompt", hidden.prompt)
        return io.NodeOutput(*PRECUT().cut(precut_state=precut_state, video=video, audio=audio, media_specs_in=media_specs_in, **kwargs))

    @classmethod
    def fingerprint_inputs(cls, precut_state="{}", **kwargs):
        return PRECUT.IS_CHANGED(precut_state=precut_state, **kwargs)


class PRECUTVideoInfoV2(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PRECUTVideoInfo",
            display_name="PRECUT Media Specs OUT",
            category="PRECUT",
            description="Expose PRECUT media selection metadata as separate values.",
            is_output_node=True,
            inputs=[
                io.Custom(PRECUT_VIDEO_INFO_TYPE).Input("video_info", display_name="media specs OUT"),
            ],
            outputs=[
                io.Float.Output(display_name="fps"),
                io.Int.Output(display_name="width"),
                io.Int.Output(display_name="height"),
                io.Int.Output(display_name="frames"),
                io.Float.Output(display_name="duration"),
            ],
        )

    @classmethod
    def execute(cls, video_info) -> io.NodeOutput:
        values = PRECUTVideoInfo._values(video_info)
        return io.NodeOutput(*values, ui=PRECUTVideoInfo._ui(values))


class PRECUTMediaSpecsInV2(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PRECUTMediaSpecsIn",
            display_name="PRECUT Media Specs IN",
            category="PRECUT",
            description="Build PRECUT media specs from separate values.",
            inputs=[
                io.Float.Input("fps", default=0.0, min=0.0, max=60.0, step=0.01),
                io.Int.Input("width", default=0, min=0, max=8192),
                io.Int.Input("height", default=0, min=0, max=8192),
                io.Int.Input("frames", default=0, min=0, max=9999999, tooltip=FRAME_DURATION_PRIORITY_TOOLTIP),
                io.Float.Input("duration", default=0.0, min=0.0, step=0.01, tooltip=FRAME_DURATION_PRIORITY_TOOLTIP),
            ],
            outputs=[
                io.Custom(PRECUT_VIDEO_INFO_TYPE).Output(display_name="media specs IN"),
            ],
        )

    @classmethod
    def execute(cls, fps=0.0, width=0, height=0, frames=0, duration=0.0) -> io.NodeOutput:
        return io.NodeOutput(PRECUTMediaSpecsIn().make_video_info(fps, width, height, frames, duration)[0])


class PRECUTExtension(ComfyExtension):
    async def get_node_list(self):
        return [PRECUTV2, PRECUTVideoInfoV2, PRECUTMediaSpecsInV2]


async def comfy_entrypoint() -> PRECUTExtension:
    return PRECUTExtension()
