# PDF export dependencies

These pinned browser distributions load only when PDF export is requested.

- `html2canvas-1.4.1.min.js`: html2canvas 1.4.1, from https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js. MIT license in `html2canvas-LICENSE.txt`.
- `jspdf-4.2.1.umd.min.js`: jsPDF 4.2.1, from https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js. MIT license included in the distribution header.

Hosting these files alongside the application avoids a third-party CDN request during export.
