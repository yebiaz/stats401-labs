"""
Individual Project - Stull Chart Redesign
Data acquisition: Glazy bulk export -> stull_recipes.csv

Source: https://github.com/derekphilipau/glazy-data
        glazy-data-glazes-20211130.csv
License: CC BY-NC-SA 4.0 (Glazy / Derek Au). Attribution required.

This is the OFFICIAL public bulk export of the Glazy database, published by
Glazy's own creator. It is used instead of scraping glazy.org because
glazy.org/robots.txt has "Disallow: /api/" and "Disallow: /export/" for all
agents, and the recipe listing page is client-rendered (no table in the HTML
source). Lab 3 rule: if a source does not permit automated collection, use
another source. The bulk export IS that other source, and it is better data.
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

SOURCE = Path(__file__).parent / "glazy-data-glazes-20211130.csv"

# The columns we actually need. The file has 331; we want 16.
COLUMNS = [
    "id",
    "name",
    "material_type_concatenated",
    "surface_type",
    "transparency_type",
    "from_orton_cone",
    "to_orton_cone",
    "SiO2_umf",
    "Al2O3_umf",
    "B2O3_umf",
    "SiO2_Al2O3_ratio_umf",
    "R2O_umf",
    "RO_umf",
]

df = pd.read_csv(SOURCE, usecols=COLUMNS, low_memory=False)
print("raw rows:", len(df))


# ---------- clean 1: the cone column has HTML entities ----------
# Glazy stores half-cones as "5 &#189;" (the HTML entity for 1/2).
# Left alone these become their own category and break any numeric sort.
def clean_cone(value):
    if pd.isna(value):
        return pd.NA
    text = str(value).strip()
    text = text.replace("&#189;", ".5").replace("&frac12;", ".5")
    text = text.replace(" .5", ".5")
    return text


df["cone"] = df["from_orton_cone"].map(clean_cone)
df["cone_to"] = df["to_orton_cone"].map(clean_cone)


# Orton cones are not numbers: 06 is COLDER than 6. Map to an ordered scale
# so the cone selector can sort correctly.
def cone_to_ordinal(text):
    if pd.isna(text):
        return pd.NA
    text = str(text).strip()
    try:
        if text.startswith("0"):
            # 022 .. 01 are low-fire, and larger digits are colder
            return -float(text.lstrip("0") or "0")
        return float(text)
    except ValueError:
        return pd.NA


df["cone_ordinal"] = df["cone"].map(cone_to_ordinal)


# ---------- clean 2: drop rows with no usable UMF ----------
df = df.dropna(subset=["SiO2_umf", "Al2O3_umf"])
df = df[(df["SiO2_umf"] > 0) & (df["Al2O3_umf"] > 0)]
print("after dropping zero/blank UMF:", len(df))


# ---------- clean 3: clip to the Stull domain ----------
# Weakness 1's fix specifies x in [0, 8], y in [0, 1.2]. Anything outside is
# either a bad material analysis or not a Stull-type glaze at all. The max
# SiO2_umf in the raw file is 276, which is plainly a broken analysis.
in_domain = (
    (df["SiO2_umf"] <= 8.0)
    & (df["Al2O3_umf"] <= 1.2)
)
outside = (~in_domain).sum()
df = df[in_domain]
print(f"dropped {outside} rows outside the Stull domain; {len(df)} remain")


# ---------- clean 4: duplicates ----------
# The README warns about duplicate and near-duplicate recipes. Exact-name
# duplicates at the same chemistry are safe to drop.
before = len(df)
df = df.drop_duplicates(subset=["name", "SiO2_umf", "Al2O3_umf"])
print(f"dropped {before - len(df)} duplicate recipes")


# ---------- clean 5: flux ratio, Stull's held-constant variable ----------
# Stull fired at 0.3 R2O / 0.7 RO. Having this column lets the redesign show
# how far each recipe sits from the condition the regions were drawn under.
flux_total = df["R2O_umf"] + df["RO_umf"]
df["r2o_fraction"] = (df["R2O_umf"] / flux_total).where(flux_total > 0).round(3)


# ---------- clean 6: simplify surface into the Stull vocabulary ----------
SURFACE_MAP = {
    "Glossy": "gloss",
    "Glossy - Semi": "semi-gloss",
    "Satin": "satin",
    "Satin - Matte": "satin",
    "Matte": "matte",
    "Matte - Semi": "semi-matte",
    "Matte - Smooth": "matte",
    "Matte - Stony": "matte",
    "Matte - Dry": "matte",
}
df["surface"] = df["surface_type"].map(SURFACE_MAP)


# ---------- output ----------
df["source_url"] = "https://glazy.org/recipes/" + df["id"].astype(str)
df["si_al_ratio"] = df["SiO2_Al2O3_ratio_umf"].round(2)

out = pd.DataFrame({
    "id": df["id"],
    "name": df["name"].str.strip(),
    "sio2": df["SiO2_umf"].round(3),
    "al2o3": df["Al2O3_umf"].round(3),
    "b2o3": df["B2O3_umf"].round(3),
    "si_al_ratio": df["si_al_ratio"],
    "cone": df["cone"],
    "cone_ordinal": df["cone_ordinal"],
    "surface": df["surface"],
    "type": df["material_type_concatenated"],
    "r2o_fraction": df["r2o_fraction"],
    "source_url": df["source_url"],
})

out = out.sort_values("cone_ordinal", na_position="last")
out.to_csv(DATA_DIR / "stull_recipes.csv", index=False)

print("\nwrote", DATA_DIR / "stull_recipes.csv", len(out), "rows")
print("\nrows per cone (top 12):")
print(out["cone"].value_counts().head(12))
print("\nrows with a surface label:", out["surface"].notna().sum())
