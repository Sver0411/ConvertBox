"""Strict SVG subset. Rasterization never resolves external resources."""
import io
import re
import sys
from functools import lru_cache
from pathlib import Path
from defusedxml.ElementTree import fromstring
from PIL import Image

MAX_SVG_BYTES = 2 * 1024 * 1024
ALLOWED = {'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'symbol', 'title', 'desc'}

@lru_cache(maxsize=1)
def available() -> bool:
    try:
        import cairosvg  # noqa: F401
        return True
    except (ImportError, OSError):
        return False

def validate_svg(data: bytes) -> bytes:
    if len(data) > MAX_SVG_BYTES:
        raise ValueError('SVG exceeds 2 MB')
    root = fromstring(data, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    if root.tag != '{http://www.w3.org/2000/svg}svg':
        raise ValueError('Invalid SVG root')
    elements = list(root.iter())
    if len(elements) > 5000:
        raise ValueError('SVG contains too many elements')
    for node in elements:
        if node.tag.split('}')[-1] not in ALLOWED:
            raise ValueError('Unsupported SVG element')
        for key, value in node.attrib.items():
            name = key.split('}')[-1].lower()
            if name.startswith('on') or name in ('base', 'src', 'font-family'):
                raise ValueError('Unsafe SVG attribute')
            if name == 'href' and not re.fullmatch(r'#[\w.-]+', value):
                raise ValueError('External SVG references are forbidden')
            if re.search(r'@|https?:|file:|data:|javascript:|expression|font-family', value, re.I):
                raise ValueError('External resources and custom fonts are forbidden')
            for target in re.findall(r'url\s*\((.*?)\)', value, re.I):
                if not re.fullmatch(r'#[\w.-]+', target.strip()):
                    raise ValueError('External SVG URLs are forbidden')
            if 'url' in value.lower() and not re.search(r'url\s*\(#[\w.-]+\)', value, re.I):
                raise ValueError('Invalid SVG URL')
    for key in ('width', 'height'):
        raw = root.get(key)
        if raw and not re.fullmatch(r'(?:\d+(?:\.\d+)?)(?:px)?', raw):
            raise ValueError('SVG dimensions must be pixels')
        if raw and not 0 < float(raw.removesuffix('px')) <= 12000:
            raise ValueError('SVG dimension exceeds limit')
    if root.get('viewBox'):
        values = [float(value) for value in re.split(r'[\s,]+', root.get('viewBox').strip())]
        if len(values) != 4 or not all(abs(value) <= 12000 for value in values) or min(values[2:]) <= 0:
            raise ValueError('Invalid SVG viewBox')
    return data

def rasterize(path: Path, output: Path) -> None:
    import cairosvg
    data = validate_svg(path.read_bytes())
    # Keep decoded surface within the existing 80 MP / 12000 px limits.
    root = fromstring(data)
    box = [float(v) for v in re.split(r'[\s,]+', root.get('viewBox', '0 0 300 150').strip())]
    width = float(root.get('width', str(box[2])).removesuffix('px'))
    height = float(root.get('height', str(box[3])).removesuffix('px'))
    if width * height > 80_000_000:
        raise ValueError('SVG exceeds pixel limit')
    def deny(*args, **kwargs):
        raise ValueError('Resource loading is forbidden')
    png = cairosvg.surface.PNGSurface.convert(bytestring=data, url_fetcher=deny, output_width=int(width), output_height=int(height))
    with Image.open(io.BytesIO(png)) as image:
        image.save(output, 'PNG')

if __name__ == '__main__':
    rasterize(Path(sys.argv[1]), Path(sys.argv[2]))
