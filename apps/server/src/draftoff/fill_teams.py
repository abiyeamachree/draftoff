"""Parse fill-team labels (clubs vs national teams)."""

from __future__ import annotations

import re

FILL_NT_PREFIX = "NT: "
_LABEL_RE = re.compile(r"^(.+) \(([^)]+)\)$")


def parse_fill_label(label: str) -> tuple[str, str, str]:
    """Return (name, season, kind) where kind is 'nation' or 'club'."""
    trimmed = (label or "").strip()
    if trimmed.startswith(FILL_NT_PREFIX):
        rest = trimmed[len(FILL_NT_PREFIX) :].strip()
        m = _LABEL_RE.match(rest)
        if m:
            return m.group(1).strip(), m.group(2).strip(), "nation"
        return rest, "", "nation"
    m = _LABEL_RE.match(trimmed)
    if m:
        return m.group(1).strip(), m.group(2).strip(), "club"
    return trimmed, "", "club"
