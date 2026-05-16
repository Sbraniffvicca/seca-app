docker run -d --name verba ^
  -p 8501:8000 ^
  --network weaviate_network ^
  -e WEAVIATE_HOST=http://weaviate ^
  -e WEAVIATE_PORT=8080 ^
  -e WEAVIATE_SCHEME=http ^
  -e LLM_API_URL=http://localhost:8082/v1/chat/completions ^
  verba
