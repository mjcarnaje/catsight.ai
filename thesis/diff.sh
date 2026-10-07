#!/usr/bin/env bash
# The revised thesis marked against the defended edition (the commit
# "docs(thesis): defended edition in LaTeX"):
#
#   diff.pdf          every page; additions in blue, deletions struck through in red,
#                     a bar in the margin beside every change, a reading guide first
#   diff-changes.pdf  the same pages with the unchanged ones left out (page numbers
#                     are those of diff.pdf)
#
# Needs latexdiff (brew install latexdiff), the changebar and zref packages, poppler and qpdf.
set -euo pipefail
cd "$(dirname "$0")"
here=$PWD
base=$(git log --format=%H --grep="defended edition in LaTeX" -n 1)
work=$(mktemp -d)
trap '[ -n "${KEEP:-}" ] && echo "kept $work" || rm -rf "$work"' EXIT   # KEEP=1 ./diff.sh to debug

git -C "$(git rev-parse --show-toplevel)" archive "$base" thesis | tar -x -C "$work"   # $work/thesis: the defended edition
mkdir -p "$work/revised"
rsync -a --exclude '*.pdf' --exclude '*.aux' --exclude '*.log' --exclude '*.bbl' ./ "$work/revised/"   # a .bbl would be flattened into one side only
cp -R "$work/thesis/figures/defended" "$work/revised/figures/"

# Screenshots are placed by a macro, which latexdiff can't mark: write them out as figures.
# Curly quotes and dashes print the same as their TeX spellings: use one spelling on both
# sides, so a ’ swapped for a ' isn't reported as a change.
python3 - "$work/thesis" "$work/revised" <<'PY'
import pathlib, re, sys
def figure(m):
    name, caption = m.group(1), m.group(2)
    return ("\\begin{figure}[htbp]\n  \\centering\n"
            "  {\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{0.4pt}\\color{line}%\n"
            "   \\fbox{\\includegraphics[width=\\dimexpr\\linewidth-0.8pt\\relax]{screenshots/" + name + "}}}\n"
            "  \\caption{" + caption + "}\\label{fig:" + name + "}\n\\end{figure}")
TEX = {"’": "'", "‘": "`", "“": "``", "”": "''", "—": "---", "–": "--"}
for root in sys.argv[1:]:
    for path in pathlib.Path(root).glob("*/*.tex"):
        text = path.read_text()
        for glyph, tex in TEX.items():
            text = text.replace(glyph, tex)
        path.write_text(re.sub(r"\\screenshot\{([^}]*)\}\{([^}]*)\}", figure, text))
PY

cd "$work/revised"
# Headings are diffed whole: matched word by word, a new heading can swallow a deleted paragraph
latexdiff --flatten --type=CCHANGEBAR --subtype=COLOR --driver=xetex --math-markup=whole --graphics-markup=both \
  --exclude-textcmd="chapter,section,subsection,subsubsection,paragraph" \
  --config="PICTUREENV=(?:picture|tikzpicture|DIFnomarkup|algorithm|axis|table|longtable)[\w\d*@]*" \
  ../thesis/main.tex main.tex > diff.tex 2> latexdiff.log
python3 - diff.tex <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1]); text = path.read_text()
# Deletions struck through as well as red, so they read as removed even in grayscale
red = "\\providecommand{\\DIFdeltex}[1]{\\protect\\cbdelete{\\protect\\color{red}#1}\\protect\\cbdelete}"
assert red in text, "latexdiff's deletion style changed: update diff.sh"
text = text.replace(red, red.replace("\\color{red}#1", "\\color{red}\\protect\\sout{#1}"))
# latexdiff comments deleted headings out; show them as struck-through bold lines instead
def heading(line):
    start = line.index("{", line.index("section") if "section" in line else line.index("chapter")) + 1
    depth, end = 1, start
    while depth:
        depth += {"{": 1, "}": -1}.get(line[end], 0); end += 1
    return line + "\n\\par\\DIFdel{\\textbf{" + line[start:end - 1] + "}}\\par"
lines = text.split("\n")
for i, line in enumerate(lines):
    if re.search(r"%DIFDELCMD < \\(?:(?:sub)*section|chapter)\*?\{", line):
        lines[i] = heading(line)
text = "\n".join(lines)
text = text.replace("%DIF PREAMBLE EXTENSION ADDED BY LATEXDIFF",
                    "\\RequirePackage[normalem]{ulem}\n%DIF PREAMBLE EXTENSION ADDED BY LATEXDIFF", 1)
guide = r"""
\chapter*{How to Read This Comparison}
This document is the revised thesis with every change against the defended edition marked.
\begin{itemize}
  \item \textcolor{blue}{Blue text} was added or rewritten in the revision.
  \item \textcolor{red}{\sout{Red, struck-through text}} was removed; a removed heading appears as a struck-through line in bold.
  \item A bar in the margin marks every changed paragraph, figure, table and algorithm: scan the margins to find the changes.
  \item New figures and screenshots have blue captions and a blue frame; removed figures are shown small and crossed out.
\end{itemize}
Chapters~1 and~2 changed little: the specific objectives, the scope, and corrections to citations. Chapters~3 to~7 hold most of the revisions requested by the panel. The Revision Summary that follows lists each revision with the section and page that address it.
\clearpage
"""
text = text.replace("\\end{titlepage}", "\\end{titlepage}\n" + guide, 1)
path.write_text(text)
PY
for pass in 1 2 3 4; do   # changebar needs a pass more than the cross-references
  xelatex -interaction=nonstopmode diff.tex > "xelatex-$pass.log" 2>&1 || true
  if [ "$pass" = 1 ]; then bibtex diff > /dev/null 2>&1 || true; fi
done
grep -E "^! " xelatex-3.log | head -5 || true
cp diff.pdf "$here/diff.pdf"

# Changed pages: those with blue or red marks. The title page and the guide are always kept.
pdftoppm -r 30 diff.pdf page
keep=$(python3 - page-*.ppm <<'PY'
import sys
def marked(path):
    data = open(path, "rb").read()
    _, size, _, pixels = data.split(b"\n", 3)
    hits = 0
    for i in range(0, len(pixels) - 2, 3):
        r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
        if b - max(r, g) > 80 or r - max(g, b) > 80:
            hits += 1
    return hits > 3   # an unchanged page has none: hidelinks, black change bars
pages = [n + 1 for n, path in enumerate(sorted(sys.argv[1:])) if n < 2 or marked(path)]
print(",".join(map(str, pages)))
PY
)
qpdf diff.pdf --pages diff.pdf "$keep" -- "$here/diff-changes.pdf" || [ $? -eq 3 ]   # 3: written, with warnings
echo "diff.pdf: $(pdfinfo diff.pdf | awk '/^Pages:/{print $2}') pages; diff-changes.pdf: $(pdfinfo "$here/diff-changes.pdf" | awk '/^Pages:/{print $2}') pages"
