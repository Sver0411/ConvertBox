"""The server's only advertised conversion matrix."""

from dataclasses import dataclass
from functools import lru_cache
from shutil import which
import subprocess
from PIL import features
from .svg import available as svg_available


@dataclass(frozen=True)
class Capability:
    input: str
    outputs: tuple[str, ...]
    note: str = ""


IMAGE_INPUTS = ("jpg", "png", "webp", "bmp", "gif", "heic", "avif", "tiff", "ico", "svg")
AUDIO_INPUTS = ("mp3", "wav", "flac", "aac", "m4a", "ogg", "opus")
VIDEO_INPUTS = ("mp4", "mov", "mkv", "webm", "avi")
OFFICE_INPUTS = ("doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp")
MEDIA_OUTPUTS = ("mp3", "wav", "flac", "m4a", "ogg", "opus")
VIDEO_OUTPUTS = ("mp4", "webm", "mkv")


@lru_cache(maxsize=1)
def available_encoders() -> set[str]:
    if not which("ffmpeg"):
        return set()
    try:
        result = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True, timeout=10, check=True)
        return {line.split()[1] for line in result.stdout.splitlines() if len(line.split()) >= 2 and line.lstrip().startswith(("A", "V"))}
    except (OSError, subprocess.SubprocessError):
        return set()


def server_capabilities() -> list[Capability]:
    image_outputs = ("jpg", "png", "webp", "pdf") + (("avif",) if features.check("avif") else ())
    capabilities = [
        Capability("pdf", ("png", "jpg", "txt", "docx"), "DOCX/TXT extract selectable text; scanned pages need OCR."),
        *(Capability(kind, image_outputs) for kind in IMAGE_INPUTS[:3]),
        *(Capability(kind, image_outputs) for kind in IMAGE_INPUTS[3:] if (kind != "avif" or features.check("avif")) and (kind != "svg" or svg_available())),
    ]
    if which("soffice"):
        capabilities.extend(Capability(kind, ("pdf",)) for kind in OFFICE_INPUTS)
    if which("ffmpeg") and which("ffprobe"):
        encoders = available_encoders()
        requirements = {"mp3": "libmp3lame", "wav": "pcm_s16le", "flac": "flac", "m4a": "aac", "ogg": "libopus", "opus": "libopus"}
        audio_outputs = tuple(kind for kind in MEDIA_OUTPUTS if requirements[kind] in encoders)
        video_outputs = tuple(kind for kind, codec in (("mp4", "libx264"), ("webm", "libvpx-vp9"), ("mkv", "libx264")) if codec in encoders)
        capabilities.extend(Capability(kind, audio_outputs) for kind in AUDIO_INPUTS if audio_outputs)
        capabilities.extend(Capability(kind, video_outputs + tuple(kind for kind in ("mp3", "wav") if kind in audio_outputs)) for kind in VIDEO_INPUTS if video_outputs or audio_outputs)
    return capabilities


def can_convert(input_format: str, output_format: str) -> bool:
    return any(item.input == input_format and output_format in item.outputs for item in server_capabilities())


PDF_OPERATIONS = ("merge", "split", "rotate")
