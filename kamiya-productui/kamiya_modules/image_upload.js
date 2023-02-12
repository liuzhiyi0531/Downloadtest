require('dotenv').config();

const fs = require('fs');
const request = require('then-request');

const upload_image = (image,token) => {
    return new Promise((resolve, reject) => {
        request('POST',process.env.WORKERURL + '?token=' + process.env.ADMINPASS,{json: {image: image}}).getBody('utf8').then((R) => {
            R = JSON.parse(R);
            let uc = JSON.parse(fs.readFileSync('./data/user_content.json'));
            if(!uc[token]) uc[token] = [];
            uc[token].unshift(R);
            fs.writeFileSync('./data/user_content.json',JSON.stringify(uc,0,2));
            resolve(true);
        },(e) => {
            console.log('WARN 1 user content failed to upload.',e);
            resolve(true);
        });
    });
}

module.exports = upload_image;