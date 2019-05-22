Upload files to google drive using [google drive api v3](https://developers.google.com/drive/api/v3/)  
authenticate with a [google service account](https://developers.google.com/android/management/service-account)


- Take all local files filtered by `config.localFileFilter`
- Upload to directory with id `config.remoteGDirId`
- Skip if file already in the google drive dir with same file length
- Use service account credentials from config/credentials.json


Config and credential files in ./config


I'm using this to backup files from a k8-volume to google drive, 
that's why I've added a Dockerfile 