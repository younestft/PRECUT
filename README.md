# PRECUT

PRECUT is a ComfyUI custom node for visually selecting an IN and OUT range from a video/audio timeline.

## Dependency

PRECUT is designed to be used on ComfyUI installs that already have **ComfyUI-VideoHelperSuite** installed.

It reuses Video Helper Suite's FFmpeg discovery and ComfyUI `AUDIO` format instead of bundling its own FFmpeg.

## Controls

- `LOAD VIDEO`: uploads the selected video into `ComfyUI/input/PRECUT/`
- `I`: mark IN while hovering the waveform
- `O`: mark OUT while hovering the waveform
- Mouse wheel over waveform: smooth zoom in/out
- Down arrow: first frame
- Up arrow: last frame
- Left arrow: previous frame
- Right arrow: next frame
- Space: play/stop
- Loop button: loops playback from IN to OUT when active

## Outputs

- `IMAGES`: selected video frames
- `AUDIO`: selected audio range
- `DURATION`: selected IN-to-OUT duration as a float in seconds

Optional `IMAGES` and `AUDIO` inputs override the loaded video media.
