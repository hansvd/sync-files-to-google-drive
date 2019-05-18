const fs = require('fs');
const path = require('path');
const glob = require("glob");
const mime = require('mime-types');

const {google} = require('googleapis');
const drive = google.drive('v3');

const key = require('./config/credentials.json');
const config = require('./config/config.json');

const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/drive'],
    null,
);

let errors = 0;

function handleErr(err) {
    console.log("Authorize failed " + err);
    process.exit(1);
}

function main() {
    console.log("start");

    jwtClient.authorize()
        .then(function () {
            console.log("Authorized");
            return listRemoteFiles();

        }, handleErr)
        .then(function (currentRemoteFiles) {
            return uploadFiles(currentRemoteFiles);
        }, handleErr)
        .then(function () {
            console.log("Done, errorNb = " + errors);
            process.exit(errors === 0 ? 0 : 1)
        }, handleErr)

}

function uploadFiles(skipFiles) {

    function uploadFilesBody(resolve) {

        glob(config.localFileFilter, function (er, files) {
            let inUploadProgress = 1;
            files.forEach((file) => {
                const name = path.basename(file);
                if (skipFiles.includes(name)) {
                    console.log("Skip " + name);
                    return;
                }
                inUploadProgress++;
                uploadFile(jwtClient, file).then(function () {
                    if (inUploadProgress === 0) resolve();
                });
            });
            inUploadProgress--;
            if (inUploadProgress === 0)
                resolve();
        });

    }

    return new Promise(function (resolve) {
        uploadFilesBody(resolve);


    });
}

function listRemoteFiles() {

    return new Promise(function (resolve, reject) {

        drive.files.list({
            auth: jwtClient,
            includeRemoved: false,
            spaces: 'drive',
            fileId: config.remoteGDirId
        }, function (listErr, resp) {
            if (listErr) {
                console.log(listErr);
                errors++;
                reject(listErr);
            }
            resolve(resp.data.files.map(f => f.name));
        });
    });


}

async function uploadFile(auth, file) {

    return new Promise(function (resolve) {
        const fileName = path.basename(file);
        console.log("Start uploading: " + fileName);

        const fileMetadata = {
            'name': fileName,
            'parents': [config.remoteGDirId]
        };


        const media = {
            mimeType: mime.contentType(path.extname(file)),
            body: fs.createReadStream(file)
        };
        drive.files.create({
            auth: jwtClient,
            resource: fileMetadata,
            media: media,
            fields: 'id'
        }, function (err) {
            if (err) {
                console.log("Upload error: " + err);
                errors++;
                resolve();
            } else {
                console.log('File uploaded: : ', fileName);
                resolve();
            }

        });
    })

}

main();
