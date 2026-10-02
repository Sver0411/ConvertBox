"""Server-side type identification. Client-provided names and MIME are advisory only."""

from pathlib import Path
from zipfile import BadZipFile, ZipFile
from PIL import Image

from .capabilities import AUDIO_INPUTS, VIDEO_INPUTS


class InvalidFile(ValueError):
    def __init__(self, message: str, code: str = "INVALID_FILE") -> None:
        super().__init__(message)
        self.code = code


def _reject_animation(path: Path, kind: str) -> None:
    if kind == "gif":
        with Image.open(path) as image:
            if getattr(image, "n_frames", 1) > 1:
                raise InvalidFile("Animated GIF conversion is not supported yet.", "ANIMATED_IMAGE_UNSUPPORTED")
        return
    if kind not in ("png", "webp"):
        return
    with path.open("rb") as source:
        offset = 8 if kind == "png" else 12
        while offset < min(path.stat().st_size, 16 * 1024 * 1024):
            source.seek(offset)
            header = source.read(8)
            if len(header) < 8:
                return
            if kind == "png":
                length = int.from_bytes(header[:4], "big")
                chunk = header[4:8]
                if chunk == b"acTL":
                    raise InvalidFile("APNG is not supported yet.", "ANIMATED_IMAGE_UNSUPPORTED")
                if chunk in (b"IDAT", b"IEND"):
                    return
                offset += 12 + length
            else:
                chunk = header[:4]
                length = int.from_bytes(header[4:8], "little")
                if chunk in (b"ANIM", b"ANMF"):
                    raise InvalidFile("Animated WebP is not supported yet.", "ANIMATED_IMAGE_UNSUPPORTED")
                if chunk == b"VP8X":
                    flags = source.read(1)
                    if not flags:
                        raise InvalidFile("Invalid WebP container")
                    if flags[0] & 0x02:
                        raise InvalidFile("Animated WebP is not supported yet.", "ANIMATED_IMAGE_UNSUPPORTED")
                offset += 8 + length + (length & 1)
        raise InvalidFile("Image header is too large to inspect safely.")


def detect_file(path: Path, name: str, *, allow_animation: bool = False) -> str:
    header = path.open("rb").read(32)
    suffix = Path(name).suffix.lower().lstrip(".")
    if suffix == "tif":
        suffix = "tiff"
    if suffix == "jpeg":
        suffix = "jpg"
    if suffix == "heif":
        suffix = "heic"
    actual: str | None = None
    if header.startswith(b"\xff\xd8\xff"):
        actual = "jpg"
    elif header.startswith(b"\x89PNG\r\n\x1a\n"):
        actual = "png"
    elif header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        actual = "webp"
    elif header[:2] == b"BM":
        actual = "bmp"
    elif header[:6] in (b"GIF87a", b"GIF89a"):
        actual = "gif"
    elif header.startswith((b"II\x2a\x00", b"MM\x00\x2a")):
        actual = "tiff"
        if not allow_animation:
            with Image.open(path) as image:
                if getattr(image, "n_frames", 1) > 1:
                    raise InvalidFile("Multipage TIFF requires explicit page handling")
    elif header.startswith(b"\x00\x00\x01\x00"):
        actual = "ico"
    elif suffix == "svg":
        from .svg import validate_svg
        try:
            if path.stat().st_size > 2 * 1024 * 1024:
                raise ValueError("SVG exceeds 2 MB")
            validate_svg(path.read_bytes())
        except Exception as exc:
            raise InvalidFile("Unsafe or invalid SVG") from exc
        actual = "svg"
    elif header.startswith(b"%PDF-"):
        actual = "pdf"
    elif header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        actual = "wav"
    elif header[:4] == b"RIFF" and header[8:12] == b"AVI ":
        actual = "avi"
    elif header.startswith(b"fLaC"):
        actual = "flac"
    elif header.startswith(b"OggS"):
        actual = suffix if suffix in ("ogg", "opus") else "ogg"
    elif header.startswith(b"ID3") or (len(header) > 1 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0):
        actual = suffix if suffix in ("mp3", "aac") else "mp3"
    elif header.startswith(b"\x1a\x45\xdf\xa3"):
        actual = suffix if suffix in ("mkv", "webm") else "mkv"
    elif len(header) >= 12 and header[4:8] == b"ftyp":
        brand = header[8:12].lower()
        if brand.startswith((b"hei", b"mif")):
            actual = "heic"
        elif brand in (b"avif", b"avis"):
            actual = "avif"
        elif brand.startswith(b"m4a"):
            actual = "m4a"
        else:
            actual = suffix if suffix in ("mp4", "mov", "m4a") else "mp4"
    elif header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") and suffix in ("doc", "xls", "ppt"):
        actual = suffix
    elif header.startswith(b"PK\x03\x04"):
        try:
            with ZipFile(path) as archive:
                if len(archive.infolist()) > 10000:
                    raise InvalidFile("Office container has too many entries")
                if sum(item.file_size for item in archive.infolist()) > 500 * 1024 * 1024:
                    raise InvalidFile("Office container is too large after extraction")
                names = set(archive.namelist())
                if "word/document.xml" in names:
                    actual = "docx"
                elif "xl/workbook.xml" in names:
                    actual = "xlsx"
                elif "ppt/presentation.xml" in names:
                    actual = "pptx"
                elif "mimetype" in names:
                    if archive.getinfo("mimetype").file_size > 100:
                        raise InvalidFile("Invalid Office mimetype")
                    mime = archive.read("mimetype")
                    actual = {
                        b"application/vnd.oasis.opendocument.text": "odt",
                        b"application/vnd.oasis.opendocument.spreadsheet": "ods",
                        b"application/vnd.oasis.opendocument.presentation": "odp",
                    }.get(mime)
        except BadZipFile as exc:
            raise InvalidFile("Invalid Office container") from exc
    if actual is None:
        raise InvalidFile("Unsupported or unrecognized file signature")
    if suffix and actual != suffix:
        # Ogg/Opus and common ISO-BMFF brands can share signatures; ffprobe validates them later.
        related = (actual, suffix) in {("ogg", "opus"), ("opus", "ogg"), ("mp4", "mov"), ("mov", "mp4")}
        if not related:
            raise InvalidFile("File extension does not match its contents")
    if actual in AUDIO_INPUTS + VIDEO_INPUTS:
        _verify_media(path, actual)
    if not allow_animation and actual in ("png", "webp", "gif"):
        _reject_animation(path, actual)
    return actual


def _verify_media(path: Path, kind: str) -> None:
    import json
    import subprocess

    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=15, check=True,
        )
        streams = json.loads(result.stdout).get("streams", [])
        expected = "video" if kind in VIDEO_INPUTS else "audio"
        if not any(stream.get("codec_type") == expected for stream in streams):
            raise InvalidFile(f"No {expected} stream found")
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise InvalidFile("Media file could not be probed") from exc
