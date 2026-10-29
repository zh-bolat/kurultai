#!/usr/bin/env python3
"""Build the offline map asset from galymorg/new_qazaqstan_GeoJSON regions.json."""

import json
import sys
from pathlib import Path


NAMES = {
    "KZ10": "Область Абай",
    "KZ11": "Акмолинская область",
    "KZ15": "Актюбинская область",
    "KZ19": "Алматинская область",
    "KZ23": "Атырауская область",
    "KZ27": "Западно-Казахстанская область",
    "KZ31": "Жамбылская область",
    "KZ33": "Область Жетісу",
    "KZ35": "Карагандинская область",
    "KZ39": "Костанайская область",
    "KZ43": "Кызылординская область",
    "KZ47": "Мангистауская область",
    "KZ55": "Павлодарская область",
    "KZ59": "Северо-Казахстанская область",
    "KZ61": "Туркестанская область",
    "KZ62": "Область Ұлытау",
    "KZ63": "Восточно-Казахстанская область",
    "KZ71": "Астана",
    "KZ75": "Алматы",
    "KZ79": "Шымкент",
}

SCORES = {
    "KZ10": 73.9, "KZ11": 80.3, "KZ15": 75.6, "KZ19": 83.6,
    "KZ23": 79.2, "KZ27": 82.1, "KZ31": 74.2, "KZ33": 74.8,
    "KZ35": 84.7, "KZ39": 76.8, "KZ43": 69.1, "KZ47": 68.4,
    "KZ55": 85.2, "KZ59": 77.4, "KZ61": 72.9, "KZ62": 71.8,
    "KZ63": 77.5, "KZ71": 92.1, "KZ75": 89.6, "KZ79": 81.3,
}


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: generate_map_data.py regions.json output.js")
    regions = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if len(regions) != 20 or {r["pcode"] for r in regions} != set(NAMES):
        raise SystemExit("unexpected region set in source GeoJSON data")

    output = []
    for region in regions:
        code = region["pcode"]
        score = SCORES[code]
        output.append({
            "name": NAMES[code],
            "code": code,
            "kind": "city" if code in {"KZ71", "KZ75", "KZ79"} else "region",
            "score": score,
            "level": "high" if score >= 80 else "mid" if score >= 72 else "low",
            "cx": region["cx"],
            "cy": region["cy"],
            "path": region["path"],
        })

    header = (
        "// Geometry: galymorg/new_qazaqstan_GeoJSON (MIT), based on "
        "arodionoff/geokz 2024 (CC BY 4.0).\n"
    )
    Path(sys.argv[2]).write_text(
        header + "window.KZ_MAP_REGIONS=" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
