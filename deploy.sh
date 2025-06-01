rsync -avpP file-browser.amd64.tar root@apollo:/mnt/user/appdata/file-browser.amd64.tar
ssh root@apollo "
docker load -i /mnt/user/appdata/file-browser.amd64.tar
docker stop file-browser
docker rm file-browser
docker run \
  -d \
  --network bridge \
  --name file-browser \
  -p 3007:3000 \
  -e BASE_PATH=/mnt/user \
  -u 0:0 \
  -v /mnt/user:/mnt/user \
  -v /etc/passwd:/etc/passwd:ro \
  -v /etc/group:/etc/group:ro \
  -v /etc/shadow:/etc/shadow:ro \
  file-browser:latest
docker ps -a | grep file-browser
docker image prune -f
rm -rf /mnt/user/appdata/file-browser.amd64.tar
"
rm -rf file-browser.amd64.tar
