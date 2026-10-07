#!/usr/bin/env bash
# diff.pdf: the defended edition (the commit "docs(thesis): defended edition in LaTeX")
# against this revision, with additions underlined and deletions struck through.
set -euo pipefail
cd "$(dirname "$0")"
base=$(git log --format=%H --grep="defended edition in LaTeX" -n 1)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git archive "$base" thesis | tar -x -C "$work"
mkdir -p "$work/revised" && cp -R . "$work/revised/" && cp -R "$work/thesis/figures/defended" "$work/revised/figures/"
cd "$work/revised"
latexdiff --flatten --type=UNDERLINE --math-markup=whole \
  --config="PICTUREENV=(?:picture|tikzpicture|DIFnomarkup|algorithm|axis|figure|table|longtable)[\w\d*@]*" \
  ../thesis/main.tex main.tex > diff.tex 2> /dev/null
for pass in 1 2 3; do
  xelatex -interaction=nonstopmode diff.tex > /dev/null 2>&1 || true
  [ "$pass" = 1 ] && bibtex diff > /dev/null 2>&1 || true
done
cp diff.pdf "$OLDPWD/diff.pdf"
echo "diff.pdf: $(pdfinfo diff.pdf | awk '/^Pages:/{print $2}') pages"
