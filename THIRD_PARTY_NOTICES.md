# Third-party notices

PDF Chef uses the following third-party packages in its browser build. Versions and license
identifiers below were read from the installed packages' `package.json` files; this file does
not reproduce license text. See each package's distribution or project page for the complete
license and attribution terms.

| Package | Version | License | Project |
| --- | ---: | --- | --- |
| [@aiden0z/pptx-renderer](https://github.com/aiden0z/pptx-renderer) | 1.1.0 | Apache-2.0 | PPTX slide rendering |
| [ECharts](https://echarts.apache.org) | 6.1.0 | Apache-2.0 | Charts and visual summaries |
| [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) | 3.11.174 | Apache-2.0 | PDF parsing and rendering |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 7.0.0 | Apache-2.0 | Browser OCR |
| [Tesseract.js English data](https://github.com/naptha/tessdata) (`@tesseract.js-data/eng`) | 1.0.0 | MIT | Locally bundled English OCR model |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | MIT OR GPL-3.0-or-later | ZIP exports and Office packages |
| [html2canvas](https://html2canvas.hertzen.com) | 1.4.1 | MIT | Browser canvas capture |
| [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT | PDF generation |
| [pdf-lib](https://pdf-lib.js.org) | 1.17.1 | MIT | PDF editing and form output |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.1 | MIT | Font embedding support |
| [qpdf-run](https://github.com/RabbitHols/qpdf-run) | 0.2.1 | MIT | Browser wrapper for QPDF/WASM |
| [React](https://react.dev) and `react-dom` | 18.3.1 | MIT | User interface runtime |
| `react-router-dom` | 6.30.6 | MIT | Client-side routing |
| [Framer Motion](https://motion.dev) (`framer-motion`) | 12.38.0 | MIT | UI transitions |
| [Lucide](https://lucide.dev) (`lucide-react`) | 0.344.0 | ISC | Interface icons |
| `uuid` | 14.0.2 | MIT | Local record identifiers |

## Fonts

The app bundles these Fontsource packages. Their package metadata identifies the fonts as
[SIL Open Font License 1.1 (OFL-1.1)](https://openfontlicense.org/):

- [Manrope](https://fontsource.org/fonts/manrope), `@fontsource-variable/manrope` 5.2.8
- [Inter](https://fontsource.org/fonts/inter), `@fontsource-variable/inter` 5.3.0
- [Noto Sans](https://fontsource.org/fonts/noto-sans), `@fontsource/noto-sans` 5.2.8
- [Cormorant Garamond](https://fontsource.org/fonts/cormorant-garamond), `@fontsource/cormorant-garamond` 5.2.8

The package-specific license files distributed with dependencies remain the authoritative
notices for those dependencies.

## qpdf-run and QPDF

`qpdf-run` declares the MIT license in its installed `package.json` and `LICENSE` file. It
vendors the QPDF browser WASM runtime under `vendor/qpdf/`; that vendored QPDF engine is a
separate work, licensed under the [Apache License 2.0](https://qpdf.sourceforge.io/). The
wrapper's MIT license does not replace or change QPDF's Apache 2.0 terms. The installed
package's `vendor/README.md` identifies these assets as vendored qpdf runtime files; consult
the upstream QPDF project and the package distribution for the complete notices.
