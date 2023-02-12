require('dotenv').config();

const fs = require('fs');
const express = require('express');
const kv = require("../kamiya_modules/key-value");

const app = express.Router();

const adminPass = process.env.ADMINPASS;

// Main Database
const D = new kv('./data/data.json');
// Sessions
const S = new kv('./data/pass.json');

const B = new kv('./data/dreambooth.json');

function check_pass(pass) {
    if(!S.get(`${pass}.logout`) && S.get(`${pass}.token`) && (Date.parse(new Date()) - S.get(`${pass}.time`)) < 604800000) return true;
    return false;
};

function get_token(pass) {return S.get(`${pass}.token`);};

app.get('/api/app_gateway/add_left',(req,res) => {
    if(req.query.adminPass == adminPass) {
        const token = get_token(decodeURIComponent(req.query.pass));
        D.put(`${token}.left`,D.get(`${token}.left`) * 1 + req.query.add * 1);
        res.send({success: true});
    }
    else res.send({success: false});
});

app.get('/api/app_gateway/set_access',(req,res) => {
    if(req.query.adminPass == adminPass) {
        const token = get_token(decodeURIComponent(req.query.pass));
        B.put(`${token}.${req.query.access}`,true);
        res.send({success: true});
    }
    else res.send({success: false});
});

module.exports = app;