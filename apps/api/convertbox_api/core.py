from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Protocol


class JobStatus(StrEnum):
    CREATED = "CREATED"
    VALIDATING = "VALIDATING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


TRANSITIONS: dict[JobStatus, set[JobStatus]] = {
    JobStatus.CREATED: {JobStatus.VALIDATING, JobStatus.CANCELLED},
    JobStatus.VALIDATING: {JobStatus.QUEUED, JobStatus.FAILED, JobStatus.CANCELLED},
    JobStatus.QUEUED: {JobStatus.PROCESSING, JobStatus.CANCELLED},
    JobStatus.PROCESSING: {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED},
    JobStatus.COMPLETED: {JobStatus.EXPIRED},
    JobStatus.FAILED: {JobStatus.VALIDATING, JobStatus.EXPIRED},
    JobStatus.CANCELLED: {JobStatus.VALIDATING, JobStatus.EXPIRED},
    JobStatus.EXPIRED: set(),
}


def can_transition(source: JobStatus, target: JobStatus) -> bool:
    return target in TRANSITIONS[source]


@dataclass(frozen=True)
class ConversionRequest:
    input_path: Path
    output_path: Path
    input_format: str
    output_format: str
    settings: dict[str, str | int | float | bool]


class Converter(Protocol):
    def supports(self, input_format: str, output_format: str) -> bool: ...
    def validate(self, request: ConversionRequest) -> None: ...
    def estimate(self, request: ConversionRequest) -> int | None: ...
    def convert(self, request: ConversionRequest) -> None: ...


class ConverterRegistry:
    def __init__(self) -> None:
        self._converters: list[Converter] = []

    def register(self, converter: Converter) -> None:
        self._converters.append(converter)

    def find(self, input_format: str, output_format: str) -> Converter | None:
        return next((item for item in self._converters if item.supports(input_format, output_format)), None)
