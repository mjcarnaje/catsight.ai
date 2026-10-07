# CatSight AI thesis (revised edition)

The defended thesis, revised after the panel's comments and rewritten in LaTeX.
The revision table at the front of [main.pdf](main.pdf) lists every requested change
and the section that addresses it.

## Build

```sh
./build.sh        # XeLaTeX -> BibTeX -> XeLaTeX x2, writes main.pdf
```

Needs a TeX Live 2025 installation with `algorithm2e`, `tocloft`, `makecell`, `multirow`,
`placeins`, `cleveref` and `pgfplots` (`tlmgr --usermode install ...`), plus the Times New
Roman and STIX Two Math fonts that ship with macOS.

## What changed since the defense

The commit before this one ("docs(thesis): defended edition in LaTeX") is the defended
paper converted from the Google Docs export with the same files and conventions, so

```sh
git diff HEAD~1 -- thesis/chapters      # every change, chapter by chapter
./diff.sh                              # regenerate diff.pdf (needs latexdiff)
```

[diff.pdf](diff.pdf) is the revised paper with additions underlined in blue and deletions
struck through in red.

## Layout

| Path | Contents |
|---|---|
| `main.tex` | Preamble (A4, 12 pt Times, double spacing, APA-style captions) and document order |
| `frontmatter/` | Title page, revision summary, abstract |
| `chapters/` | Chapters 1-7; `algorithms.tex` holds Algorithms 1-6 |
| `figures/` | TikZ and pgfplots sources of every diagram and chart |
| `screenshots/` | Screenshots of the deployed system (light theme, 1440 x 900 window) |
| `appendices/` | Personal vitae |
| `references.bib` | Bibliography, rebuilt from the in-text citations |

## Where the results come from

- **Converter comparison** (Table 6.1): seven of the 50 sample PDFs, 67 facts read from
  the page images, run on a laptop GPU in October 2026 with Marker 2.0, Docling 2.134,
  MarkItDown 0.1.8 and Qwen3-VL-30B-A3B-Instruct through OpenRouter.
- **Library, search, chat and timings**: the deployed system after the 48 documents
  were reprocessed with Marker 2 and the open-weight models, October 2026.
- **Usability** (SUS 77.17 vs 50.33): the evaluation of the defended prototype, from the
  defended abstract.

## Still needed from the proponents

Search the PDF for `[TODO` (shown in maroon):

- Retrieval accuracy (P@5, R@5, MRR) against IIT Docs, and the test-question protocol
- ROUGE, BLEU and BERTScore against human-written reference summaries
- Number and roles of the SUS participants
- Personal vitae (Appendix B)
- Check `references.bib` against the original Appendix A; 13 entries carry an
  "Unverified" note

## Citation corrections made while rebuilding the bibliography

- "Macdonald & Tait (2020)" does not exist; each use now cites a real source for its claim
  (Manning et al., 2008; Zhu et al., 2023; Lewis et al., 2020).
- "Blair (n.d.)" and "Blaire et al. (n.d.)" are Blair & Maron (1985), the source of the
  quoted passage; "Clark et al. (n.d.)" is Clark & Divvala (2015).
- "MacDonald & Tonelleto" is Macdonald & Tonellotto (2020).
- Table 2.1 author initials: Huh, J., Park, H. J., & Ye, J. C. (2023); Hsain, A., &
  El Housni, H. (2024); Suh, J. Y., Kwak, M., Kim, S. Y., & Cho, H. (2024); Pandya, K., &
  Holia, M. (2023).
