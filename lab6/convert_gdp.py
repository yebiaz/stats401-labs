import pandas as pd
import json
from pathlib import Path

data_dir = Path(__file__).parent.parent / "data"

df = pd.read_csv(data_dir / "lab6_assignment_gdp.csv")

print(df.head())
print(df.shape)
print(df.isna().sum())

hierarchy = {
    "name": "World",
    "children": []
}

for continent_name, continent_rows in df.groupby("continent"):

    continent_node = {
        "name": continent_name,
        "children": []
    }

    for area_name, area_rows in continent_rows.groupby("area"):

        area_node = {
            "name": area_name,
            "children": []
        }

        for _, row in area_rows.iterrows():

            area_node["children"].append({
                "name": row["country"],
                "gdp_billion_usd": float(row["gdp_billion_usd"]),
                "gdp_status": row["gdp_status"]
            })

        continent_node["children"].append(area_node)

    hierarchy["children"].append(continent_node)

out_path = data_dir / "lab6_assignment_gdp.json"

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(hierarchy, f, indent=2)

print("Continents:", len(hierarchy["children"]))
print("Countries:", len(df))
print("Saved to", out_path)