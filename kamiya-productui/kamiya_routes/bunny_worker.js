require('dotenv').config();

const express = require('express');
const bodyparser = require('body-parser');
const fs = require('fs');

const request = require('then-request');

const app = express.Router();

app.use(bodyparser.json({ limit:'1000mb'}));

function uuid() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
    s[8] = s[13] = s[18] = s[23] = "-";
    var uuid = s.join("");
    return uuid;
}

app.post('/api/bunny/upload_image',async (req,res) => {
    if(req.query.token == process.env.ADMINPASS) {
        if(req.body.image) {
            let data = req.body.image;
            data = data.replace(/^data:image\/\w+;base64,/, '');
            const u = uuid();
            const buffer = new Buffer(data,'base64');
            fs.writeFileSync('./data/cache/' + u + '.png',buffer);
            data = fs.createReadStream('./data/cache/' + u + '.png');
            request('PUT',`https://sg.storage.bunnycdn.com/${process.env.BUNNY_ZONE}/usercontent/${u}.png`,{
                body: data,
                headers: {
                    AccessKey: process.env.BUNNY_KEY
                }
            }).then((r) => {
                console.log(r.body.toString());
                if(r.statusCode <= 201) {
                    res.send({
                        uuid: u,
                        url: process.env.BUNNY_URL + 'usercontent/' + u + '.png'
                    });
                    try{
                        fs.unlinkSync('./data/cache/' + u + '.png');
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
                else {
                    res.send({
                        uuid: u,
                        url: 'Failed to upload this content,contact the admin.'
                    });
                }
            },(e) => {
               console.log(e);
                res.send({
                    uuid: u,
                    url: 'Failed to upload this content,contact the admin.'
                });
            });

        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

module.exports = app;