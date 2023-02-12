require('dotenv').config();

const fs = require('fs');
const express = require('express');
const request = require('then-request');
const extract = require('png-chunks-extract');
const text = require('png-chunk-text');
const kv = require('../kamiya_modules/key-value');

const app = express.Router();

const adminPass = process.env.ADMINPASS;

const D = new kv('./data/data.json');

const S = new kv('./data/pass.json');

function get_group(token) {return D.get(`${token}.group`);};

function get_token(pass) {return S.get(`${pass}.token`);};

function check_pass(pass) {
    if(!S.get(`${pass}.logout`) && S.get(`${pass}.token`) && (Date.parse(new Date()) - S.get(`${pass}.time`)) < 604800000) return true;
    return false;
};

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
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")));
        };
    };
    return fmt;
}

/**
 * @swagger
 * /api/user_content/get_list:
 *   get:
 *     tags:
 *       - User Content
 *     description: 获取用户的前10条历史
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pass
 *         description: Session Pass
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
 *                 length:
 *                   type: number
 *                 contents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     example:
 *                       url: string
 *                       uuid: string
 */
app.get('/api/user_content/get_list',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        const token = get_token(decodeURIComponent(req.query.pass));
        if(token) {
            const uc = JSON.parse(fs.readFileSync('./data/user_content.json'));
            const list = uc[token];
            if(list) {
                let contents = [];
                for (let i in list) {
                    if(i == 10) break;
                    contents.push(list[i]);
                }
                res.send({success: true,contents: contents,length: list.length});
            }
            else res.send({success: true,contents: [],length: 0});
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

/**
 * @swagger
 * /api/user_content/get_more:
 *   get:
 *     tags:
 *       - User Content
 *     description: 获取用户的后续历史
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pass
 *         description: Session Pass
 *         in: query
 *         required: true
 *         type: string
 *       - name: start
 *         description: 起始条目
 *         in: query
 *         required: true
 *         type: number
 *       - name: more
 *         description: 获取条数
 *         in: query
 *         required: true
 *         type: number
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
 *                 contents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     example:
 *                       url: string
 *                       uuid: string
 */
app.get('/api/user_content/get_more',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        const token = get_token(decodeURIComponent(req.query.pass));
        const start = req.query.start;
        const more = req.query.more;
        if(token && start && more) {
            const uc = JSON.parse(fs.readFileSync('./data/user_content.json'));
            const list = uc[token];
            if(list) {
                let count = 1;
                let contents = [];
                for (let i in list) {
                    i = new Number(i) + new Number(start - 1);
                    if(i >= list.length) break;
                    if(count > more) break;
                    contents.push(list[i]);
                    count++;
                }
                res.send({success: true,contents: contents});
            }
            else res.send({success: false});
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

/**
 * @swagger
 * /api/user_content/get_pnginfo:
 *   get:
 *     tags:
 *       - User Content
 *     description: 获取PNG元数据信息
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pass
 *         description: Session Pass
 *         in: query
 *         required: true
 *         type: string
 *       - name: url
 *         description: 图片链接
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
 *                 chunks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     example:
 *                       keyword: string
 *                       text: string
 */
app.get('/api/user_content/get_pnginfo',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        const url = decodeURIComponent(req.query.url);
        if(url && (url.match('kamiya'))) {
            request('GET',url).then((R) => {
                const buffer = Buffer.from(R.body, 'utf8');
                const chunks = extract(buffer);
                const textChunks = chunks.filter(function (chunk) {
                    return chunk.name === 'tEXt'
                }).map(function (chunk) {
                    return text.decode(chunk.data)
                })
                res.send({
                    success: true,
                    chunks: textChunks
                });
            },() => {
                res.send({success: false});
            });
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

app.get('/api/user_content/download_all',(req,res) => {
    if(!req.query.pass && !req.headers.cookie) {
        res.send({success: false});
        return;
    }
    else if(!req.query.pass && !req.headers.cookie.match('pass')) {
        res.send({success: false});
        return;
    }
    const pass = req.query.pass || req.headers.cookie.split('pass=')[1].split(';')[0];
    if(check_pass(decodeURIComponent(pass))) {
        const token = get_token(decodeURIComponent(pass));
        if(token) {
            const uc = JSON.parse(fs.readFileSync('./data/user_content.json'));
            const list = uc[token] || [];
            res.setHeader('Content-Type','application/octet-stream');
            res.setHeader('Content-Disposition','attachment; filename=kamiya_history_' + dateFormat('YYYY-mm-dd_HH-MM-SS',new Date()) + '.json');
            res.end(JSON.stringify(list,0,2));
        }
        else res.send({success: false});
    }
    else res.send({success: false});
});

module.exports = app;