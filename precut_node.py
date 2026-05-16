import json
import math
import os
import re
import shutil
import subprocess
import hashlib
from pathlib import Path

import numpy as np
import torch

import folder_paths
from comfy_api.latest import ComfyExtension, InputImpl, Types, io


AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"}


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
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0 or not result.stdout:
        return _empty_audio(sample_rate)

    audio = np.frombuffer(result.stdout, dtype=np.float32)
    if audio.size == 0:
        return _empty_audio(sample_rate)
    audio = audio.reshape((-1, 2)).T
    waveform = torch.from_numpy(audio.copy()).unsqueeze(0)
    return {"waveform": waveform, "sample_rate": sample_rate}


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


def _process_video_file(video_file, state, start_seconds, duration_seconds):
    edit = _media_edit(state)
    if not _has_media_edit(edit):
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
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0 or not output.exists() or output.stat().st_size <= 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"PRECUT failed to process crop/transform output. {message}")
    return str(output), 0.0, duration_seconds


def _trim_video_object(video, start_seconds, duration_seconds):
    as_trimmed = getattr(video, "as_trimmed", None)
    if not callable(as_trimmed):
        as_trimmed = None
    if as_trimmed is not None:
        try:
            trimmed = as_trimmed(start_seconds, duration_seconds, strict_duration=False)
            if trimmed is not None:
                return trimmed
        except Exception:
            pass

    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return video

    try:
        components = get_components()
        fps = float(components.frame_rate)
        images = components.images
        if torch.is_tensor(images) and images.ndim >= 1:
            start = max(0, min(int(round(start_seconds * fps)), int(images.shape[0])))
            length = max(0, int(round(duration_seconds * fps)))
            end = max(start, min(int(images.shape[0]), start + length))
            images = images[start:end].clone()
        audio = _trim_audio(getattr(components, "audio", None), start_seconds, duration_seconds)
        return InputImpl.VideoFromComponents(
            Types.VideoComponents(images=images, audio=audio, frame_rate=components.frame_rate)
        )
    except Exception:
        return video


def _audio_from_video_object(video):
    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return _empty_audio()
    try:
        components = get_components()
        audio = getattr(components, "audio", None)
        return audio if audio is not None else _empty_audio()
    except Exception:
        return _empty_audio()


def _images_from_video_object(video):
    get_components = getattr(video, "get_components", None)
    if not callable(get_components):
        return None
    try:
        images = getattr(get_components(), "images", None)
        if torch.is_tensor(images):
            if images.ndim == 4:
                return images.clone()
            if images.ndim == 3:
                return images.unsqueeze(0).clone()
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
            },
        }

    RETURN_TYPES = ("VIDEO", "AUDIO", "IMAGE", "FLOAT")
    RETURN_NAMES = ("video", "audio", "image", "duration")
    FUNCTION = "cut"
    CATEGORY = "PRECUT"

    def cut(self, precut_state="{}", video=None, audio=None):
        state = _parse_state(precut_state)
        fps = float(state.get("fps") or 24.0)
        if not math.isfinite(fps) or fps <= 0:
            fps = 24.0

        in_frame = int(state.get("in_frame") or 0)
        out_frame = int(state.get("out_frame") if state.get("out_frame") is not None else in_frame)
        if out_frame < in_frame:
            in_frame, out_frame = out_frame, in_frame

        frame_count = max(1, out_frame - in_frame + 1)
        duration = frame_count / fps
        start_seconds = in_frame / fps

        if video is not None and audio is not None:
            raise RuntimeError("PRECUT: connect either VIDEO or AUDIO input, not both.")

        video_path = state.get("video_path") or _video_path_from_value(video)

        if video is not None and not video_path:
            video_out = _trim_video_object(video, start_seconds, duration)
            return (video_out, _audio_from_video_object(video_out), _images_from_video_object(video_out), float(duration))

        if not video_path and audio is not None:
            audio_total = _audio_duration(audio)
            start_seconds = min(start_seconds, audio_total) if audio_total > 0 else start_seconds
            if audio_total > 0:
                duration = min(duration, max(0.0, audio_total - start_seconds))
            return (None, _trim_audio(audio, start_seconds, duration), None, float(duration))

        if not video_path:
            raise RuntimeError("PRECUT needs a loaded media file, connected VIDEO input, or connected AUDIO input.")

        resolved = _input_path(video_path)

        if state.get("media_type") == "audio" or _is_audio_path(resolved):
            loaded_audio = _load_audio_segment(resolved, start_seconds, duration)
            return (None, loaded_audio, None, float(duration))

        video_source, video_start, video_duration = _process_video_file(resolved, state, start_seconds, duration)
        video_out = InputImpl.VideoFromFile(video_source, start_time=video_start, duration=video_duration)
        loaded_audio = _load_audio_segment(resolved, start_seconds, duration)
        return (video_out, loaded_audio, _images_from_video_object(video_out), float(duration))

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


NODE_CLASS_MAPPINGS = {
    "PRECUT": PRECUT,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PRECUT": "Media Cutter",
}


class PRECUTV2(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="PRECUT",
            display_name="Media Cutter",
            category="PRECUT",
            description="Visually select IN and OUT points for video or audio media.",
            inputs=[
                io.String.Input("precut_state", multiline=True, default="{}"),
                io.Video.Input("video", optional=True),
                io.Audio.Input("audio", optional=True),
            ],
            outputs=[
                io.Video.Output(display_name="video"),
                io.Audio.Output(display_name="audio"),
                io.Image.Output(display_name="image"),
                io.Float.Output(display_name="duration"),
            ],
        )

    @classmethod
    def execute(cls, precut_state="{}", video=None, audio=None) -> io.NodeOutput:
        return io.NodeOutput(*PRECUT().cut(precut_state=precut_state, video=video, audio=audio))

    @classmethod
    def fingerprint_inputs(cls, precut_state="{}", **kwargs):
        return PRECUT.IS_CHANGED(precut_state=precut_state, **kwargs)


class PRECUTExtension(ComfyExtension):
    async def get_node_list(self):
        return [PRECUTV2]


async def comfy_entrypoint() -> PRECUTExtension:
    return PRECUTExtension()
