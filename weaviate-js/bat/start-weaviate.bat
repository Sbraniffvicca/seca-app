docker run -d --name weaviate ^
  -p 8080:8080 ^
  --network weaviate_network ^
  -v C:\weaviate_data:/data ^
  -e "ENABLE_MODULES=text2vec-transformers" ^
  -e "TRANSFORMERS_INFERENCE_API=http://weaviate_transformers:8080" ^
  -e "RAFT_BOOTSTRAP_EXPECT=1" ^
  -e "CLUSTER_HOSTNAME=node1" ^
  semitechnologies/weaviate


echo Weaviate starting...






