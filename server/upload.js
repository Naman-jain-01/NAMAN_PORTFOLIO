const fs = require('fs');
const path = require('path');
const firebaseAdmin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Initialize Firebase Admin SDK
function initializeFirebase() {
    // Replace './config.json' with the actual path to your Firebase Admin SDK private key
    const serviceAccount = require('./config.json');
    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        storageBucket: 'mail-896e4.appspot.com'
    });
}

// Upload files from the given folder to Firebase Storage in a unique new folder
async function uploadFilesFromFolder(folderPath) {
    const bucket = firebaseAdmin.storage().bucket();
    const urls = [];
    const uniqueFolderName = uuidv4();

    const files = fs.readdirSync(folderPath);
    for (const filename of files) {
        const filePath = path.join(folderPath, filename);
        if (fs.statSync(filePath).isFile()) {
            const blob = bucket.file(`${uniqueFolderName}/${filename}`);
            await blob.save(fs.readFileSync(filePath), {
                contentType: 'auto',
                public: true,
                metadata: {
                    firebaseStorageDownloadTokens: uuidv4(),
                },
            });
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            urls.push(publicUrl);
        }
    }

    return urls;
}

// Delete all files in Firebase Storage
async function deleteAllFiles() {
    const bucket = firebaseAdmin.storage().bucket();
    const [files] = await bucket.getFiles();

    const deletedFiles = [];
    for (const file of files) {
        await file.delete();
        deletedFiles.push(file.name);
    }

    return deletedFiles;
}

// Main function using argument parsing
async function main() {
    // Argument parser setup
    const argv = yargs(hideBin(process.argv))
        .option('folder', {
            type: 'string',
            description: 'Folder path to upload files from',
        })
        .option('action', {
            type: 'string',
            choices: ['write', 'delete'],
            required: true,
            description: "Action to perform: 'write' (upload) or 'delete' (delete all)",
        })
        .demandOption('action')
        .help()
        .argv;

    // Initialize Firebase
    initializeFirebase();

    // Perform the requested action
    if (argv.action === 'write') {
        if (!argv.folder) {
            throw new Error("Folder path is required when action is 'write'");
        }
        const downloadUrls = await uploadFilesFromFolder(argv.folder);
        console.log(downloadUrls.join('\n'));
    } else if (argv.action === 'delete') {
        const deletedFiles = await deleteAllFiles();
        console.log(deletedFiles.join('\n'));
    }
}

// Execute the main function when the script is run directly
main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
