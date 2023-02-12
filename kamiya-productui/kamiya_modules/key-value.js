const fs = require('fs');

class kv {
    constructor(db) {
        this.db = db;
    }
    get(inkey) {
        let rawdata = fs.readFileSync(this.db);
        let data = JSON.parse(rawdata);
        for (let i = 0; i < data.length; i++) if (data[i].key == inkey) return data[i].value;
        return null;
    }
    put(inkey, invalue) {
        let rawdata = fs.readFileSync(this.db);
        let data = JSON.parse(rawdata);
        for (let i = 0; i < data.length; i++) if (data[i].key == inkey) {
            data[i].value = invalue;
            rawdata = JSON.stringify(data);
            fs.writeFileSync(this.db, rawdata);
            return 'done';
        }
        data.push(
            {
                key: inkey,
                value: invalue
            }
        );
        rawdata = JSON.stringify(data);
        fs.writeFileSync(this.db, rawdata);
        return 'done';
    }
}

module.exports = kv;