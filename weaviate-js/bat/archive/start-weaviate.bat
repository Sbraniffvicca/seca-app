echo Starting Weaviate with Persistent Storage and Built-in Embeddings...
docker run -d --name weaviate ^
  -p 8080:8080 ^
  --network weaviate_network ^
  -v C:\weaviate_data:/var/lib/weaviate ^
  -e "ENABLE_MODULES=text2vec-transformers" ^
  -e "TRANSFORMERS_INFERENCE_API=http://weaviate_transformers:8080" ^
  semitechnologies/weaviate


echo Weaviate starting...






