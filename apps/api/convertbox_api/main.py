from fastapi import FastAPI

app = FastAPI(title="ConvertBox API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/capabilities")
def capabilities() -> dict[str, object]:
    """Only server converters belong here; Phase 1 images stay in the browser."""
    return {"version": 1, "server": []}
