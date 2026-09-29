FROM python:3.12-slim
WORKDIR /app
COPY apps/api/pyproject.toml /app/pyproject.toml
COPY apps/api/convertbox_api /app/convertbox_api
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "convertbox_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
