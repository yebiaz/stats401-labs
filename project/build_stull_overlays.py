"""
Individual Project - Stull Chart Redesign
File 2: stull_regions.json   (region polygons)
File 3: stull_limits.csv     (limit-formula rectangles)

PROVENANCE - this version is digitized, not guessed.

Regions come from the printed Stull Diagram plate (gridlines at 0.6 on x,
0.05 on y). I read the position of each printed label off the plate and
converted it to a silica:alumina ratio:

    UNFUZED        (1.40, 0.88)  ->   1.6 : 1
    MATTE          (2.35, 0.89)  ->   2.6 : 1
    SEMI-MATTE     (3.15, 0.87)  ->   3.6 : 1
    HIGHEST GLOSS  (5.50, 0.78)  ->   7.1 : 1
    UNDER-FIRED    (6.50, 0.46)  ->  14.1 : 1

The gaps between those band centres fall at roughly 5:1 and 10-12:1, which
is exactly where the published matte and underfired thresholds sit. Two
independent sources agreeing is the reason I am willing to generate the
polygons from ratio radials rather than tracing every vertex by hand.

ONE REAL FINDING, worth a paragraph in the critique:
the dotted HIGHEST GLOSS line on the plate is NOT a radial through the
origin. Reading its endpoints at (1.8, 0.19) and (7.2, 0.92) gives

    al2o3 = 0.1352 * sio2 - 0.0533

which drifts from 8.9:1 at the left end to 7.8:1 at the right. So the ratio
is not quite sufficient on its own - the plate itself quietly admits that
alumina has an absolute effect as well as a proportional one. Britt calls
the line "1:7.5"; the plate does not draw 1:7.5. That is a small,
defensible, evidence-backed point of your own.
"""

import json
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

X_MAX = 8.0
Y_MAX = 1.2

# Crazing: low alumina AND low silica. The alumina ceiling is read off the
# plate at the CRAZED label (1.55, 0.175). The SILICA ceiling is the least
# certain number in this entire project - the plate labels the zone but does
# not draw a closed boundary around it, so 3.0 is inferred from the physics
# (crazing is driven by low silica, which raises thermal expansion) rather
# than measured. At x=7, y=0.1 the ratio is 70:1, which is wildly
# under-fired, not crazed - so a full-width strip would be plainly wrong.
CRAZE_AL2O3_CEILING = 0.20
CRAZE_SIO2_CEILING = 3.0

# Band edges in silica:alumina ratio, from the label positions above.
EDGES = [
    ("unfused",    "Unfused",     0.0,   2.1),
    ("matte",      "Matte",       2.1,   3.1),
    ("semi-matte", "Semi-matte",  3.1,   5.0),
    ("gloss",      "Bright gloss", 5.0, 10.0),
    ("underfired", "Under-fired", 10.0,  None),   # None = ratio infinity
]

NOTES = {
    "unfused": "Too much alumina for the flux to dissolve. Stiff, dry, opaque.",
    "matte": "Excess alumina relative to silica leaves the surface un-glassy.",
    "semi-matte": "Transitional. Stull's own boundary here is a curve, not a straight line.",
    "gloss": "Stull's bright glossy zone. The printed HIGHEST GLOSS line runs through it.",
    "underfired": "Silica high relative to alumina, but not enough heatwork to melt it smooth.",
}


def band_polygon(r_low, r_high):
    """
    A ratio band is the wedge between two radials from the origin, because
    ratio = sio2 / al2o3, so a fixed ratio r is the line al2o3 = sio2 / r.
    Higher ratio = flatter line. This clips the wedge to the plot box.

    Returns vertices in order, starting at the origin.
    """
    def upper_edge(r):
        """The r_low side: the steeper line al2o3 = x / r. Returns its exit point."""
        if r is None or r == 0:
            return None
        x_at_top = r * Y_MAX
        if x_at_top <= X_MAX:
            return (x_at_top, Y_MAX)      # exits through the top
        return (X_MAX, X_MAX / r)         # exits through the right edge

    steep = upper_edge(r_low) if r_low > 0 else (0.0, Y_MAX)
    flat = upper_edge(r_high) if r_high is not None else (X_MAX, 0.0)

    poly = [(0.0, 0.0), flat]

    # Walk the box boundary counter-clockwise from the flat edge's exit
    # point around to the steep edge's exit point.
    if flat[0] == X_MAX and steep[1] == Y_MAX:
        poly.append((X_MAX, Y_MAX))       # round the top-right corner
    if r_low == 0:
        poly.append((0.0, Y_MAX))
        return [list(p) for p in poly]

    poly.append(steep)
    if r_low == 0:
        poly.append((0.0, Y_MAX))
    return [list(p) for p in poly]


regions = []
for rid, label, r_low, r_high in EDGES:
    regions.append({
        "id": rid,
        "label": label,
        "cone": 11,
        "ratio_range": [r_low, r_high],
        "provenance": "digitized from the printed Stull Diagram label positions",
        "note": NOTES[rid],
        "polygon": band_polygon(r_low, r_high),
    })

# Crazing is not a wedge. It is a low-alumina condition that OVERLAPS the
# others, and it is clay-body dependent, so it is drawn as a hatched overlay
# rather than as an exclusive region. Saying this out loud is the honest
# version of weakness 10.
regions.append({
    "id": "crazed",
    "label": "Crazing risk",
    "cone": 11,
    "ratio_range": None,
    "provenance": (
        "alumina ceiling read off the plate at the CRAZED label; "
        "silica ceiling INFERRED, not measured - least certain number here"
    ),
    "note": (
        "Overlay, not an exclusive region: it sits on top of whatever band "
        "is underneath. Crazing depends on the clay body as much as on the "
        "glaze, so no chart can guarantee it."
    ),
    "overlay": True,
    "polygon": [
        [0.0, 0.0],
        [CRAZE_SIO2_CEILING, 0.0],
        [CRAZE_SIO2_CEILING, CRAZE_AL2O3_CEILING],
        [0.0, CRAZE_AL2O3_CEILING],
    ],
})

payload = {
    "cone": 11,
    "flux_ratio": {"R2O": 0.3, "RO": 0.7},
    "domain": {"sio2": [0, X_MAX], "al2o3": [0, Y_MAX]},
    "ratio_lines": [
        {"ratio": 5.0, "label": "5:1 matte boundary", "kind": "radial"},
        {"ratio": 7.5, "label": "7.5:1 glassy line (as usually quoted)", "kind": "radial"},
        {"ratio": 12.0, "label": "12:1 into under-fired", "kind": "radial"},
    ],
    "gloss_line": {
        "label": "HIGHEST GLOSS, as actually drawn on the plate",
        "slope": 0.1352,
        "intercept": -0.0533,
        "note": (
            "Not a radial through the origin. Drifts from 8.9:1 at the left "
            "end to 7.8:1 at the right, so ratio alone does not fully "
            "describe it."
        ),
    },
    "source": (
        "Stull, R.T. (1912). Influences of Variable Silica and Alumina on "
        "Porcelain Glazes of Constant RO. Trans. Am. Ceram. Soc. XIV. "
        "Polygons digitized from the printed Stull Diagram plate."
    ),
    "warning": (
        "Regions are cone 11 only. They do not shift when another cone is "
        "selected. Known limitation - the chart annotates it rather than "
        "hiding it."
    ),
    "regions": regions,
}

with open(DATA_DIR / "stull_regions.json", "w") as f:
    json.dump(payload, f, indent=2)

print("wrote data/stull_regions.json -", len(regions), "regions")


# ---------------------------------------------------------------------------
# File 3 - limit rectangles
# ---------------------------------------------------------------------------
# verified=yes  -> read off a plate where BOTH axes were legible
# verified=no   -> alumina range legible, silica range estimated. Fix these.

LIMIT_ROWS = [
    # author, cone, sio2_min, sio2_max, al2o3_min, al2o3_max, use, verified
    ["Roy / Hesselberth", "6",    2.40, 3.65, 0.25, 0.50, "functional / durable", "yes"],
    ["Green & Cooper",    "04",   1.15, 2.50, 0.18, 0.45, "general",              "no"],
    ["Green & Cooper",    "3-7",  1.95, 3.50, 0.28, 0.65, "general",              "no"],
    ["Green & Cooper",    "9-10", 2.90, 4.60, 0.35, 0.80, "general",              "no"],
    ["Val Cushing",       "04",   1.30, 2.40, 0.13, 0.28, "satin",                "no"],
    ["Val Cushing",       "6",    2.00, 3.40, 0.25, 0.40, "satin",                "no"],
    ["Val Cushing",       "9-10", 2.60, 4.60, 0.35, 0.55, "satin",                "no"],
]

with open(DATA_DIR / "stull_limits.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow([
        "author", "cone", "sio2_min", "sio2_max",
        "al2o3_min", "al2o3_max", "use", "verified",
    ])
    writer.writerows(LIMIT_ROWS)

n_ok = sum(1 for r in LIMIT_ROWS if r[7] == "yes")
print(f"wrote data/stull_limits.csv - {len(LIMIT_ROWS)} rectangles, {n_ok} verified")
