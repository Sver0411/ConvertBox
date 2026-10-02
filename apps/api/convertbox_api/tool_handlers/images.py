import json
from PIL import ExifTags, Image, ImageOps

from ..capabilities import IMAGE_INPUTS
from ..converters import ConversionError, ImageConverter, _int_setting
from ..core import ConversionRequest
from .registry import ToolHandler, ToolHandlerRegistry


def write_report(request: ConversionRequest, fields: dict[str, object]) -> None:
    data = json.dumps(fields, ensure_ascii=False, indent=2, default=str)
    if len(data.encode("utf-8")) > 16 * 1024 * 1024:
        raise ConversionError("Report exceeds 16 MB", "OUTPUT_TOO_LARGE")
    request.output_path.write_text(data, encoding="utf-8")


def save_image(image: Image.Image, request: ConversionRequest, *, icc: bytes | None = None) -> None:
    if request.output_format == "jpg":
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")
    options = {"icc_profile": icc} if icc else {}
    if request.output_format != "png":
        options["quality"] = _int_setting(request, "quality", 85, 1, 100)
    image.save(request.output_path, {"jpg": "JPEG", "png": "PNG", "webp": "WEBP"}[request.output_format], **options)


def rotate_image(request: ConversionRequest) -> None:
    rotation = _int_setting(request, "rotation", 90, 0, 270)
    if rotation not in (0, 90, 180, 270):
        raise ConversionError("Rotation must be 0, 90, 180 or 270", "INVALID_SETTINGS")
    with ImageConverter._open(request.input_path) as source:
        image = ImageOps.exif_transpose(source)
        if rotation:
            image = image.rotate(-rotation, expand=True)
        save_image(image, request)
        image.close()


def flip_image(request: ConversionRequest) -> None:
    direction = request.settings.get("direction", "horizontal")
    if direction not in ("horizontal", "vertical"):
        raise ConversionError("Invalid flip direction", "INVALID_SETTINGS")
    with ImageConverter._open(request.input_path) as source:
        image = ImageOps.exif_transpose(source)
        flipped = ImageOps.mirror(image) if direction == "horizontal" else ImageOps.flip(image)
        save_image(flipped, request)
        flipped.close()


def strip_metadata(request: ConversionRequest) -> None:
    with ImageConverter._open(request.input_path) as source:
        image = ImageOps.exif_transpose(source)
        icc = source.info.get("icc_profile") if request.settings.get("keep_icc") is True else None
        # A fresh pixel image drops EXIF, text chunks, GPS and format-specific info.
        cleaned = Image.new(image.mode, image.size)
        cleaned.paste(image)
        save_image(cleaned, request, icc=icc if isinstance(icc, bytes) else None)
        cleaned.close()


def image_metadata(request: ConversionRequest) -> None:
    with ImageConverter._open(request.input_path) as image:
        fields: dict[str, object] = {"format": image.format, "width": image.width, "height": image.height,
            "pixels": image.width * image.height, "color_mode": image.mode,
            "alpha": "A" in image.getbands() or "transparency" in image.info,
            "frames": getattr(image, "n_frames", 1), "animated": getattr(image, "is_animated", False)}
        if image.info.get("icc_profile"):
            fields["icc_bytes"] = len(image.info["icc_profile"])
        exif = {ExifTags.TAGS.get(key, str(key)): str(value)[:1024] for key, value in image.getexif().items()}
        if exif:
            fields["exif"] = exif
        write_report(request, fields)


def favicon(request: ConversionRequest) -> None:
    with ImageConverter._open(request.input_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGBA")
        image = ImageOps.pad(image, (256, 256), color=(0, 0, 0, 0))
        image.save(request.output_path, "ICO", sizes=[(value, value) for value in (16, 32, 48, 64, 128, 256)])
        image.close()


def compress(request: ConversionRequest) -> None:
    ImageConverter().convert(request)


def register_images(registry: ToolHandlerRegistry) -> None:
    output = ("jpg", "png", "webp")
    registry.register(ToolHandler("image.compress", IMAGE_INPUTS, output, compress, frozenset({"quality", "width", "height"})))
    registry.register(ToolHandler("image.rotate", IMAGE_INPUTS, output, rotate_image, frozenset({"rotation", "quality"})))
    registry.register(ToolHandler("image.flip", IMAGE_INPUTS, output, flip_image, frozenset({"direction", "quality"})))
    registry.register(ToolHandler("image.strip-metadata", IMAGE_INPUTS, output, strip_metadata, frozenset({"keep_icc", "quality"})))
    registry.register(ToolHandler("image.metadata", IMAGE_INPUTS, ("json",), image_metadata, allow_animation=True))
    registry.register(ToolHandler("image.favicon", ("jpg", "png", "webp"), ("ico",), favicon))
