const PDFDocument = require("pdfkit");

/**
 * exportUtils.js
 *
 * Produces JSON, CSV and PDF exports from a shaped export payload.
 *
 * Expected input shape (from frontend sectionExport.js):
 *   {
 *     section:    string,   // e.g. "metrics"
 *     title:      string,   // e.g. "Repository Metrics"
 *     exportedAt: string,   // ISO timestamp
 *     payload:    object,   // section-specific shaped data
 *   }
 *
 * Falls back gracefully to a generic flat-render if the payload
 * doesn't match the expected shape so old callers keep working.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recursively flatten a nested object into key=value rows.
 * Arrays of primitives are joined; arrays of objects become
 * multiple rows prefixed with [0], [1], etc.
 */
function flattenToRows(obj, prefix = "") {
  const rows = [];

  for (const key of Object.keys(obj)) {
    const val  = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (val === null || val === undefined) {
      rows.push({ key: path, value: "" });
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        rows.push({ key: path, value: "(empty)" });
      } else if (typeof val[0] === "object" && val[0] !== null) {
        val.forEach((item, i) => {
          rows.push(...flattenToRows(item, `${path}[${i}]`));
        });
      } else {
        rows.push({ key: path, value: val.join(", ") });
      }
    } else if (typeof val === "object") {
      rows.push(...flattenToRows(val, path));
    } else {
      rows.push({ key: path, value: String(val) });
    }
  }

  return rows;
}

/** Escape a CSV cell value */
function csvCell(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * generateCsv(data)
 *
 * If `data` has { section, title, exportedAt, payload } structure:
 *   → produces a two-column "Metric, Value" CSV with a metadata header block.
 * Otherwise falls back to the original generic flat-render.
 */
function generateCsv(data) {
  const lines = [];

  // Detect shaped payload
  if (data && data.section && data.payload) {
    const { title, section, exportedAt, payload } = data;

    // Metadata block
    lines.push(`# ${csvCell(title)}`);
    lines.push(`# Section:,${csvCell(section)}`);
    lines.push(`# Exported At:,${csvCell(exportedAt)}`);
    lines.push("");
    lines.push("Metric,Value");

    const rows = flattenToRows(payload);
    for (const { key, value } of rows) {
      lines.push(`${csvCell(key)},${csvCell(value)}`);
    }

    return lines.join("\n");
  }

  // ── Fallback: original generic behaviour ──────────────────────────────────
  lines.push("Metric,Value");
  const flatten = (obj, prefix = "") => {
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          lines.push(`"${prefix}${key}","[Array ${obj[key].length} items]"`);
        } else {
          flatten(obj[key], `${prefix}${key}.`);
        }
      } else {
        const val = String(obj[key] ?? "").replace(/"/g, '""');
        lines.push(`"${prefix}${key}","${val}"`);
      }
    }
  };
  flatten(data);
  return lines.join("\n");
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const BRAND_PURPLE = "#A855F7";
const TEXT_DARK    = "#1E1B4B";
const TEXT_MUTED   = "#64748B";
const TEXT_VALUE   = "#334155";

/**
 * Write a top-level section header inside the PDF.
 */
function pdfSectionHeader(doc, title) {
  doc.moveDown(1);
  doc
    .fontSize(13)
    .fillColor(BRAND_PURPLE)
    .text(title.toUpperCase(), { underline: false });
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor(BRAND_PURPLE)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.6);
}

/**
 * Write a key / value row.
 */
function pdfRow(doc, key, value) {
  doc
    .fontSize(10)
    .fillColor(TEXT_MUTED)
    .text(`${key}:  `, { continued: true })
    .fillColor(TEXT_VALUE)
    .text(String(value ?? "—"));
}

/**
 * Recursively render a shaped payload object into the PDF.
 * Top-level keys become section headers; nested keys become rows.
 */
function renderPayload(doc, obj, depth = 0) {
  for (const key of Object.keys(obj)) {
    const val  = obj[key];
    const label = key.replace(/_/g, " ");

    if (val === null || val === undefined) {
      if (depth === 0) pdfSectionHeader(doc, label);
      else pdfRow(doc, label, "—");
    } else if (Array.isArray(val)) {
      if (depth === 0) pdfSectionHeader(doc, label);
      if (val.length === 0) {
        pdfRow(doc, "  (empty)", "");
      } else if (typeof val[0] === "object") {
        val.forEach((item, i) => {
          doc.fontSize(10).fillColor(TEXT_MUTED).text(`  [${i + 1}]`, { indent: 10 });
          renderPayload(doc, item, depth + 2);
        });
      } else {
        pdfRow(doc, "  values", val.join(", "));
      }
    } else if (typeof val === "object") {
      if (depth === 0) pdfSectionHeader(doc, label);
      else {
        doc.fontSize(11).fillColor(TEXT_DARK).text(`  ${label}`, { indent: depth * 8 });
        doc.moveDown(0.2);
      }
      renderPayload(doc, val, depth + 1);
    } else {
      pdfRow(doc, `${"  ".repeat(depth)}${label}`, val);
    }
  }
}

/**
 * generatePdf(data)
 *
 * If `data` has { section, title, exportedAt, payload } structure:
 *   → Renders a branded PDF with section-grouped content.
 * Otherwise falls back to the original generic renderer.
 */
function generatePdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end",  ()      => resolve(Buffer.concat(chunks)));

      // ── Title block ────────────────────────────────────────────────────────
      const title = (data && data.title) ? data.title : "Repository Analysis Report";

      doc.fontSize(22).fillColor(BRAND_PURPLE).text(title, { align: "center" });
      doc.moveDown(0.4);

      if (data && data.section) {
        doc.fontSize(10).fillColor(TEXT_MUTED).text(
          `Section: ${data.section}  ·  Exported: ${new Date(data.exportedAt).toLocaleString()}`,
          { align: "center" }
        );
      } else {
        doc.fontSize(10).fillColor(TEXT_MUTED).text(
          `Generated on: ${new Date().toLocaleString()}`,
          { align: "center" }
        );
      }

      doc.moveDown(1.5);

      // ── Body ───────────────────────────────────────────────────────────────
      if (data && data.payload) {
        renderPayload(doc, data.payload, 0);
      } else {
        // Fallback: original generic recursive render
        const renderNode = (obj, indent = 0) => {
          for (const key in obj) {
            if (typeof obj[key] === "object" && obj[key] !== null) {
              if (Array.isArray(obj[key])) continue;
              doc.moveDown(0.5);
              doc.fontSize(14).fillColor("#333333").text(key.toUpperCase(), { indent });
              doc.moveDown(0.2);
              renderNode(obj[key], indent + 20);
            } else {
              doc
                .fontSize(12)
                .fillColor("#475569")
                .text(`${key}: `, { indent, continued: true })
                .fillColor("#000000")
                .text(`${obj[key]}`);
            }
          }
        };
        renderNode(data);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCsv, generatePdf };
