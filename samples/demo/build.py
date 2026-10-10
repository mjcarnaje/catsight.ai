"""Build the demo library: ten sample documents of a fictional water cooperative.

    python3 samples/demo/build.py        # needs Google Chrome, Pillow, pypdfium2 and the img2pdf command

Each src/NN-*.html is wrapped in the Cooperative's letterhead and printed to PDF with
headless Chrome. Five are then turned into "scans" (grayscale page images, slightly
rotated, with paper noise and no text layer), so the demo shows OCR at work. The output
is deterministic, so rebuilding changes nothing unless a source changed.

Everything here is fictional: the organization, people, places and figures.
"""
from __future__ import annotations

import random
import subprocess
import sys
import tempfile
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
SRC = HERE / "src"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Source file -> (published file name, scanned?)
DOCUMENTS = {
    "01-travel-per-diem-policy": ("TRWC Policy 2025-03 Travel and Per Diem.pdf", False),
    "02-employee-leave-policy": ("TRWC Policy 2023-07 Employee Leave.pdf", False),
    "03-board-resolution-2025-17": ("Board Resolution 2025-17 Pump Station 4 Award.pdf", True),
    "04-contract-pump-station-4": ("Contract TRWC-2025-041 Pump Station 4.pdf", False),
    "05-board-minutes-2025-03-12": ("Board Minutes 2025-03-12.pdf", True),
    "06-incident-report-alder-street": ("Incident Report IR-2025-004 Alder Street.pdf", True),
    "07-memo-boil-water-advisory": ("Memo 2024-22 Boil-Water Advisories.pdf", True),
    "08-invoice-hpm-0389": ("Invoice HPM-0389 Halverson and Pike.pdf", True),
    "09-rate-adjustment-notice": ("Notice Water Rate Adjustment July 2025.pdf", False),
    "10-water-quality-report-2024": ("2024 Annual Water Quality Report.pdf", False),
}

LETTERHEAD = """<div class="letterhead">
  <svg viewBox="0 0 48 48"><path d="M24 4C17 15 10 22 10 30a14 14 0 0 0 28 0C38 22 31 15 24 4Z" fill="#1d4e6b"/>
  <path d="M17 31a7 7 0 0 0 7 7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
  <div><div class="org">Tamsin Ridge Water Cooperative</div>
  <div class="addr">100 Reservoir Road, Tamsin Ridge &middot; (555) 010-2420 &middot; www.tamsinridgewater.example</div></div>
</div>"""


def html_for(source: Path) -> str:
    body = source.read_text()
    head = "" if "letterhead: none" in body else LETTERHEAD
    style = (SRC / "style.css").read_text()
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{style}</style></head>"
            f"<body>{head}{body}</body></html>")  # the footer is an @page margin box (style.css)


def print_pdf(html: str, workdir: Path) -> bytes:
    page = workdir / "page.html"
    out = workdir / "page.pdf"
    page.write_text(html)
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--hide-scrollbars",
         f"--print-to-pdf={out}", page.as_uri()],
        check=True, capture_output=True,
    )
    return out.read_bytes()


def scanned(pdf: bytes, seed: int, workdir: Path) -> bytes:
    """Page images that look photocopied: gray paper, a slight tilt, speckle, soft edges."""
    rng = random.Random(seed)
    document = pdfium.PdfDocument(pdf)
    pages: list[Path] = []
    for index in range(len(document)):
        image = document[index].render(scale=150 / 72).to_pil().convert("L")
        image = image.rotate(rng.uniform(-0.7, 0.7), resample=Image.BICUBIC, expand=False, fillcolor=255)
        noise = Image.effect_noise(image.size, 18).point(lambda v: v - 128)
        image = Image.blend(image, Image.eval(noise, lambda v: 255 - abs(v)), 0.06)
        image = image.filter(ImageFilter.GaussianBlur(0.45)).point(lambda v: min(255, int(v * 0.93 + 12)))
        path = workdir / f"scan-{index}.jpg"
        image.save(path, format="JPEG", quality=72, dpi=(150, 150))
        pages.append(path)
    document.close()
    out = workdir / "scan.pdf"
    subprocess.run(["img2pdf", *map(str, pages), "-o", str(out)], check=True, capture_output=True)
    return out.read_bytes()


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        for number, (stem, (name, is_scan)) in enumerate(DOCUMENTS.items(), start=1):
            pdf = print_pdf(html_for(SRC / f"{stem}.html"), workdir)
            if is_scan:
                pdf = scanned(pdf, seed=number, workdir=workdir)
            (HERE / name).write_bytes(pdf)
            print(f"{'scan' if is_scan else 'text'}  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
