##change column names? reason why not including object id 

import requests
import pandas as pd
import time
from pathlib import Path

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0" #who user is 
}

urlUsed = "https://collectionapi.metmuseum.org/public/collection/v1" #using met api of their works, focusing on ceramics objects

data_dir = Path(__file__).parent.parent / "data"
data_dir.mkdir(parents=True, exist_ok=True)

##### first need to collect the ids that fall under the ceramics i want to find
# so looping through the api requests and making a list of object ids first 

# search terms, one request each (search like the filter for tasks), these are all ceramics mediums 
searches = [ 
    "porcelain",
    "stoneware",
    "earthenware",
    "terracotta",
    "celadon",
    "glazed ceramic"
]

object_ids = []

# loop through the searches, kind of like looping through the pages or if I had used another like index = #
for query in searches:

    url = (
        f"{urlUsed}/search"
        f"?q={query}&medium=Ceramics" #put in the respective search and make sure medium is ceramics 
    )

    #requests and error handling
    try:
        response = requests.get( 
            url,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()

    except requests.RequestException as error:
        print("Search failed:", query)
        print(error)
        continue

    time.sleep(1) #don't forget delay! 

    results = response.json() #since using api, data is already structured in json instead of BeautifulSoup for scraping
    ids = results.get("objectIDs") or [] #[] in case the search results were nothing at all 

    object_ids.extend(ids[:250]) #NOT append because the ids are an array and need to have them each be an element
    print(query, "->", len(ids), "objects")


# remove duplicates because a terracotte piece could also be aglazed piece; also only keeping first 1000 for assignment
object_ids = list(dict.fromkeys(object_ids))
print("Unique object IDs:", len(object_ids)) 



############ json to python dicts like in lab 
#has to be separate loops because going through one type first then another, if made all one loop, would mostly be all porecelain and few glazed
#i also further undertood that one is getting the ids (in batches) and one is getting the actual details (one by one)
records = []

assignmentReq = 1 
for object_id in object_ids: 

    url = f"{urlUsed}/objects/{object_id}" #go back to those objects in the met api 

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()

    except requests.RequestException as error:
        print("Request failed:", object_id)
        print(error)
        time.sleep(0.5)
        continue

    time.sleep(0.5) 

    obj = response.json()

    records.append({ 
        "Title": obj.get("title"), #just in case doesn't exist, do get 
        "Type": obj.get("objectName"),
        "Department": obj.get("department"),
        "Medium": obj.get("medium"),
        "Year~": obj.get("objectEndDate"),
        "Artist": obj.get("artistDisplayName"),
    })

    if assignmentReq % 50 == 0: #just checking the progress since it takes so long lol 
        print(assignmentReq, "/", len(object_ids))
        pd.DataFrame(records).to_csv(
            data_dir / "lab3_data.csv",
            index=False,
            encoding="utf-8"
        )

    assignmentReq +=1 

print("Total records:", len(records))

# saving the acquired data
df = pd.DataFrame(records)
print(df.head())

# save as csv
df.to_csv(
    data_dir / "lab3_data.csv",
    index=False,
    encoding="utf-8"
)

# save as json
df.to_json(
    data_dir / "lab3_data.json",
    orient="records",
    indent=2
)
