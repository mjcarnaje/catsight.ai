#!/usr/bin/env bash
# Build main.pdf: XeLaTeX (Times New Roman and STIX Two Math from the system), then
# BibTeX, then XeLaTeX twice so references, page numbers and lists settle.
set -euo pipefail
cd "$(dirname "$0")"
run() { xelatex -interaction=nonstopmode -halt-on-error main.tex > build.log 2>&1 || { tail -40 build.log; exit 1; }; }
run
bibtex main > bibtex.log 2>&1 || { cat bibtex.log; exit 1; }
run
run
grep -E "LaTeX Warning: (Reference|Citation).*undefined|There were undefined" build.log || true
echo "main.pdf: $(pdfinfo main.pdf 2>/dev/null | awk '/^Pages:/{print $2}') pages"
