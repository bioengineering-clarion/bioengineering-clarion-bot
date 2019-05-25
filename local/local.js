const localJson = require('./local.json');
const fs = require('fs');
const path = require('path');
const cachedFiles = {};

class Local {
    constructor(id) {
        this.id = id;
        this.filePrefix = '__FILE__:';
        this.pathPrefix = './local'
    }

    static get localJson() {
        return localJson;
    }

    static get cachedFiles() {
        return cachedFiles;
    }

    get(string, opts = {}) {
        let localPathList = string.split('.');
        let localValue = localJson[this.id];
        for (let i = 0; i < localPathList.length; i += 1) {
            localValue = localValue[localPathList[i]];
        }
        if (!localValue) {
            throw "Local path: " + string + " - not found.";
        }
        if ( localValue.includes(this.filePrefix) ) {
            let fileName = localValue.replace(this.filePrefix, '');
            localValue = this.getFile(fileName);
        }

        return localValue;
    }

    getFile(fileName) {
        let file = '';
        if (!(fileName in Local.cachedFiles)) {
            file = fs.readFileSync(path.join(this.pathPrefix, fileName)).toString();
            Local.cachedFiles[fileName] = file;
        }

        return Local.cachedFiles[fileName];
    }



}

module.exports = Local;