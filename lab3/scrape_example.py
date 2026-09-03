import requests
from bs4 import BeautifulSoup
import pandas as pd 
import time 

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}


#python dicts to structured data 
records = []

#need to make sure reach every page 
for page in range(1, 6):
    #request and process the page, not as fast as the computer can generate them 

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    #error handling if network requests fail    
    try:
        response = requests.get(
        url, headers = headers,
        timeout=10
    )
        response.raise_for_status()
        response.encoding = response.apparent_encoding 

    except requests.RequestException as error:
        print("Request failed:")
        print(error)
        continue 

    time.sleep(1)

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    #html to python dicts 
    books = soup.select(
        "article.product_pod"
    )

    for book in books:

        title = book.select_one(
            "h3 a"
        )["title"]

        price = book.select_one(
            ".price_color"
        ).get_text(strip=True)

        records.append({
            "title": title,
            "price": price,
            "page": page
        })

print("Total records:", len(records))

#now save the scraped data 
df = pd.DataFrame(records)
print(df.head())

#save as csv 
df.to_csv(
    "../data/books.csv",
    index=False
)

#save as json 
df.to_json(
    "../data/books.json",
    orient="records",
    indent=2
)















#initial intro 



# import requests
# from bs4 import BeautifulSoup
# import pandas as pd
# import requests

# url = "https://example.com"
# response = requests.get(url, timeout=10)

# print(response)
# print(response.status_code) #200 means success 

# print(response.text) #for an html page 

# headers = {
#     "User-Agent": "STATS401-Class-Exercise/1.0"
# }

# response = requests.get( #read to know how to respond and know who user is that's sending the request
#     url,
#     headers=headers,
#     timeout=10
# )


# from bs4 import BeautifulSoup

# html = """
# <html>
# <body>
#     <h1>Book Store</h1>
#     <p class="description">Welcome to our store.</p>
# </body>
# </html>
# """

# soup = BeautifulSoup(html, "html.parser")
# #use soup object to extract tag, class, elements from html # can also use loop
#     #find ^ 
# heading = soup.find("h1")
# print(heading.get_text(strip=True))

# #soup.select 
# print(soup.select("h1")) ###selects the text straight up, added to array, like d3.select()

# import requests
# from bs4 import BeautifulSoup

# url = "https://books.toscrape.com/"

# headers = {
#     "User-Agent": "STATS401-Class-Exercise/1.0"
# }

# response = requests.get(
#     url,
#     headers=headers,
#     timeout=10
# )

# response.raise_for_status()

# soup = BeautifulSoup(
#     response.text,
#     "html.parser"
# )