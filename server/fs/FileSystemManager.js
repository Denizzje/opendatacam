// requiring path and fs modules
const path = require('path');
const fs = require('fs');

const { loadConfig } = require('../utils/configLoader');

const DEFAULT_UPLOAD_FOLDER = '/var/local/darknet/opendatacam_videos_uploaded';

class FileSystemManager {
  constructor() {
    const config = loadConfig();
    this.filesPath = path.join(config.VIDEO_UPLOAD_FOLDER || DEFAULT_UPLOAD_FOLDER);
    // make directory if not exist
    try {
      if (!fs.existsSync(this.filesPath)) {
        fs.mkdirSync(this.filesPath, { recursive: true });
      }
    } catch (error) {
      console.log('Failed to create directory opendatacam_videos_uploaded, it might already exists or you are in simulation mode');
    }
  }

  getFilesDirectoryPath() {
    return this.filesPath;
  }

  getFiles() {
    return new Promise((resolve, reject) => {
      fs.readdir(this.filesPath, (err, files) => {
        // handling error
        if (err) {
          console.log(`Unable to scan directory: ${err}`);
          reject(err);
        }

        resolve(files);
      });
    });
  }
}

const FileSystemManagerInstance = new FileSystemManager();

module.exports = FileSystemManagerInstance;
