require('dotenv').config();

const AWS = require('aws-sdk');
const express = require('express');
const bodyparser = require('body-parser');
const fs = require('fs');

const app = express.Router();

app.use(bodyparser.json({ limit:'1000mb'}));

AWS.config.update({region: process.env.AWS_REGION});

const s3 = new AWS.S3({apiVersion: 'v4'});

const BucketName = process.env.AWS_BUCKETNAME;
const URL = process.env.AWS_CLOUDFRONT;

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

app.post('/api/s3/upload_image',async (req,res) => {
    if(req.query.token == process.env.ADMINPASS) {
        if(req.body.image) {
            let data = req.body.image;
            data = data.replace(/^data:image\/\w+;base64,/, '');
            const u = uuid();
            const buffer = new Buffer(data,'base64');
            fs.writeFileSync('./data/cache/' + u + '.png',buffer);
            data = fs.createReadStream('./data/cache/' + u + '.png');
            s3.upload ({
                Bucket: BucketName,
                Body: data,
                Key: 'usercontent/' + u,
                ACL: 'public-read',
                ContentType: 'image/png'
            }, function (err, data) {
                if (err) {
                    console.log(err);
                    res.send({
                        uuid: u,
                        url: 'Failed to upload this content,contact the admin.'
                    });
                } if (data) {
                    res.send({
                        uuid: u,
                        url: URL + 'usercontent/' + u
                    });
                    console.log("Upload Success", data.Location);
                    try{
                        fs.unlinkSync('./data/cache/' + u + '.png');
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
            });
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

module.exports = app;