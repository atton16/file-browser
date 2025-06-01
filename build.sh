docker buildx build -t file-browser:latest --platform linux/amd64 -o type=docker,dest=- . > file-browser.amd64.tar
