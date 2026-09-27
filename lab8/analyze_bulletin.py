"""
Lab 8 — Parts B and C: corpus overview + semantic analysis

    python analyze_bulletin.py

Input : ../data/bulletin_passages.csv          (from parse_bulletin.py)
Output: ../data/lab8_embedding_map.csv          one row per passage
        ../data/lab8_topic_section_matrix.csv   section x topic counts
        ../data/lab8_corpus_summary.json        charts for Part B
        cluster_report.txt                      read this to label topics

Run it TWICE:
  1st run  -> read cluster_report.txt, decide a name for each cluster
  2nd run  -> after filling in CLUSTER_LABELS below
"""

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"

# Same guard as parse_bulletin.py.
DATA.mkdir(parents=True, exist_ok=True)

N_CLUSTERS = 12
SEED = 401
N_NEIGHBORS = 5

# ------------------------------------------------------------------
# FILL THIS IN after the first run, using cluster_report.txt.
# Leave a cluster out and it keeps its auto-generated draft label.
# ------------------------------------------------------------------
CLUSTER_LABELS = {
    # 0: "Registration and Course Load",
    # 1: "Economics and Policy Courses",
}

# words that appear everywhere in a university bulletin and would
# otherwise dominate every TF-IDF list without meaning anything
DOMAIN_STOP_WORDS = {
    "duke", "kunshan", "university", "dku", "student", "students",
    "course", "courses", "credit", "credits", "prerequisite",
    "prerequisites", "include", "includes", "including", "will", "may",
    "also", "must", "one", "two", "use", "used", "well", "new",
}

STOP_WORDS = list(ENGLISH_STOP_WORDS | DOMAIN_STOP_WORDS)


# ------------------------------------------------------------------
# load
# ------------------------------------------------------------------

df = pd.read_csv(DATA / "bulletin_passages.csv")

df = df.dropna(subset=["text_clean"])
df = df.drop_duplicates(subset=["text_clean"]).reset_index(drop=True)

print(f"Passages: {len(df)}")


# ==================================================================
# PART B — corpus overview
# ==================================================================

# ---- 1. passages and average length by formal section

by_group = (
    df.groupby("formal_group")
    .agg(
        passages=("passage_id", "count"),
        avg_words=("word_count", "mean"),
    )
    .reset_index()
    .sort_values("passages", ascending=False)
)
by_group["avg_words"] = by_group["avg_words"].round(1)

# ---- 2. top meaningful terms across the whole corpus

count_vec = TfidfVectorizer(
    stop_words=STOP_WORDS,
    use_idf=False,
    norm=None,
    token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]{2,}\b",
    ngram_range=(1, 2),
    min_df=3,
)
counts = count_vec.fit_transform(df["text_clean"])
term_totals = np.asarray(counts.sum(axis=0)).ravel()
vocab = count_vec.get_feature_names_out()

top_terms = [
    {"term": vocab[i], "count": int(term_totals[i])}
    for i in term_totals.argsort()[::-1][:25]
]

# ---- 3. characteristic TF-IDF terms per formal section

def distinctive_terms(texts_by_group, n=8):
    """TF-IDF over one concatenated document per group."""

    groups = list(texts_by_group.keys())
    docs = [" ".join(texts_by_group[g]) for g in groups]

    vec = TfidfVectorizer(
        stop_words=STOP_WORDS,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]{2,}\b",
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )
    matrix = vec.fit_transform(docs)
    terms = vec.get_feature_names_out()

    out = {}
    for row, group in enumerate(groups):
        scores = matrix[row].toarray().ravel()
        out[group] = [terms[i] for i in scores.argsort()[::-1][:n]]
    return out


section_terms = distinctive_terms(
    df.groupby("formal_group")["text_clean"].apply(list).to_dict()
)


# ==================================================================
# PART C — semantic analysis
# ==================================================================

# ---- 1. embeddings
#
# Preferred: a sentence-transformer, which encodes MEANING - two passages
# using different words for the same idea land near each other.
#
# Fallback: TF-IDF reduced with SVD (latent semantic analysis). This needs
# only scikit-learn, which you already have. It is genuinely weaker: it
# matches on shared vocabulary, so a passage about "tuition" and one about
# "fees" stay apart unless the words co-occur elsewhere. Everything
# downstream works identically because both produce the same shape of
# normalized vector.
#
# Whichever runs is recorded in EMBEDDING_METHOD and written into
# lab8_corpus_summary.json, so your write-up can state which one you used.

EMBED_DIMS = 384

try:
    from sentence_transformers import SentenceTransformer

    MODEL_NAME = "all-MiniLM-L6-v2"
    EMBEDDING_METHOD = "sentence-transformers"

    model = SentenceTransformer(MODEL_NAME)

    embeddings = model.encode(
        df["text_clean"].tolist(),
        normalize_embeddings=True,
        show_progress_bar=True,
    )

except ImportError:
    from sklearn.decomposition import TruncatedSVD
    from sklearn.preprocessing import normalize

    MODEL_NAME = f"TF-IDF + TruncatedSVD({EMBED_DIMS})"
    EMBEDDING_METHOD = "tfidf-svd"

    print("NOTE: sentence-transformers is not installed.")
    print("      Falling back to TF-IDF + SVD, which matches on shared words")
    print("      rather than on meaning. Install sentence-transformers for")
    print("      the real thing:  pip install sentence-transformers")

    tfidf = TfidfVectorizer(
        stop_words=list(ENGLISH_STOP_WORDS),
        min_df=3,
        max_df=0.5,
        ngram_range=(1, 2),
    ).fit_transform(df["text_clean"].tolist())

    # SVD cannot ask for more components than the matrix has columns.
    n_comp = min(EMBED_DIMS, tfidf.shape[1] - 1)

    embeddings = normalize(
        TruncatedSVD(n_components=n_comp, random_state=SEED)
        .fit_transform(tfidf)
    )

print(f"Embeddings: {embeddings.shape}  via {MODEL_NAME}")

# ---- 2. nearest semantic neighbours (for the map interaction)

similarity = cosine_similarity(embeddings)
np.fill_diagonal(similarity, -1)          # a passage is not its own neighbour

neighbor_idx = np.argsort(-similarity, axis=1)[:, :N_NEIGHBORS]

df["neighbors"] = [
    "|".join(df["passage_id"].iloc[row].tolist())
    for row in neighbor_idx
]
df["neighbor_scores"] = [
    "|".join(f"{similarity[i, j]:.3f}" for j in row)
    for i, row in enumerate(neighbor_idx)
]

# ---- 3. UMAP to 2D

# UMAP if it is installed, t-SNE from scikit-learn otherwise. Both project
# the high-dimensional embeddings down to the two coordinates the map plots.
# On L2-normalized vectors, euclidean distance is monotonic in cosine
# distance, so t-SNE's default metric is the right comparison here.

try:
    import umap

    UMAP_SETTINGS = dict(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=SEED,
    )
    PROJECTION_METHOD = "umap"

    coords = umap.UMAP(**UMAP_SETTINGS).fit_transform(embeddings)

except ImportError:
    from sklearn.manifold import TSNE

    UMAP_SETTINGS = dict(
        n_components=2,
        perplexity=30,
        init="pca",
        random_state=SEED,
    )
    PROJECTION_METHOD = "tsne"

    print("NOTE: umap-learn is not installed. Using scikit-learn t-SNE.")
    print("      Install it with:  pip install umap-learn")

    coords = TSNE(**UMAP_SETTINGS).fit_transform(embeddings)

df["x"] = coords[:, 0]
df["y"] = coords[:, 1]

# ---- 4. cluster the ORIGINAL embeddings, not the 2D coordinates

kmeans = KMeans(
    n_clusters=N_CLUSTERS,
    random_state=SEED,
    n_init="auto",
)
df["cluster"] = kmeans.fit_predict(embeddings)

# ---- 5. characteristic terms + representative passages per cluster

cluster_terms = distinctive_terms(
    df.groupby("cluster")["text_clean"].apply(list).to_dict(),
    n=10,
)

centroids = kmeans.cluster_centers_
centroids = centroids / np.linalg.norm(centroids, axis=1, keepdims=True)

def draft_label(cluster_id):
    terms = cluster_terms[cluster_id]
    words = [t for t in terms if " " not in t][:3]
    if len(words) < 2:
        words = terms[:2]
    return " / ".join(w.title() for w in words) or f"Topic {cluster_id}"

df["cluster_name"] = [
    CLUSTER_LABELS.get(c, draft_label(c)) for c in df["cluster"]
]

with open(Path(__file__).parent / "cluster_report.txt", "w", encoding="utf-8") as f:

    f.write("CLUSTER REPORT — use this to name each topic\n")
    f.write("=" * 70 + "\n\n")

    for c in range(N_CLUSTERS):

        members = df.index[df["cluster"] == c]
        member_vecs = embeddings[members]
        closeness = member_vecs @ centroids[c]
        representative = members[np.argsort(-closeness)[:6]]

        group_mix = (
            df.loc[members, "formal_group"]
            .value_counts()
            .head(4)
        )

        f.write(f"CLUSTER {c}   ({len(members)} passages)\n")
        f.write(f"Draft label : {draft_label(c)}\n")
        f.write(f"Top terms   : {', '.join(cluster_terms[c])}\n")
        f.write("Sections    : " + "; ".join(
            f"{g} ({n})" for g, n in group_mix.items()
        ) + "\n")
        f.write("Most representative passages:\n")
        for idx in representative:
            f.write(f"  - [{df.at[idx, 'passage_id']}, p.{df.at[idx, 'page']}] "
                    f"{df.at[idx, 'text_clean'][:220]}\n")
        f.write("\n")

# ---- 6. how typical is each passage of its OWN formal section?
#      low score = semantically unusual for where it appears (question 5)

group_centroid = {}
for group, idx in df.groupby("formal_group").groups.items():
    v = embeddings[idx].mean(axis=0)
    group_centroid[group] = v / np.linalg.norm(v)

df["section_fit"] = [
    float(embeddings[i] @ group_centroid[g])
    for i, g in enumerate(df["formal_group"])
]

# relative, not a fixed cut-off: the least typical 10% of each section.
# a fixed threshold would depend on the embedding model's scale.
df["unusual"] = (
    df.groupby("formal_group")["section_fit"]
    .transform(lambda s: s <= s.quantile(0.10))
    .astype(int)
)

# ---- 7. topic diversity per section (Shannon entropy, question 3)

diversity = []
for group, sub in df.groupby("formal_group"):
    p = sub["cluster"].value_counts(normalize=True).values
    entropy = float(-(p * np.log2(p)).sum())
    diversity.append({
        "formal_group": group,
        "passages": len(sub),
        "topics_present": int(sub["cluster"].nunique()),
        "entropy": round(entropy, 3),
    })

diversity = sorted(diversity, key=lambda d: -d["entropy"])


# ==================================================================
# EXPORT
# ==================================================================

map_cols = [
    "passage_id", "chapter", "section", "subsection", "formal_group",
    "page", "text", "word_count", "cluster", "cluster_name",
    "x", "y", "section_fit", "unusual", "neighbors", "neighbor_scores",
]

df[map_cols].to_csv(
    DATA / "lab8_embedding_map.csv",
    index=False,
    encoding="utf-8",
)

matrix = (
    df.groupby(["formal_group", "cluster_name"])
    .size()
    .reset_index(name="count")
)
section_totals = df["formal_group"].value_counts()
matrix["proportion"] = (
    matrix["count"] / matrix["formal_group"].map(section_totals)
).round(4)

matrix.to_csv(
    DATA / "lab8_topic_section_matrix.csv",
    index=False,
    encoding="utf-8",
)

# bulletin_parse_stats.json is written by parse_bulletin.py. If you have the
# passages CSV but have not re-run the parser, carry on without it rather than
# crashing here - it only feeds a descriptive block in the summary, and every
# number the page actually draws comes from the CSV.
stats_path = DATA / "bulletin_parse_stats.json"

if stats_path.exists():
    parse_stats = json.loads(stats_path.read_text())
else:
    print(f"NOTE: {stats_path.name} not found - run parse_bulletin.py to "
          f"regenerate it. Continuing without the parse stats.")
    parse_stats = None

summary = {
    "parse": parse_stats,
    "source": {
        "title": "Bulletin of Duke Kunshan University: Undergraduate Instruction",
        "version": "2021-2022 (V2021-22)",
        "url": "https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/"
               "dkumain/files/V2021-22_DKU_UG_Bulletin.pdf",
        "pages": 400,
    },
    "stats": {
        "passages": int(len(df)),
        "avg_words": round(float(df["word_count"].mean()), 1),
        "median_words": float(df["word_count"].median()),
        "chapters": int(df["chapter"].nunique()),
        "sections": int(df["section"].nunique()),
        "formal_groups": int(df["formal_group"].nunique()),
    },
    "method": {
        "embedding_model": MODEL_NAME,
        "embedding_method": EMBEDDING_METHOD,
        "embedding_dimensions": int(embeddings.shape[1]),
        "projection_method": PROJECTION_METHOD,
        "projection_settings": UMAP_SETTINGS,
        "clustering": f"KMeans on normalized embeddings, k={N_CLUSTERS}",
    },
    "by_group": by_group.to_dict(orient="records"),
    "top_terms": top_terms,
    "section_terms": section_terms,
    "cluster_terms": {str(k): v for k, v in cluster_terms.items()},
    "diversity": diversity,
}

with open(DATA / "lab8_corpus_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)

print()
print("Clusters:")
print(df.groupby(["cluster", "cluster_name"]).size().to_string())
print()
print("Wrote lab8_embedding_map.csv, lab8_topic_section_matrix.csv,")
print("      lab8_corpus_summary.json, cluster_report.txt")
