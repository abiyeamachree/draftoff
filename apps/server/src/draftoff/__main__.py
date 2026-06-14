"""Run the realtime server: `python -m draftoff`."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    port = int(os.environ.get("SERVER_PORT", "4000"))
    reload = os.environ.get("RELOAD", "").lower() in {"1", "true", "yes"}
    uvicorn.run("draftoff.app:asgi", host="0.0.0.0", port=port, reload=reload)


if __name__ == "__main__":
    main()
