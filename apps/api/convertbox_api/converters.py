"""Self-hosted conversion implementations. All paths are allocated by the job manager."""

from __future__ import annotations

import io
import json
import shutil
import subprocess
import threading
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pymupdf
from docx import Document as WordDocument
from PIL import Image, ImageOps, UnidentifiedImageError, features
from pillow_heif import register_heif_opener

from .capabilities import AUDIO_INPUTS, IMAGE_INPUTS, OFFICE_INPUTS, VIDEO_INPUTS, can_convert
from .core import ConversionRequest, ConverterRegistry

register_heif_opener()
MAX_IMAGE_PIXELS = 80_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class ConversionError(ValueError):
    pass


def _int_setting(request: ConversionRequest, key: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(request.settings.get(key, default))
    except (TypeError, ValueError) as exc:
        raise ConversionError(f"Invalid {key}") from exc
    if value < minimum or value > maximum:
        raise ConversionError(f"{key} must be between {minimum} and {maximum}")
    return value


def _pages(spec: str, count: int) -> list[int]:
    if not spec.strip() or spec.strip().lower() == "all":
        return list(range(count))
    selected: set[int] = set()
    for part in spec.split(","):
        pieces = part.strip().split("-", 1)
        try:
            start = int(pieces[0])
            end = int(pieces[1]) if len(pieces) == 2 else start
        except ValueError as exc:
            raise ConversionError("Invalid page range") from exc
        if start < 1 or end < start or end > count:
            raise ConversionError("Page range is outside this PDF")
        selected.update(range(start - 1, end))
    return sorted(selected)


def _update(request: ConversionRequest, fraction: float) -> None:
    if request.on_progress:
        request.on_progress(max(0.0, min(0.99, fraction)))


class ImageConverter:
    def supports(self, source: str, target: str) -> bool:
        return source in IMAGE_INPUTS and target in ("jpg", "png", "webp", "pdf", "avif") and (target != "avif" or features.check("avif"))

    def validate(self, request: ConversionRequest) -> None:
        _int_setting(request, "quality", 85, 1, 100)
        _int_setting(request, "width", 0, 0, 12000)
        _int_setting(request, "height", 0, 0, 12000)

    def estimate(self, request: ConversionRequest) -> int | None:
        return None

    def convert(self, request: ConversionRequest) -> None:
        self.validate(request)
        if request.output_format == "pdf":
            page_size = str(request.settings.get("page_size", "auto"))
            orientation = str(request.settings.get("orientation", "auto"))
            margin_name = str(request.settings.get("margin", "none"))
            if page_size not in ("auto", "a4", "letter") or orientation not in ("auto", "portrait", "landscape") or margin_name not in ("none", "small", "medium", "large"):
                raise ConversionError("Invalid PDF page layout")
            margin = {"none": 0, "small": 18, "medium": 36, "large": 72}[margin_name]
            paths = request.input_paths or (request.input_path,)
            with pymupdf.open() as document:
                for index, path in enumerate(paths):
                    with self._open(path) as source:
                        image = ImageOps.exif_transpose(source).convert("RGB")
                        if page_size == "auto":
                            page_width, page_height = min(1440, image.width * 0.75), min(1440, image.height * 0.75)
                        else:
                            page_width, page_height = (595, 842) if page_size == "a4" else (612, 792)
                        if orientation == "landscape" or orientation == "auto" and image.width > image.height:
                            page_width, page_height = max(page_width, page_height), min(page_width, page_height)
                        elif orientation == "portrait":
                            page_width, page_height = min(page_width, page_height), max(page_width, page_height)
                        page_width, page_height = max(page_width, margin * 2 + 1), max(page_height, margin * 2 + 1)
                        page = document.new_page(width=page_width, height=page_height)
                        encoded = io.BytesIO()
                        image.save(encoded, "JPEG", quality=_int_setting(request, "quality", 85, 1, 100))
                        page.insert_image(pymupdf.Rect(margin, margin, page_width - margin, page_height - margin), stream=encoded.getvalue(), keep_proportion=True)
                        image.close()
                    _update(request, (index + 1) / len(paths))
                document.save(request.output_path, garbage=4, deflate=True)
            return
        with self._open(request.input_path) as source:
            image = ImageOps.exif_transpose(source)
            keep_metadata = request.settings.get("keep_metadata", False) is True
            save_metadata: dict[str, bytes] = {}
            if keep_metadata:
                exif = image.getexif()
                if exif:
                    save_metadata["exif"] = exif.tobytes()
                icc = source.info.get("icc_profile")
                if isinstance(icc, bytes):
                    save_metadata["icc_profile"] = icc
            width = _int_setting(request, "width", 0, 0, 12000)
            height = _int_setting(request, "height", 0, 0, 12000)
            if width or height:
                if not width:
                    width = max(1, round(image.width * height / image.height))
                if not height:
                    height = max(1, round(image.height * width / image.width))
                scale = min(width / image.width, height / image.height)
                output_width = max(1, round(image.width * scale))
                output_height = max(1, round(image.height * scale))
                if output_width * output_height > MAX_IMAGE_PIXELS:
                    raise ConversionError("Output image exceeds 80 megapixels")
                image = image.resize((output_width, output_height), Image.Resampling.LANCZOS)
            _update(request, 0.5)
            quality = _int_setting(request, "quality", 85, 1, 100)
            if request.output_format == "jpg":
                if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                    rgba = image.convert("RGBA")
                    white = Image.new("RGB", rgba.size, "white")
                    white.paste(rgba, mask=rgba.getchannel("A"))
                    image = white
                else:
                    image = image.convert("RGB")
                image.save(request.output_path, "JPEG", quality=quality, optimize=True, **save_metadata)
            elif request.output_format == "png":
                image.save(request.output_path, "PNG", optimize=True, **save_metadata)
            elif request.output_format == "webp":
                image.save(request.output_path, "WEBP", quality=quality, method=4, **save_metadata)
            else:
                image.save(request.output_path, "AVIF", quality=quality, **save_metadata)
            image.close()

    @staticmethod
    def _open(path: Path) -> Image.Image:
        try:
            image = Image.open(path)
            image.load()
            if image.width * image.height > MAX_IMAGE_PIXELS:
                image.close()
                raise ConversionError("Image exceeds 80 megapixels")
            return image
        except (UnidentifiedImageError, OSError) as exc:
            raise ConversionError("Image could not be decoded") from exc


class PdfConverter:
    def supports(self, source: str, target: str) -> bool:
        return source == "pdf" and target in ("png", "jpg", "txt", "docx", "pdf")

    def validate(self, request: ConversionRequest) -> None:
        _int_setting(request, "dpi", 144, 72, 300)
        if request.operation not in ("convert", "merge", "split", "rotate", "compress"):
            raise ConversionError("Unsupported PDF operation")

    def estimate(self, request: ConversionRequest) -> int | None:
        return None

    def convert(self, request: ConversionRequest) -> None:
        self.validate(request)
        if request.operation == "merge":
            with pymupdf.open() as result:
                paths = request.input_paths or (request.input_path,)
                for index, path in enumerate(paths):
                    with pymupdf.open(path) as part:
                        result.insert_pdf(part)
                    _update(request, (index + 1) / len(paths))
                result.save(request.output_path, garbage=4, deflate=True)
            return
        with pymupdf.open(request.input_path) as document:
            if document.needs_pass:
                raise ConversionError("Password-protected PDF is not supported")
            page_spec = str(request.settings.get("pages", "all"))
            selected = _pages(page_spec if request.operation != "split" or ";" not in page_spec else "all", len(document))
            if not selected:
                raise ConversionError("No pages selected")
            if request.operation == "split":
                groups = [(_pages(spec, len(document)), spec.strip()) for spec in page_spec.split(";")] if ";" in page_spec else [([number], str(number + 1)) for number in selected]
                with ZipFile(request.output_path, "w", ZIP_DEFLATED) as archive:
                    for index, (group, label) in enumerate(groups):
                        if not group or not label:
                            raise ConversionError("Invalid page range")
                        with pymupdf.open() as part:
                            for page_number in group:
                                part.insert_pdf(document, from_page=page_number, to_page=page_number)
                            prefix = "pages" if ";" in page_spec else "page"
                            archive.writestr(f"{prefix}_{label.replace(',', '_')}.pdf", part.tobytes())
                        _update(request, (index + 1) / len(groups))
                return
            if request.operation == "rotate":
                degrees = _int_setting(request, "rotation", 90, 0, 270)
                if degrees not in (0, 90, 180, 270):
                    raise ConversionError("Rotation must be 0, 90, 180 or 270")
                for page_number in selected:
                    page = document[page_number]
                    page.set_rotation((page.rotation + degrees) % 360)
                document.save(request.output_path, garbage=4, deflate=True)
                return
            if request.operation == "compress":
                document.save(request.output_path, garbage=4, deflate=True, clean=True)
                return
            if request.output_format in ("png", "jpg"):
                dpi = _int_setting(request, "dpi", 144, 72, 300)
                with ZipFile(request.output_path, "w", ZIP_DEFLATED) as archive:
                    for index, page_number in enumerate(selected):
                        page = document[page_number]
                        if page.rect.width * page.rect.height * (dpi / 72) ** 2 > MAX_IMAGE_PIXELS:
                            raise ConversionError("Rendered page exceeds 80 megapixels")
                        pix = page.get_pixmap(dpi=dpi, alpha=False)
                        if pix.width * pix.height > MAX_IMAGE_PIXELS:
                            raise ConversionError("Rendered page exceeds 80 megapixels")
                        if request.output_format == "png":
                            data = pix.tobytes("png")
                        else:
                            data = pix.tobytes("jpg", jpg_quality=_int_setting(request, "quality", 85, 1, 100))
                        archive.writestr(f"page_{page_number + 1}.{request.output_format}", data)
                        _update(request, (index + 1) / len(selected))
                return
            text = "\n\n".join(document[number].get_text().strip() for number in selected).strip()
            if not text:
                raise ConversionError("No selectable text found; scanned PDFs need OCR")
            if request.output_format == "txt":
                request.output_path.write_text(text, encoding="utf-8")
            else:
                output = WordDocument()
                for paragraph in text.split("\n"):
                    output.add_paragraph(paragraph)
                output.save(request.output_path)


class OfficeConverter:
    def supports(self, source: str, target: str) -> bool:
        return source in OFFICE_INPUTS and target == "pdf" and shutil.which("soffice") is not None

    def validate(self, request: ConversionRequest) -> None:
        pass

    def estimate(self, request: ConversionRequest) -> int | None:
        return None

    def convert(self, request: ConversionRequest) -> None:
        profile = request.output_path.parent / "lo_profile"
        command = [
            "soffice", "-env:UserInstallation=" + profile.as_uri(), "--headless", "--convert-to", "pdf",
            "--outdir", str(request.output_path.parent), str(request.input_path),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ConversionError("Office converter unavailable or timed out") from exc
        produced = request.output_path.parent / f"{request.input_path.stem}.pdf"
        if result.returncode != 0 or not produced.is_file():
            raise ConversionError("Office document could not be converted to PDF")
        shutil.move(produced, request.output_path)


class MediaConverter:
    def supports(self, source: str, target: str) -> bool:
        if source in AUDIO_INPUTS:
            return target in ("mp3", "wav", "flac", "m4a", "ogg", "opus")
        return source in VIDEO_INPUTS and target in ("mp4", "webm", "mkv", "mp3", "wav")

    def validate(self, request: ConversionRequest) -> None:
        _int_setting(request, "bitrate", 192, 64, 320)
        sample_rate = _int_setting(request, "sample_rate", 0, 0, 48000)
        if sample_rate not in (0, 44100, 48000):
            raise ConversionError("Unsupported sample rate")
        resolution = _int_setting(request, "resolution", 0, 0, 2160)
        if resolution not in (0, 480, 720, 1080, 1440, 2160):
            raise ConversionError("Unsupported video resolution")
        fps = _int_setting(request, "fps", 0, 0, 60)
        if fps not in (0, 24, 30, 60):
            raise ConversionError("Unsupported frame rate")
        if request.settings.get("video_quality", "high") not in ("very_high", "high", "medium", "low"):
            raise ConversionError("Unsupported video quality")

    def estimate(self, request: ConversionRequest) -> int | None:
        return None

    def convert(self, request: ConversionRequest) -> None:
        self.validate(request)
        duration = self._duration(request.input_path)
        target = request.output_format
        command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-threads", "2", "-y", "-i", str(request.input_path)]
        if target in ("mp3", "wav", "flac", "m4a", "ogg", "opus"):
            bitrate = _int_setting(request, "bitrate", 192, 64, 320)
            audio_args = {
                "mp3": ["-c:a", "libmp3lame", "-b:a", f"{bitrate}k"],
                "wav": ["-c:a", "pcm_s16le"],
                "flac": ["-c:a", "flac"],
                "m4a": ["-c:a", "aac", "-b:a", f"{bitrate}k"],
                "ogg": ["-c:a", "libopus", "-b:a", f"{min(bitrate, 256)}k"],
                "opus": ["-c:a", "libopus", "-b:a", f"{min(bitrate, 256)}k"],
            }
            command += ["-vn", *audio_args[target]]
            sample_rate = _int_setting(request, "sample_rate", 0, 0, 48000)
            if sample_rate:
                command += ["-ar", str(sample_rate)]
        else:
            quality = str(request.settings.get("video_quality", "high"))
            crf = {"very_high": (18, 24), "high": (23, 32), "medium": (28, 38), "low": (34, 44)}[quality]
            if target == "webm":
                command += ["-c:v", "libvpx-vp9", "-crf", str(crf[1]), "-b:v", "0", "-c:a", "libopus"]
            else:
                command += ["-c:v", "libx264", "-preset", "medium", "-crf", str(crf[0]), "-pix_fmt", "yuv420p", "-c:a", "aac"]
            resolution = _int_setting(request, "resolution", 0, 0, 2160)
            if resolution:
                dimensions = self._video_dimensions(request.input_path)
                if dimensions and dimensions[1] > resolution:
                    width = max(2, round(dimensions[0] * resolution / dimensions[1] / 2) * 2)
                    command += ["-vf", f"scale={width}:{resolution}"]
            fps = _int_setting(request, "fps", 0, 0, 60)
            if fps:
                command += ["-r", str(fps)]
        command += ["-progress", "pipe:1", "-nostats", str(request.output_path)]
        try:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except OSError as exc:
            raise ConversionError("FFmpeg is unavailable") from exc
        timed_out = threading.Event()
        def expire() -> None:
            timed_out.set()
            if process.poll() is None:
                process.kill()
        watchdog = threading.Timer(600, expire)
        watchdog.daemon = True
        watchdog.start()
        try:
            assert process.stdout is not None
            for line in process.stdout:
                if line.startswith("out_time_us=") and duration > 0:
                    try:
                        _update(request, int(line.split("=", 1)[1]) / 1_000_000 / duration)
                    except ValueError:
                        pass
            error = process.stderr.read()[-2000:] if process.stderr else ""
            if timed_out.is_set():
                raise ConversionError("Media conversion timed out")
            if process.wait(timeout=5) != 0:
                raise ConversionError("Media conversion failed: " + error[-300:])
        finally:
            watchdog.cancel()
            if process.poll() is None:
                process.kill()
                process.wait()

    @staticmethod
    def _duration(path: Path) -> float:
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                capture_output=True, text=True, timeout=15, check=True,
            )
            return float(json.loads(result.stdout)["format"]["duration"])
        except (OSError, subprocess.SubprocessError, KeyError, ValueError):
            return 0.0

    @staticmethod
    def _video_dimensions(path: Path) -> tuple[int, int] | None:
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(path)],
                capture_output=True, text=True, timeout=15, check=True,
            )
            stream = json.loads(result.stdout)["streams"][0]
            return int(stream["width"]), int(stream["height"])
        except (OSError, subprocess.SubprocessError, KeyError, IndexError, ValueError):
            return None


def make_registry() -> ConverterRegistry:
    registry = ConverterRegistry()
    registry.register(PdfConverter())
    registry.register(ImageConverter())
    registry.register(OfficeConverter())
    registry.register(MediaConverter())
    return registry
