from dataclasses import dataclass
from typing import Callable

from ..core import ConversionRequest
from ..converters import ConversionError


@dataclass(frozen=True)
class ToolHandler:
    id: str
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    handler: Callable[[ConversionRequest], None]
    settings: frozenset[str] = frozenset()
    multiple: bool = False
    minimum_inputs: int = 1
    available: Callable[[], bool] = lambda: True
    allow_animation: bool = False

    def validate(self, request: ConversionRequest) -> None:
        paths = request.input_paths or (request.input_path,)
        if len(paths) < self.minimum_inputs or (not self.multiple and len(paths) != 1):
            raise ConversionError("Incorrect number of files for this tool", "INVALID_FILE")
        if "*" not in self.inputs and request.input_format not in self.inputs:
            raise ConversionError("File format is not accepted by this tool", "UNSUPPORTED_FORMAT")
        if request.output_format not in self.outputs:
            raise ConversionError("Output format is not accepted by this tool", "UNSUPPORTED_FORMAT")
        if not self.available():
            raise ConversionError("Tool is unavailable on this server", "CONVERTER_UNAVAILABLE")

    def convert(self, request: ConversionRequest) -> None:
        self.validate(request)
        self.handler(request)


class ToolHandlerRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolHandler] = {}

    def register(self, handler: ToolHandler) -> None:
        if handler.id in self._tools:
            raise ValueError(f"Duplicate tool {handler.id}")
        self._tools[handler.id] = handler

    def get(self, tool_id: str) -> ToolHandler | None:
        return self._tools.get(tool_id)

    def capabilities(self) -> dict[str, dict[str, object]]:
        return {key: {"available": value.available(), "inputs": value.inputs, "outputs": value.outputs} for key, value in self._tools.items()}


def make_tool_registry() -> ToolHandlerRegistry:
    from .images import register_images
    registry = ToolHandlerRegistry()
    register_images(registry)
    from .pdf import register_pdf
    register_pdf(registry)
    return registry
