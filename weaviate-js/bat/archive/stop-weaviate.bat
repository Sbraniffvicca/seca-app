@echo off
echo Stopping Weaviate and Embeddings Model...
docker stop weaviate_local weaviate_transformers
docker rm weaviate_local weaviate_transformers
docker network rm weaviate_network 2>nul
echo Weaviate has been stopped.
