@echo off
echo Starting Nginx...

docker run -d --name nginx ^
  -p 443:443 ^
  -v C:\nginx\nginx.conf:/etc/nginx/nginx.conf:ro ^
  -v C:\nginx\certs:/etc/nginx/certs:ro ^
  nginx

echo Nginx is running.
