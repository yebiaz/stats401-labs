#api for providing data in a format for programs ; many return json 
#api endpoint -> requests.get -> JSON -> Python -> CSV/JSON 

import requests
import pandas as pd 

url = "https://jsonplaceholder.typicode.com/posts"

params = { #accept parameters, maybe a user and so they get rights 
    "userId": 1
} 
#others can be page, limit, category 

response = requests.get(url, params = params, timeout=10)
response.raise_for_status()

data = response.json()
# print(type(data))
# print(len(data))
# print(data[0])

first_post = data[0] #like dict 
print(first_post["id"]) #like array 
print(first_post["title"])

#only fields needed 
records = []
for post in data:

    records.append({
        "id": post["id"],
        "user_id": post["userId"],
        "title": post["title"]
    })

df = pd.DataFrame(records)
df.to_csv(
    "../data/posts.csv",
    index=False
)
