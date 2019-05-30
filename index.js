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


function main() {
    console.log("start");

    let localFiles = null;
    let remoteFiles = null;

    jwtClient.authorize()
        .then(function () {
            console.log("Authorized");
            return listLocalFiles();

        }, handleErr)
        .then(function (localFilesAr) {
            localFiles = localFilesAr;
            return listRemoteFiles();
        }, handleErr)
        .then(function (currentRemoteFiles) {
            remoteFiles = currentRemoteFiles;
            return uploadFiles(localFiles, currentRemoteFiles);
        }, handleErr)
        .then(function () {
            return cleanUpRemoteFiles(remoteFiles);
        }, handleErr)
        .then(function () {
            console.log("Done, errorNb = " + errors);
            process.exit(errors === 0 ? 0 : 1)
        }, handleErr)

}

function handleErr(err) {
    console.log("Error: " + err);
    process.exit(1);
}


function listLocalFiles() {

    return new Promise(function (resolve, reject) {
        listLocalFilesBody(resolve, reject);
    });
}

function listLocalFilesBody(resolve, reject) {

    glob(config.localFileFilter, function (err, files) {

        if (err) {
            errors++;
            console.log(err);
            reject(err);
        }
        if (config.maxFileAgeInDays > 0) {
            let d = new Date();
            d.setDate(d.getDate() - config.maxFileAgeInDays);

            resolve(files.filter(f => fs.statSync(f).mtime >= d));
            return;
        }
        resolve(files);
    });

}

function listRemoteFiles() {

    return new Promise(function (resolve, reject) {

        listRemoteFileBody(resolve, reject);
    });


}

function listRemoteFileBody(resolve, reject) {

    drive.files.list({
        auth: jwtClient,
        fields: 'files(id,name,trashed,size,createdTime)',
        spaces: 'drive',
        pageSize: 1000,
        q: `'${config.remoteGDirId}' in parents`

    }, function (listErr, resp) {
        if (listErr) {
            console.log(listErr);
            errors++;
            reject(listErr);
            return;
        }
        console.log(`${resp.data.files.length} remote files found`);
        if (config.remoteGDirExtFilter && config.remoteGDirExtFilter !== "") {
            resolve(resp.data.files.filter(f => !f.trashed && f.name.endsWith(config.remoteGDirExtFilter)));
            return;
        }
        resolve(resp.data.files.filter(f => !f.trashed));
    });
}


function uploadFiles(localFiles, currentRemoteFiles) {

    return new Promise(function (resolve) {
        uploadFilesBody(localFiles, currentRemoteFiles, resolve);


    });
}

async function uploadFilesBody(localFiles, currentRemoteFiles, resolve) {

    // prevent running out of storage
    drive.files.emptyTrash({
        auth: jwtClient,
    }, function (err) {
        if (err) console.log(err);
    });

    let inUploadProgress = 1;
    for (const file of localFiles ) {
        const fileName = path.basename(file);
        const fileSize = fs.statSync(file).size;

        if (currentRemoteFiles.find(f => f.name === fileName && parseInt(f.size) === fileSize) !== undefined) {
            console.log("Skip " + fileName);
            continue;
        }
        inUploadProgress++;
        uploadFile(file).then(function () {
            if (--inUploadProgress <= 0) resolve();
        });

        while (inUploadProgress > 5)
            await sleep(2000);
    }
    inUploadProgress--;
    if (--inUploadProgress <= 0)
        resolve();

}
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

function uploadFile(file) {

    return new Promise(function (resolve) {
        uploadFileBody(file, resolve);
    })

}

function uploadFileBody(file, resolve) {
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
}


function cleanUpRemoteFiles(currentRemoteFiles) {

    return new Promise(function (resolve) {
        cleanUpRemoteFilesFilesBody(currentRemoteFiles, resolve);
    });
}

async function cleanUpRemoteFilesFilesBody(currentRemoteFiles, resolve) {

    if (!config.removeRemoteAgedFiles || config.maxFileAgeInDays <= 0) resolve();

    let d = new Date();
    d.setDate(d.getDate() - config.maxFileAgeInDays);


    let inProgress = 1;
    for (const file of currentRemoteFiles) {
        let fd = new Date(file.createdTime);
        if (fd >= d) continue;

        inProgress++;
        deleteRemoteFile(file).then(() => {
            if (--inProgress <= 0) resolve();
        });


        while (inProgress > 5)
            await sleep(2000);
    }
    if (--inProgress <= 0) resolve();

}


function deleteRemoteFile(file) {

    return new Promise(function (resolve) {
        deleteRemoteFileBody(file, resolve);
    })

}

function deleteRemoteFileBody(file, resolve) {
    console.log("Delete remote " + file.name);


    drive.files.delete({
        auth: jwtClient,
        fileId: file.id
    }, function (err) {
        if (err) {
            console.log("Delete error: " + err);
            errors++;
            resolve();
        } else {
            console.log('File deleted: : ', file.name);
            resolve();
        }

    });
}

main();
