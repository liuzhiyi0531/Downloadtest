require('dotenv').config();

const fs = require('fs');
const express = require('express');
const request = require('then-request');
const kv = require('../kamiya_modules/key-value');
const FormData = require('form-data');

const app = express.Router();

const adminPass = process.env.ADMINPASS;

app.use(express.static('qmpublic'));

const D = new kv('./data/qq.json');

const L = new kv('./data/data.json');

function dateFormat(fmt, date) {
    let ret;
    const opt = {
        "Y+": date.getFullYear().toString(),
        "m+": (date.getMonth() + 1).toString(),
        "d+": date.getDate().toString(),
        "H+": date.getHours().toString(),
        "M+": date.getMinutes().toString(),
        "S+": date.getSeconds().toString()
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
        };
    };
    return fmt;
}

function randomString(e) {    
    e = e || 32;
    let t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678",
    a = t.length,
    n = "";
    for (i = 0; i < e; i++) n += t.charAt(Math.floor(Math.random() * a));
    return n
};

/**
 * @swagger
 * /qqmid/api/new_request:
 *   get:
 *     tags:
 *       - QQ Middleware
 *     description: 获取注册码
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: 获取结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 random:
 *                   type: string
 */
app.get('/api/new_request',(req,res) => {
    const response = decodeURIComponent(req.query.token);
    if(response) {
        let data = new FormData();
        let url;
        if(req.query.type == 'cloudflare') {
            url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
            data.append('secret',process.env.CLOUDFLARE_KEY);
        }
        else {
            url = 'https://www.google.com/recaptcha/api/siteverify';
            data.append('secret',process.env.GOOGLE_KEY);
        }
        data.append('response',response);
        request('POST',url,{form: data}).getBody('utf8').then(JSON.parse).done(function(R) {
            if(!R.success) {
                res.send({success: false,message: '人机验证失败'});
                return;
            }
            const r = randomString(24);
            D.put(`${r}.pass`,randomString(32));
            res.send({success: true,random: r});
        },(e) =>{
            console.log(e);
            res.send({success: false,message: 'API回调失败'});
        });
    }
    else res.send({success: false,message: '人机验证失败'});
});

app.get('/api/get_pass',(req,res) => {
    const q = decodeURIComponent(req.query.q);
    if(q && req.query.adminPass == adminPass) {
        res.send({success: true,p: D.get(`${q}.pass`)});
    }
    else res.send({success: false});
});

app.get('/api/set_id',(req,res) => {
    const id = req.query.id;
    const q = decodeURIComponent(req.query.q);
    if(q && req.query.adminPass == adminPass) {
        if(!D.get(`${id}.token`) && q != '2T4cxKdTYDC6NHxCEDPxx3W4') D.put(`${q}.id`,id);
        res.send({success: true});
    }
    else res.send({success: false});
});

app.get('/api/sign_in',(req,res) => {
    const id = req.query.id;
    if(id && req.query.adminPass == adminPass) {
        const token = D.get(`${id}.token`);
        if(token) {
            if(dateFormat("YYYY-mm-dd",new Date(D.get(`${id}.last`))) != dateFormat("YYYY-mm-dd",new Date())) {
                L.put(`${token}.left`,L.get(`${token}.left`) + 60);
                D.put(`${id}.last`,Date.parse(new Date()));
                res.send({success: true,message: '签到完成，魔晶点数+60'});
            }
            else res.send({success: true,message: '每天仅可签到一次'});
        }
        else res.send({success: true,message: '请先注册再进行签到'});
    }
    else res.send({success: false});
});

app.get('/api/request_getback',(req,res) => {
    const response = decodeURIComponent(req.query.token);
    if(response) {
        let data = new FormData();
        let url;
        if(req.query.type == 'cloudflare') {
            url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
            data.append('secret',process.env.CLOUDFLARE_KEY);
        }
        else {
            url = 'https://www.google.com/recaptcha/api/siteverify';
            data.append('secret',process.env.GOOGLE_KEY);
        }
        data.append('response',response);
        request('POST',url,{form: data}).getBody('utf8').then(JSON.parse).done(function(R) {
            if(!R.success) {
                res.send({success: false,message: '人机验证失败'});
                return;
            }
            const q = decodeURIComponent(req.query.q);
            const r = randomString(32);
            D.put(`${r}.qq`,q);
            res.send({success: true,r: r});
        },(e) =>{
            console.log(e);
            res.send({success: false,message: 'API回调失败'});
        });
    }
    else res.send({success: false,message: '人机验证失败'});
});

app.get('/api/set_getback_resolved',(req,res) => {
    const id = req.query.id;
    const q = decodeURIComponent(req.query.q);
    if(q && req.query.adminPass == adminPass) {
        if(D.get(`${q}.qq`) == id) {
            D.put(`${q}.resolved`,true);
            res.send({success: true});
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

app.get('/api/getback',(req,res) => {
    const q = decodeURIComponent(req.query.q);
    if(D.get(`${q}.resolved`)){
        const qq = D.get(`${q}.qq`);
        D.put(`${q}.resolved`,false);
        const token = D.get(`${qq}.token`);
        if(token) {
            res.send({success: true,token: token});
        }
        else res.send({success: false,message: '请求找回的QQ号尚未注册，请先注册'});
    }
    else res.send({success: false,message: '该找回请求未被验证，请验证后再请求'});
});

/**
 * @swagger
 * /qqmid/api/reg:
 *   get:
 *     tags:
 *       - QQ Middleware
 *     description: 注册
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: q
 *         description: 注册码
 *         in: query
 *         required: true
 *         type: string
 *       - name: p
 *         description: 验证码
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 获取结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 message:
 *                   type: string
 */
app.get('/api/reg',(req,res) => {
    const q = decodeURIComponent(req.query.q);
    const p = decodeURIComponent(req.query.p);
    if(D.get(`${q}.pass`)){
        if(D.get(`${q}.pass`) == p) {
            id = D.get(`${q}.id`);
            if(id) {
                request('GET',`http://127.0.0.1:${process.env.PORT}/api/add_user?adminPass=${adminPass}&from=${encodeURIComponent(`QQ Middleware ${id}`)}`).getBody('utf8').then(JSON.parse).done(function(R) {
                    D.put(`${id}.token`,R.token);
                    res.send({success: true,token: R.token});
                });
            }
            else res.send({success: false,message: '请勿重复注册'});
        }
        else res.send({success: false,message: '验证码错误'});
    }
    else res.send({success: false,message: '请提供有效的验证码'});
});

module.exports = app;