# import requests
# from bs4 import BeautifulSoup
# from urllib.robotparser import RobotFileParser

# HEADERS = {"User-Agent": "STATS401-Class-Exercise/1.0"}
# # BASE = "https://old.reddit.com/r/climbing/?count=1000&after=t3_1vbrs2e"

# # # Paste a real URL you got by clicking around openbeta.io
# # TEST_URL = f"{BASE}/PASTE_A_REAL_PATH_HERE"

# DOMAIN = "https://google.com.hk"
# TEST_URL = "https://google.com.hk/climbing"

# rp = RobotFileParser()
# rp.set_url(f"{DOMAIN}/robots.txt")
# rp.read()
# print("Testing:", TEST_URL)
# print("allows:", rp.can_fetch(HEADERS["User-Agent"], TEST_URL))

# r = requests.get(TEST_URL, headers=HEADERS, timeout=10)
# r.encoding = r.apparent_encoding
# print("Status:", r.status_code, "| Length:", len(r.text))

# with open("probe.html", "w", encoding="utf-8") as f:
#     f.write(r.text)

# soup = BeautifulSoup(r.text, "html.parser")
# print("Links on page:", len(soup.select("a[href]")))
# print("Sample hrefs:")
# for a in soup.select("a[href]")[:40]:
#     print("  ", a.get("href"), "|", a.get_text(strip=True)[:50])

import requests

url = "https://collectionapi.metmuseum.org/public/collection/v1/objects/45734"
r = requests.get(url, timeout=10)
data = r.json()

print(data["title"])
print(data["objectDate"])
print(data["culture"])
print(data["medium"])

print(data.keys())

search = requests.get(
    "https://collectionapi.metmuseum.org/public/collection/v1/search?q=ceramic&medium=Ceramics",
    timeout=10
).json()

print(search["total"])
print(search["objectIDs"][:10])