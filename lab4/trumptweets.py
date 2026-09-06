import pandas as pd
import re
from pathlib import Path

data_dir = Path(__file__).parent.parent / "data"

TWEETS_PER_YEAR = 300
RANDOM_SEED = 42

# ---------- Task 1: inspect ----------

df = pd.read_csv(data_dir / "trumptweets.csv")

print(df.head())
print(df.shape)
print(df.info())

# ---------- Task 2: missing values ----------

print(df.isna().sum())

# geo is empty for every row, so it carries no information
# mentions and hashtags are mostly missing and duplicate what is in content
df = df.drop(columns=["geo", "mentions", "hashtags", "id", "link"])

df = df.dropna(subset=["content", "date"])

# ---------- Task 3: duplicates ----------

print("Duplicate texts:", df["content"].duplicated().sum())

df = df.drop_duplicates(
    subset=["content"],
    keep="first"
)

# ---------- Task 4: numeric types ----------

df["retweets"] = pd.to_numeric(
    df["retweets"], errors="coerce"
)

df["favorites"] = pd.to_numeric(
    df["favorites"], errors="coerce"
)

df.loc[df["retweets"] < 0, "retweets"] = pd.NA
df.loc[df["favorites"] < 0, "favorites"] = pd.NA

df["retweets"] = df["retweets"].fillna(0)
df["favorites"] = df["favorites"].fillna(0)

# ---------- Task 5: dates ----------

df["created_at"] = pd.to_datetime(
    df["date"],
    errors="coerce",
    format="mixed"
)

print(df[df["created_at"].isna()])

df = df.dropna(subset=["created_at"])

df["date"] = df["created_at"].dt.date
df["year"] = df["created_at"].dt.year
df["hour"] = df["created_at"].dt.hour
df["weekday"] = df["created_at"].dt.day_name()

# ---------- Task 6: text cleaning ----------

df["is_retweet"] = df["content"].str.startswith("RT ")

df["tweet_text_raw"] = df["content"]


def clean_tweet_text(text):
    text = str(text)
    text = re.sub(
        r"https?://\S+|www\.\S+",
        " ",
        text
    )
    text = re.sub(r"\s+", " ", text)
    return text.strip()


df["tweet_text"] = (
    df["tweet_text_raw"].apply(clean_tweet_text)
)

# a tweet that was only a link is now empty and cannot be analyzed
df = df[df["tweet_text"].str.len() > 0]

print("Rows after cleaning:", len(df))

# ---------- sample so RoBERTa finishes in reasonable time ----------

df = (
    df.groupby("year", group_keys=False)
    .apply(
        lambda g: g.sample(
            min(len(g), TWEETS_PER_YEAR),
            random_state=RANDOM_SEED
        )
    )
    .reset_index(drop=True)
)

print("Sampled rows:", len(df))
print(df["year"].value_counts().sort_index())

# ---------- Task 12: sentiment ----------

from transformers import pipeline

sentiment_model = pipeline(
    "text-classification",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    top_k=None,
    truncation=True
)


def prepare_for_roberta(text):
    text = str(text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )
    return text.strip()


df["sentiment_text"] = (
    df["tweet_text"]
    .fillna("")
    .apply(prepare_for_roberta)
)

print("Running sentiment model...")

results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)


def scores_to_dict(scores):
    return {
        item["label"].lower(): item["score"]
        for item in scores
    }


score_dicts = [
    scores_to_dict(scores)
    for scores in results
]

df["sentiment_negative"] = [
    scores.get("negative", 0)
    for scores in score_dicts
]

df["sentiment_neutral"] = [
    scores.get("neutral", 0)
    for scores in score_dicts
]

df["sentiment_positive"] = [
    scores.get("positive", 0)
    for scores in score_dicts
]


def predicted_label(scores):
    return max(
        scores,
        key=scores.get
    ).capitalize()


df["sentiment"] = [
    predicted_label(scores)
    for scores in score_dicts
]

df["sentiment_score"] = (
    df["sentiment_positive"]
    - df["sentiment_negative"]
)

# ---------- Task 13: tidy data ----------

vis_df = df[[
    "created_at",
    "date",
    "year",
    "hour",
    "weekday",
    "tweet_text_raw",
    "tweet_text",
    "favorites",
    "retweets",
    "is_retweet",
    "sentiment_negative",
    "sentiment_neutral",
    "sentiment_positive",
    "sentiment_score",
    "sentiment"
]].copy()

print(vis_df.head())
print(vis_df.info())
print(vis_df.isna().sum())
print(vis_df["sentiment"].value_counts())

vis_df.to_csv(
    data_dir / "lab4_clean_tweets.csv",
    index=False,
    encoding="utf-8"
)

print("Saved", len(vis_df), "records")