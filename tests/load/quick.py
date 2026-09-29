"""Bounded, deterministic admission/load regressions for CI."""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]

subprocess.run([
    "uv", "run", "--extra", "test", "python", "-m", "pytest", "tests/test_hardening.py",
    "-k", "twenty_uploads or queue_saturation or low_disk or slow_detection or output_limit or pdf_page_limit",
], cwd=ROOT / "apps/api", check=True)
subprocess.run([
    "npm", "run", "test", "-w", "apps/web", "--", "local-scheduler.test.ts",
], cwd=ROOT, check=True)
