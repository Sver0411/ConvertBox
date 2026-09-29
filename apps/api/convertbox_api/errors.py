"""Stable public API errors; internal exception messages remain server-side."""

from fastapi import HTTPException


class ApiError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(status_code=status_code, detail={"code": code, "message": message})


def busy() -> ApiError:
    return ApiError(429, "UPLOAD_BUSY", "Server is busy. Please retry shortly.")
