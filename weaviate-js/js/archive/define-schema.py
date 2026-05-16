import weaviate

# Connect to Weaviate (assuming it's running on localhost:8080)
client = weaviate.Client("http://localhost:8080")

# Define schema
schema = {
    "class": "BidResponseChunk",
    "description": "Chunks of text from IT RFP responses",
    "vectorizer": "text2vec-openai",  # Change if using another vectorizer
    "properties": [
        {
            "name": "filename",
            "dataType": ["string"],
            "description": "Source file name"
        },
        {
            "name": "chunk_id",
            "dataType": ["int"],
            "description": "Chunk number within the file"
        },
        {
            "name": "text",
            "dataType": ["text"],
            "description": "The chunk content"
        },
        {
            "name": "tags",
            "dataType": ["string[]"],
            "description": "Tags assigned based on controlled vocabulary"
        }
    ]
}

# Delete existing schema (CAUTION: This clears previous data)
if client.schema.exists("BidResponseChunk"):
    client.schema.delete_class("BidResponseChunk")

# Create new schema
client.schema.create_class(schema)

print("✅ Schema created successfully!")
