require('dotenv').config();

const fs = require('fs');
const express = require('express');
const kv = require('../kamiya_modules/key-value');

const app = express.Router();

const adminPass = process.env.ADMINPASS;

const D = new kv('./data/data.json');

const S = new kv('./data/pass.json');

const B = new kv('./data/dreambooth.json');

function get_group(token) {return D.get(`${token}.group`);};

function get_token(pass) {return S.get(`${pass}.token`);};

function check_pass(pass) {
    if(!S.get(`${pass}.logout`) && S.get(`${pass}.token`) && (Date.parse(new Date()) - S.get(`${pass}.time`)) < 604800000) return true;
    return false;
};

const groups = ['Normal','Internal','Administrator'];

/**
 * @swagger
 * /api/dreambooth/list_model:
 *   get:
 *     tags:
 *       - Dreambooth
 *     description: 获取Dreambooth列表
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: 返回数组列表
 */
app.get('/api/dreambooth/list_model',(req,res) => {
    res.send(fs.readdirSync('./data/dreambooth'));
});

/**
 * @swagger
 * /api/dreambooth/get_info:
 *   get:
 *     tags:
 *       - Dreambooth
 *     description: 获取特定Dreambooth的详细信息
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: model
 *         description: Dreambooth名
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 详细信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: https://files.catbox.moe/990amx.png
 *                 intro:
 *                   type: string
 *                 name:
 *                   type: string
 */
app.get('/api/dreambooth/get_info',(req,res) => {
    const query = decodeURIComponent(req.query.model);
    const list = fs.readdirSync('./data/dreambooth');
    for(let i in list) {
        if(list[i].startsWith(query)) {
            res.send(fs.readFileSync(`./data/dreambooth/${list[i]}`));
            return;
        }
    }
    res.send({success: false});
});

/**
 * @swagger
 * /api/dreambooth/set_model:
 *   get:
 *     tags:
 *       - Dreambooth
 *     description: 设置用户启用的模型
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pass
 *         description: Session Pass
 *         in: query
 *         required: true
 *         type: string
 *       - name: model
 *         description: 模型名称
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 设置结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: 权限不足
 */
app.get('/api/dreambooth/set_model',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        if(req.query.model) {
            const token = get_token(decodeURIComponent(req.query.pass));
            const model = decodeURIComponent(req.query.model);
            const model_config = JSON.parse(fs.readFileSync('./data/dreambooth/' + model + '.json'));
            if(!model_config.access && !model_config.group) {
                B.put(`${token}.model`, model);
                res.send({success: true});
            }
            else {
                if(B.get(`${token}.${model_config.access}`)) {
                    if(!model_config.group) {
                        B.put(`${token}.model`, model);
                        res.send({success: true});
                    }
                    else if(groups.indexOf(get_group(token)) >= groups.indexOf(model_config.group)) {
                        B.put(`${token}.model`, model);
                        res.send({success: true});
                    }
                    else res.send({success: false,message: '当前账户没有达到该启用该模型所需的用户组要求'});
                }
                else res.send({success: false,message: '当前账户没有启用该模型的所需的权限'});
            }

        }
        else res.send({success: false,message: '请提交要设置的model'});
    }
    else res.send({success: false,message: 'Session检查失败'});
});
/**
 * @swagger
 * /api/dreambooth/clear_model:
 *   get:
 *     tags:
 *       - Dreambooth
 *     description: 清除用户的模型设置
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
 *         description: 设置结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
app.get('/api/dreambooth/clear_model',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        B.put(`${get_token(decodeURIComponent(req.query.pass))}.model`,false);
        res.send({success: true});
    }
    else res.send({success: false});
});
/**
 * @swagger
 * /api/dreambooth/get_model:
 *   get:
 *     tags:
 *       - Dreambooth
 *     description: 获取用户的模型设置
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
 *                 model:
 *                   type: string
 */
app.get('/api/dreambooth/get_model',(req,res) => {
    if(check_pass(decodeURIComponent(req.query.pass))) {
        res.send({success: true,model:B.get(`${get_token(decodeURIComponent(req.query.pass))}.model`)});
    }
    else res.send({success: false});
});

module.exports = app;
