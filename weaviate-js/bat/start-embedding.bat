echo Starting Embeddings...
docker run -d --name weaviate_transformers ^
  -p 8081:8080 ^
  --network weaviate_network ^
  semitechnologies/transformers-inference:sentence-transformers-multi-qa-MiniLM-L6-cos-v1

echo Embeddings Model are starting...






