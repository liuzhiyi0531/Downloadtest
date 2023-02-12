require('dotenv').config();

const fs = require('fs');
const express = require('express');

const app = express.Router();

Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

/**
 * @swagger
 * /api/kamiya_stats/get_overview:
 *   get:
 *     tags:
 *       - Stats
 *     description: 获取生成次数概览
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: 返回overview.json
 */
app.get('/api/kamiya_stats/get_overview',(req,res) => {
    res.send(fs.readFileSync('./logs/overview.json'));
});

app.get('/api/kamiya_stats/get_drawoverview',(req,res) => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const log = JSON.parse(fs.readFileSync('./logs/' + date.format('yyyy-MM-dd') + '.json'));
    let t2i = 0,i2i = 0,novelai = 0,webui = 0;
    let overview = {},wh = {};
    for(let i in log) {
        const e = log[i];
        if(e.query.wh == 'image') {
            i2i++;
            if(e.query.dreambooth) {
                webui++;
            }
            else novelai++;
        }
        else {
            t2i++;
            if(e.query.dreambooth) {
                webui++;
            }
            else novelai++;
        }
        if(e.query.dreambooth) {
            const db = e.query.dreambooth;
            if(overview[db]) overview[db]++;
            else overview[db] = 1;
        }
        const qwh = e.query.wh;
        if(wh[qwh]) wh[qwh]++;
        else wh[qwh] = 1;
    }
    res.send({
        success: true,
        backend: {
            novelai: novelai,
            webui: webui
        },
        type: {
            t2i: t2i,
            i2i: i2i
        },
        model: overview,
        wh: wh
    });
});

app.get('/api/kamiya_stats/get_chatoverview',(req,res) => {
    res.send(fs.readFileSync('./logs/chatdemo.json'));
});

module.exports = app;