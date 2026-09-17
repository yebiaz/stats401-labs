import pandas as pd
import json

df = pd.read_csv(
    "../data/lab6_small_hierarchy.csv"
)

def build_hierarchy(
    dataframe,
    levels,
    value_column
):

    if len(levels) == 1:

        return [
            {
                "name": row[levels[0]],
                "value": row[value_column]
            }
            for _, row
            in dataframe.iterrows()
        ]

    current_level = levels[0]

    children = []

    for value, group in dataframe.groupby(
        current_level
    ):

        children.append({
            "name": value,
            "children": build_hierarchy(
                group,
                levels[1:],
                value_column
            )
        })

    return children

hierarchy = {
    "name": "World",
    "children": build_hierarchy(
        df,
        [
            "continent",
            "country",
            "region",
            "city"
        ],
        "population_thousands"
    )
}

with open(
    "../data/lab6_small_hierarchy.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        hierarchy,
        f,
        indent=2,
        ensure_ascii=False
    )

