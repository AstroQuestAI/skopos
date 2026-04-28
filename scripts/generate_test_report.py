#!/usr/bin/env python3
from __future__ import annotations

import html
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: generate_test_report.py <junit_xml> [<junit_xml> ...] <output_html>")
        return 2

    xml_paths = [Path(arg) for arg in sys.argv[1:-1]]
    out_path = Path(sys.argv[-1])

    rows: list[str] = []
    total = failures = errors = skipped = 0
    duration = 0.0

    for xml_path in xml_paths:
        root = ET.parse(xml_path).getroot()
        suites = root.findall("testsuite")
        if root.tag == "testsuite":
            suites = [root]

        for suite in suites:
            total += int(float(suite.attrib.get("tests", "0")))
            failures += int(float(suite.attrib.get("failures", "0")))
            errors += int(float(suite.attrib.get("errors", "0")))
            skipped += int(float(suite.attrib.get("skipped", "0")))
            duration += float(suite.attrib.get("time", "0") or 0.0)

            for case in suite.findall("testcase"):
                name = case.attrib.get("name", "")
                classname = case.attrib.get("classname", "")
                time_s = case.attrib.get("time", "0")
                status = "passed"
                detail = ""
                if case.find("failure") is not None:
                    status = "failed"
                    detail = case.find("failure").attrib.get("message", "") if case.find("failure") is not None else ""
                elif case.find("error") is not None:
                    status = "error"
                    detail = case.find("error").attrib.get("message", "") if case.find("error") is not None else ""
                elif case.find("skipped") is not None:
                    status = "skipped"
                    detail = case.find("skipped").attrib.get("message", "") if case.find("skipped") is not None else ""

                rows.append(
                    "<tr>"
                    f"<td>{html.escape(str(xml_path))}</td>"
                    f"<td>{html.escape(classname)}</td>"
                    f"<td>{html.escape(name)}</td>"
                    f"<td>{html.escape(status)}</td>"
                    f"<td>{html.escape(time_s)}</td>"
                    f"<td>{html.escape(detail)}</td>"
                    "</tr>"
                )

    passed = max(0, total - failures - errors - skipped)
    summary_class = "good" if failures == 0 and errors == 0 else "bad"
    artifact_candidates = [
        Path("artifacts/omnivoice-telugu-3way-60s-demo.mp4"),
        Path("artifacts/omnivoice-telugu-3way-60s-voice.wav"),
        Path("artifacts/omnivoice-telugu-3way-60s-script.txt"),
        Path("artifacts/omnivoice-telugu-3way-60s-transcript.json"),
        Path("artifacts/omnivoice-telugu-3way-60s-test.xml"),
        Path("artifacts/google-omni-60s-demo.mp4"),
        Path("artifacts/google-omni-60s-voice.wav"),
        Path("artifacts/google-omni-60s-script.txt"),
        Path("artifacts/google-omni-60s-transcript.json"),
        Path("artifacts/google-omni-60s-test.xml"),
        Path("artifacts/dialect-call-30s-demo.mp4"),
        Path("artifacts/dialect-call-30s-script.txt"),
        Path("artifacts/real-call-60s-demo.mp4"),
        Path("artifacts/real-call-60s-script.txt"),
        Path("artifacts/real-call-60s-test.xml"),
        Path("artifacts/multilingual-dialect-60s-demo.mp4"),
        Path("artifacts/multilingual-dialect-voice.wav"),
        Path("artifacts/multilingual-dialect-script.txt"),
        Path("artifacts/multilingual-dialect-transcript.json"),
        Path("artifacts/multilingual-dialect-60s-test.xml"),
        Path("artifacts/multilingual-dialect-30s-demo.mp4"),
        Path("artifacts/multilingual-dialect-30s-test.xml"),
        Path("android-test-app/app/build/reports/androidTests/connected/debug/index.html"),
        Path("artifacts/test-report.html"),
    ]
    artifact_links: list[str] = []
    for artifact in artifact_candidates:
        if artifact.exists():
            href = html.escape(str(artifact.resolve()))
            label = html.escape(artifact.name)
            artifact_links.append(f'<li><a href="{href}">{label}</a> <code>{href}</code></li>')

    html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Test Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; margin: 24px; }}
    h1 {{ margin-bottom: 8px; }}
    .summary {{ padding: 12px; border-radius: 8px; margin-bottom: 16px; }}
    .good {{ background: #e8f7e8; }}
    .bad {{ background: #fdeaea; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; font-size: 13px; text-align: left; }}
    th {{ background: #f4f6f8; }}
    tr:nth-child(even) {{ background: #fafafa; }}
    code {{ background: #f4f4f4; padding: 2px 5px; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>Combined Test Report</h1>
  <div class="summary {summary_class}">
    <strong>Total:</strong> {total} |
    <strong>Passed:</strong> {passed} |
    <strong>Failed:</strong> {failures} |
    <strong>Errors:</strong> {errors} |
    <strong>Skipped:</strong> {skipped} |
    <strong>Duration:</strong> {duration:.3f}s
  </div>
  <p>Source XMLs: {''.join(f'<code>{html.escape(str(path))}</code> ' for path in xml_paths)}</p>
  <h2>Demo Artifacts</h2>
  <ul>
    {''.join(artifact_links) if artifact_links else '<li>No demo artifacts found.</li>'}
  </ul>
  <table>
    <thead>
      <tr>
        <th>Source</th>
        <th>Class</th>
        <th>Test</th>
        <th>Status</th>
        <th>Time (s)</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>
      {''.join(rows)}
    </tbody>
  </table>
</body>
</html>
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html_doc, encoding="utf-8")
    print(f"wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
