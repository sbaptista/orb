'use client'

export default function PrintStyles() {
  return (
    <style>{`
      /* ── Print page setup ── */
      @media print {
        @page {
          size: 8.5in 11in;
          margin: 0.6in 0.5in;
        }

        body {
          background: white !important;
          color: #1a1a1a !important;
          font-size: 11pt !important;
          line-height: 1.45 !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        /* Hide all web chrome */
        header, nav, footer, .no-print, button, .dash-nav, .sl-topbar,
        .orb-container, .orb-input-row, .orb-conversation, .dash-version,
        .print-actions, .skip-link { display: none !important; }
      }

      /* ── Hide root layout elements on print page ── */
      .skip-link { display: none !important; }

      /* ── Screen preview ── */
      .print-root {
        background: white;
        color: #1a1a1a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
        max-width: 8.5in;
        margin: 0 auto;
        padding: 0.6in 0.5in;
        min-height: 100vh;
      }

      /* ── Page header ── */
      .print-page-header {
        border-bottom: 2px solid #2d5a2d;
        padding-bottom: 8pt;
        margin-bottom: 24pt;
      }
      .print-page-header h1 {
        font-size: 22pt;
        font-weight: 700;
        color: #2d5a2d;
        margin: 0 0 4pt 0;
      }
      .print-page-header .print-meta {
        font-size: 10pt;
        color: #666;
      }

      /* ── Project section ── */
      .print-project {
        margin-bottom: 28pt;
      }
      .print-project-header {
        border-bottom: 1.5pt solid #2d5a2d;
        padding-bottom: 4pt;
        margin-bottom: 12pt;
      }
      .print-project-header h2 {
        font-size: 16pt;
        font-weight: 700;
        color: #2d5a2d;
        margin: 0;
      }
      .print-project-header .print-project-desc {
        font-size: 10pt;
        color: #555;
        margin-top: 2pt;
      }

      /* ── Status group heading ── */
      .print-status-group {
        margin-bottom: 16pt;
      }
      .print-status-group h3 {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #555;
        margin: 0 0 8pt 0;
        padding-bottom: 3pt;
        border-bottom: 0.5pt solid #ddd;
      }

      /* ── Todo card ── */
      .print-todo {
        padding: 6pt 0;
        border-bottom: 0.5pt solid #eee;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .print-todo:last-child {
        border-bottom: none;
      }
      .print-todo-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12pt;
      }
      .print-todo-ref {
        font-family: 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 9pt;
        font-weight: 700;
        color: #2d5a2d;
        white-space: nowrap;
      }
      .print-todo-title {
        font-size: 11pt;
        font-weight: 600;
        color: #1a1a1a;
        flex: 1;
      }
      .print-todo-badges {
        display: flex;
        gap: 8pt;
        align-items: baseline;
        flex-shrink: 0;
      }
      .print-badge {
        font-size: 9pt;
        color: #555;
      }
      .print-badge-status {
        font-weight: 600;
        text-transform: capitalize;
      }

      /* ── Todo details ── */
      .print-todo-description {
        font-size: 10pt;
        color: #333;
        margin-top: 3pt;
        padding-left: 0;
        white-space: pre-wrap;
      }
      .print-todo-resolution {
        font-size: 10pt;
        color: #444;
        margin-top: 4pt;
        padding: 4pt 8pt;
        border-left: 2pt solid #2d5a2d;
        background: #f8faf8;
        white-space: pre-wrap;
      }
      .print-todo-resolution-label {
        font-size: 9pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #2d5a2d;
        margin-bottom: 2pt;
      }
      .print-todo-dates {
        font-size: 9pt;
        color: #777;
        margin-top: 3pt;
      }

      /* ── Summary footer ── */
      .print-summary {
        margin-top: 32pt;
        padding-top: 12pt;
        border-top: 2px solid #2d5a2d;
      }
      .print-summary h2 {
        font-size: 14pt;
        font-weight: 700;
        color: #2d5a2d;
        margin: 0 0 8pt 0;
      }
      .print-summary-row {
        display: flex;
        justify-content: space-between;
        font-size: 10pt;
        padding: 3pt 0;
        border-bottom: 0.5pt solid #eee;
      }
      .print-summary-row:last-child {
        border-bottom: none;
      }
      .print-summary-total {
        font-weight: 700;
        padding-top: 6pt;
        border-top: 1pt solid #ccc;
        margin-top: 4pt;
      }

      /* ── Print action bar (screen only) ── */
      .print-actions {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: #2d5a2d;
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .print-actions button {
        background: white;
        color: #2d5a2d;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
      }
      .print-actions button:hover {
        background: #f0f4f0;
      }

      @media print {
        .print-root {
          max-width: none;
          padding: 0;
          min-height: auto;
        }
        .print-todo-resolution {
          background: none;
        }
      }
    `}</style>
  )
}
