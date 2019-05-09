const fs = require('fs');
const {google} = require('googleapis');
const key = require('./config/credentials.json');
const config = require('./config/config.json');

const drive = google.drive('v3');
const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/drive'],
    null,
);

var done = false;

function main() {
    console.log("start");
    var authorizePromise = jwtClient.authorize();

    authorizePromise.then(function (auth) {
        console.log("Authorized");
        body(auth);

    }, function (err) {
        console.log("Authorize failed " + err);
    });
}

function body(auth) {
    uploadFile(jwtClient, function () {
        listFiles(auth);
        console.log("Upload done");
        done = true;
    });

}

function listFiles(auth) {
    // List Drive files.
    drive.files.list({
        auth: jwtClient,
        includeRemoved: false,
        spaces: 'drive',
        fileId: config.parentGDirId
    }, function(listErr, resp) {
        if (listErr) {
            console.log(listErr);
            return;
        }
        resp.data.files.forEach((file) => {
            console.log(`${file.name} (${file.mimeType})`);
        });
    });

}

function uploadFile(auth, next) {

    console.log("Start uploading");

    const fileMetadata = {
        'name': 'sensus-test1__20190504-230013.zip',
        'parents': [config.parentGDirId]
    };


    const media = {
        mimeType: 'application/zip',
        body: fs.createReadStream('/Users/hans/Downloads/sensus-test1__20190504-230013.zip')
    };
    drive.files.create({
        auth: jwtClient,
        resource: fileMetadata,
        media: media,
        fields: 'id'
    }, function (err, file) {
        if (err) {
            console.log("Upload error");

            // Handle error
            console.error(err);
        } else {
            console.log('File uploaded, Id: ', file.data.id);
            next();
        }

    });
}

main();
