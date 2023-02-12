require('dotenv').config();

const fs = require('fs');
const express = require('express');
const request = require('then-request');

const app = express.Router();

const adminPass = process.env.ADMINPASS;

app.get('/api/backend/check',async (req,res) => {
    if(req.query.adminPass == adminPass) {
        const webuiList = JSON.parse(fs.readFileSync('./data/backend.json')).webui;
        for(let i in webuiList) {
            request('GET',webuiList[i].url + '/sdapi/v1/sd-models').getBody('utf8').then((R) => {
                R = JSON.parse(R);
                R = {
                    online: true,
                    checkpoints: R
                };
                fs.writeFileSync('./data/backend_cache/' + webuiList[i].id + '.json',JSON.stringify(R,0,2));
            },() => {
                fs.writeFileSync('./data/backend_cache/' + webuiList[i].id + '.json',JSON.stringify({online: false},0,2));
            });
        }
        res.send({success: true});
    }
    else res.send({success: false});
});

app.get('/api/backend/progress',(req,res) => {
    if(req.query.adminPass == adminPass) {
        const webuiList = JSON.parse(fs.readFileSync('./data/backend.json')).webui;
        for(let i in webuiList) {
            request('GET',webuiList[i].url + '/sdapi/v1/progress?skip_current_image=false').getBody('utf8').then((R) => {
                R = JSON.parse(R);
                R.current_image = null;
                R = {
                    online: true,
                    name: webuiList[i].name,
                    progress: R
                };
                let overview = JSON.parse(fs.readFileSync('./data/backend_cache/overview.json'));
                overview[webuiList[i].id] = R;
                fs.writeFileSync('./data/backend_cache/overview.json',JSON.stringify(overview,0,2));
            },() => {
                let overview = JSON.parse(fs.readFileSync('./data/backend_cache/overview.json'));
                overview[webuiList[i].id] = {
                    online: false,
                    name: webuiList[i].name
                };
                fs.writeFileSync('./data/backend_cache/overview.json',JSON.stringify(overview,0,2));
            });
        }
        res.send({success: true});
    }
    else res.send({success: false});
})

app.get('/api/backend/get_overview',(req,res) => {

});

module.exports = app;