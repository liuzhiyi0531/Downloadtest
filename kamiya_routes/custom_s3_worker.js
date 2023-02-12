require('dotenv').config();

const express = require('express');
const bodyparser = require('body-parser');
const fs = require('fs');
const s3 = require('s3-node');

const app = express.Router();

app.use(bodyparser.json({ limit:'1000mb'}));

const client = s3.createClient({
    s3Options: {
        s3BucketEndpoint: true,
        s3ForcePathStyle: true,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        endpoint: process.env.S3_ENDPOINT,
        sslEnabled: true,
        signatureVersion: "v4"
    }
})

const BucketName = process.env.S3_BUCKETNAME;
const URL = process.env.S3_PUBLIC;

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

app.post('/api/custom_s3/upload_image',async (req,res) => {
    if(req.query.token == process.env.ADMINPASS) {
        if(req.body.image) {
            let data = req.body.image;
            data = data.replace(/^data:image\/\w+;base64,/, '');
            const u = uuid();
            const buffer = new Buffer(data,'base64');
            fs.writeFileSync('./data/cache/' + u + '.png',buffer);
            data = fs.createReadStream('./data/cache/' + u + '.png');
            const uploader = client.uploadFile({
                localFile: './data/cache/' + u + '.png',
                s3Params: {
                    Bucket: BucketName,
                    Key: 'usercontent/' + u,
                    ContentType: 'image/png',
                    ACL: 'public-read'
                }
            });
            uploader.on('end',(R) => {
                console.log(R);
                try{
                    fs.unlinkSync('./data/cache/' + u + '.png');
                }
                catch (e) {
                    console.log(e);
                }
                res.send({
                    uuid: u,
                    url: URL + 'usercontent/' + u
                });
            });
            uploader.on('error', function(err) {
                console.error("unable to upload:", err.stack);
                res.send({
                    uuid: u,
                    url: 'Failed to upload this content,contact the admin.'
                });
            });
            /*
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
             */
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

module.exports = app;