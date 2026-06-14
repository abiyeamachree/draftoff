"""DraftOff realtime backend.

Authoritative, in-memory lobby/draft state served over Socket.IO.
The DB layer (Postgres) is added later; for now everything lives in memory,
which is exactly how live gameplay state is meant to be served (see PLAN.md §2.2).
"""
