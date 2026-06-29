"""Random group draw with confederation caps (max 2 per group, OFC max 1)."""

from __future__ import annotations

import random

from .confederations import MAX_PER_GROUP


def draw_groups(
    user_ids: list[str],
    confederations: dict[str, str | None],
    *,
    group_size: int = 4,
    max_attempts: int = 2000,
) -> list[list[str]] | None:
    n = len(user_ids)
    if n < 2:
        return [list(user_ids)] if user_ids else []
    n_groups = (n + group_size - 1) // group_size

    for _ in range(max_attempts):
        groups: list[list[str]] = [[] for _ in range(n_groups)]
        counts: list[dict[str, int]] = [{c: 0 for c in MAX_PER_GROUP} for _ in range(n_groups)]
        order = list(user_ids)
        random.shuffle(order)
        ok = True

        for uid in order:
            conf = confederations.get(uid)
            options: list[int] = []
            for gi, group in enumerate(groups):
                if len(group) >= group_size:
                    continue
                if conf and conf in MAX_PER_GROUP:
                    if counts[gi][conf] >= MAX_PER_GROUP[conf]:
                        continue
                options.append(gi)
            if not options:
                ok = False
                break
            gi = random.choice(options)
            groups[gi].append(uid)
            if conf and conf in MAX_PER_GROUP:
                counts[gi][conf] += 1

        if not ok:
            continue
        if any(len(g) > group_size for g in groups):
            continue
        if sum(len(g) for g in groups) != n:
            continue
        return groups

    return None
