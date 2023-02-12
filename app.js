require('dotenv').config();

const fs = require('fs');
const express = require('express');
const request = require('then-request');
const cors = require('cors');
const bodyparser = require('body-parser');
const FormData = require('form-data');
const kv = require('./kamiya_modules/key-value');
const imageUpload = require('./kamiya_modules/image_upload');

process.env.TZ = 'Asia/Shanghai';

const app = express();

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'Kamiya Open API',
        version: '2022/11/30',
        description: 'Kamiya Open API 接口文档'
    },
    basePath: '/'
};

const swaggerSpec = swaggerJSDoc({
    swaggerDefinition: swaggerDefinition,
    apis: ['./app.js','./kamiya_routes/*.js']
});

app.get('/swagger.json', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static('public'));
app.use(bodyparser.json({ limit:'1000mb'}));

app.use(cors({
    origin: ['https://kamiya.dev','http://localhost:3000','https://v2.kamiya.dev','https://shop.kamiya.dev','http://127.0.0.1:11683'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
}));

// Main Database
const D = new kv('./data/data.json');
// Sessions
const S = new kv('./data/pass.json');
// Kamiya ID
const O = new kv('./data/openid.json');

function randomString(e) {    
    e = e || 32;
    let t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678#-=",
    a = t.length,
    n = "";
    for (i = 0; i < e; i++) n += t.charAt(Math.floor(Math.random() * a));
    return n
};

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

const adminPass = process.env.ADMINPASS;

/**
 * @swagger
 * components:
 *   ImageRequest:
 *     properties:
 *       pass:
 *         type: string
 *       prompt:
 *         type: string
 *       nprompt:
 *         type: string
 *       sampler:
 *         type: string
 *       wh:
 *         type: string
 *       step:
 *         type: integer
 *         minimum: 1
 *         maximum: 50
 *       scale:
 *         type: number
 *         minimum: 1
 *         maximum: 20
 *       seed:
 *         type: integer
 *         minimum: 1
 *         maximum: 4294967296
 *       resolution:
 *         type: string
 *         format: '512x512'
 *   ImageOutput:
 *     properties:
 *       success:
 *         type: boolean
 *       type:
 *         type: string
 *       backend:
 *         type: string
 *       output:
 *         type: object
 *       seed:
 *         type: integer
 */

/**
 * @swagger
 * /api/user_login:
 *   get:
 *     tags:
 *       - Session
 *     description: 用户登录
 *     produces:
 *       - text/plain
 *     parameters:
 *       - name: token
 *         description: 用户Token
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 返回Session Pass或failed
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
app.get('/api/user_login',(req,res) => {
    const token = decodeURIComponent(req.query.token);
    if(D.get(`${token}.available`)) {
        const r = randomString(64);
        S.put(`${r}.token`,token);
        S.put(`${r}.time`,Date.parse(new Date()));
        res.send(r);
    }
    else res.send('failed');
});

function check_pass(pass) {
    if(!S.get(`${pass}.logout`) && S.get(`${pass}.token`) && (Date.parse(new Date()) - S.get(`${pass}.time`)) < 604800000) return true;
    return false;
};

/**
 * @swagger
 * /api/pass_check:
 *   get:
 *     tags:
 *       - Session
 *     description: Session Pass检查
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
 *         description: 检查结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
app.get('/api/pass_check',(req,res) => {
    const pass = decodeURIComponent(req.query.pass);
    res.send({success: check_pass(pass)});
});

/**
 * @swagger
 * /api/user_logout:
 *   get:
 *     tags:
 *       - Session
 *     description: Session登出
 *     parameters:
 *       - name: pass
 *         description: Session Pass
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 登出返回
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 */
app.get('/api/user_logout',(req,res) => {
    const pass = decodeURIComponent(req.query.pass);
    if(pass) S.put(`${pass}.logout`,true);
    res.send({success: true});
});

/**
 * @swagger
 * /api/add_user:
 *   get:
 *     tags:
 *       - User
 *     description: 添加用户
 *     parameters:
 *       - name: adminPass
 *         description: Admin密钥
 *         in: query
 *         required: true
 *         type: string
 *       - name: from
 *         description: 用户来源
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 返回结果与用户Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 */
app.get('/api/add_user',(req,res) => {
    const T = randomString(16);
    if(req.query.adminPass == adminPass) {
        D.put(`${T}.available`,true);
        D.put(`${T}.left`,15);
        D.put(`${T}.group`,'Normal');
        if(req.query.from) {
            O.put(`${T}.from`,decodeURIComponent(req.query.from));
        }
        O.put(`${T}.date`,new Date());
        res.send({success: true,token: T});
    }
    else res.send({success: false});
});

function get_token(pass) {return S.get(`${pass}.token`);};
function get_left(token) {return D.get(`${token}.left`);};
function get_group(token) {return D.get(`${token}.group`);};

/**
 * @swagger
 * /api/openid/get_info:
 *   get:
 *     tags:
 *       - Kamiya ID
 *     description: 获取显示在Kamiya ID界面的信息
 *     parameters:
 *       - name: pass
 *         description: Session
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 查询结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 date:
 *                   type: string
 *                 from:
 *                   type: string
 *                 left:
 *                   type: integer
 *                 group:
 *                   type: string
 *                 dev:
 *                   type: object
 *                   properties:
 *                     on:
 *                       type: boolean
 *                     name:
 *                       type: string
 */
app.get('/api/openid/get_info',(req,res) => {
    const pass = decodeURIComponent(req.query.pass);
    if(check_pass(pass) && get_token(pass)) {
        let from,date,dev = {};
        if(O.get(`${get_token(pass)}.from`)) {
            from = O.get(`${get_token(pass)}.from`);
        }
        else from = 'Console';
        if(O.get(`${get_token(pass)}.date`)) {
            date = O.get(`${get_token(pass)}.date`);
        }
        else date = '预注册用户';
        if(O.get(`${get_token(pass)}.dev`)) {
            dev.on = true;
            dev.name = O.get(`${get_token(pass)}.name`);
        }
        else {
            dev.on = false;
            dev.name = '未参与社区贡献';
        }
        res.send({success: true,from: from,date: date,left: get_left(get_token(pass)),group: get_group(get_token(pass)),dev: dev});
    }
    else res.send({success: false});
});

/**
 * @swagger
 * /api/get_left:
 *   get:
 *     tags:
 *       - Image Generate
 *     description: 获取用户剩余生成次数
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: pass
 *         description: Session
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 查询结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 left:
 *                   type: integer
 *                 group:
 *                   type: string
 */
app.get('/api/get_left',(req,res) => {
    const pass = decodeURIComponent(req.query.pass);
    if(check_pass(pass) && get_token(pass)) {
        res.send({success: true,left: get_left(get_token(pass)),group: get_group(get_token(pass))});
    }
    else res.send({success: false});
});

app.get('/api/checkin',(req,res) => {
    const pass = decodeURIComponent(req.query.pass);
    const token = get_token(pass);
    const response = decodeURIComponent(req.query.token);
    if(token && response) {
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
            if(dateFormat("YYYY-mm-dd",new Date(S.get(`${token}.last`))) != dateFormat("YYYY-mm-dd",new Date())) {
                D.put(`${token}.left`,D.get(`${token}.left`) * 1 + 90);
                S.put(`${token}.last`,Date.parse(new Date()));
                res.send({success: true,message: '已获得90魔晶点数'});
            }
            else res.send({success: false,message: '每天仅可签到一次'});
        },(e) =>{
            console.log(e);
            res.send({success: false,message: 'API回调失败'});
        });
    }
    else res.send({success: false,message: '人机验证失败'});
});

function check_config(config) {
    const check1 = /^[0-9]+.?[0-9]*/;
    const sampler = ['k_euler_ancestral','k_euler','k_lms','plms','ddim','Euler a','Euler','LMS','PLMS','DDIM'];
    const wh = ['landscape','portrait','square','landscape_l','portrait_l','square_l','custom','image'];
    if(check1.test(config.step) && check1.test(config.scale) && check1.test(config.seed)) {
        if((sampler.indexOf(config.sampler) != -1) && (wh.indexOf(config.wh) != -1)) {
            return true;
        }
    }
    return false;
}

function pick_webui() {
    const webuiL = JSON.parse(fs.readFileSync('./data/backend.json')).webui;
    let node,i = 0;
    do {
        node = webuiL[Math.floor(Math.random() * webuiL.length)];
        i++;
        if(i > webuiL.length) return null;
    }
    while (!JSON.parse(fs.readFileSync('./data/backend_cache/' + node.id + '.json')).online);
    return node;
}

function pick_model(node,name) {
    const cache = JSON.parse(fs.readFileSync('./data/backend_cache/' + node.id + '.json'));
    for (let i in cache.checkpoints) {
        if(cache.checkpoints[i].model_name == name) return cache.checkpoints[i].title;
    }
    return pick_model(node,'model');
}

function new_log(body) {
    return new Promise((resolve, reject) => {
        let tl;
        try {
            tl = JSON.parse(fs.readFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(body.time)) + '.json'));
        }
        catch (e) {
            fs.writeFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(body.time)) + '.json','[]');
            tl = [];
        }
        if(body.query.image) {
            fs.writeFileSync('./logs/images/' + body.id + '.json',JSON.stringify({image: body.query.image},0,2));
            delete body.query.image;
        }
        tl.push(body);
        fs.writeFileSync('./logs/' + dateFormat("YYYY-mm-dd",new Date(body.time)) + '.json',JSON.stringify(tl,0,2));
        let o = JSON.parse(fs.readFileSync('./logs/overview.json'));
        if(o.total) o.total += 1;
        else o.total = 1;
        if(o[dateFormat("YYYY-mm-dd",new Date(body.time))]) o[dateFormat("YYYY-mm-dd",new Date(body.time))] += 1;
        else o[dateFormat("YYYY-mm-dd",new Date(body.time))] = 1;
        fs.writeFileSync('./logs/overview.json',JSON.stringify(o,0,2));
        fs.writeFileSync('./logs/lastlog.json',JSON.stringify({time: new Date()}));
        resolve(true);
    });
}

/**
 * @swagger
 * /api/generate-image:
 *   post:
 *     tags:
 *       - Image Generate
 *     description: 生成图像
 *     requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/ImageRequest'
 *     responses:
 *       200:
 *         description: 生成结果 output对象解析方法见 https://git.hudaye.work/MiuliKain/Kamiya-ProductUI/src/branch/master/public/index.html#L583
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/ImageOutput'
 *         schema:
 *           properties:
 *             success:
 *               type: boolean
 *             left:
 *               type: integer
 *             group:
 *               type: string
 */
app.post('/api/generate-image',(req,res) => {
    //console.log(req.body);

    const pass = req.body.pass;

    //console.log(req.body.pass,check_pass(pass),get_token(pass));

    if(!pass || !check_pass(pass)) {res.send({success: false});return;};
    const token = get_token(pass);
    if(!(get_left(token) > 0)) {res.send({success: false,message: '剩余生成次数不足'});return;};
    
    let config = {
        prompt: req.body.prompt,
        nprompt: req.body.nprompt,
        step: req.body.step,
        scale: req.body.scale,
        seed: req.body.seed,
        sampler:req.body.sampler,
        wh: req.body.wh,
        image: req.body.image,
        resolution: req.body.resolution
    };

    if(check_config(config)) {
        const backendL = JSON.parse(fs.readFileSync('./data/backend.json'));
        
        config.step = Math.floor(config.step);
        config.scale = Math.floor(config.scale);
        config.seed = Math.floor(config.seed);
        
        if(!config.image) if(config.step > 28 && get_group(token) == 'Normal') {res.send({success: false,message: '当前用户组无权执行该生成请求'});return;};
        if(!backendL.enable.self && !config.resolution) if(config.step > 28 && !req.body.dreambooth) {res.send({success: false,message: '因为Dreambooth Beta，我们暂停了高于28次迭代的生成。'});return;};
        if(config.step > 50) {res.send({success: false,message: '在实例上执行50次以上迭代时将长时间占用队列'});return;};

        let data = {};
        data.seed = config.seed;
        data.sampler = config.sampler;
        data.steps = config.step;
        data.scale = config.scale;
        data.n_samples = 1;

        if(config.nprompt) data.uc = config.nprompt;
        else data.uc = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';

        data.prompt = config.prompt;

        let cost = 1;

        function customResolution(res,customMax) {
            const maxResolution = customMax || 1024; //Max Square Resolution
            const s = res.split('x');
            if(s.length == 2) {
                //console.log(s);
                let r = {};
                if(s[0] * 1 > s[1] * 1) {
                    r.width = maxResolution;
                    r.height = Math.floor(maxResolution * (s[1]/s[0]));
                    let ad = 0;
                    while (ad < r.height) {
                        ad += 64;
                    }
                    r.height = ad;
                }
                else {
                    r.width = Math.floor(maxResolution * (s[0]/s[1]));
                    r.height = maxResolution;
                    let ad = 0;
                    while (ad < r.width) {
                        ad += 64;
                    }
                    r.width = ad;
                }
                if(s[0] < maxResolution && s[1] < maxResolution) {
                    r.width = s[0];
                    let ad = 0;
                    while (ad < r.width) {
                        ad += 64;
                    }
                    r.width = ad;
                    r.height = s[1];
                    ad = 0;
                    while (ad < r.height) {
                        ad += 64;
                    }
                    r.height = ad;
                }
                return r;
            }
        }

        switch(config.wh) {
            case 'landscape': {
                data.width = 768;
                data.height = 512;
                break;
            }
            case 'portrait': {
                data.width = 512;
                data.height = 768;
                break;
            }
            case 'square': {
                data.width = 512;
                data.height = 512;
                break;
            }
            case 'landscape_l': {
                data.width = 1024;
                data.height = 512;
                break;
            }
            case 'portrait_l': {
                data.width = 512;
                data.height = 1024;
                break;
            }
            case 'square_l': {
                data.width = 768;
                data.height = 768;
                break;
            }
            default: {
                data.width = 512;
                data.height = 768;
            }
        };

        if(config.resolution) {
            let cr = customResolution(config.resolution);
            if(config.image) cr = customResolution(config.resolution,960);
            data.width = cr.width;
            data.height = cr.height;
        }

        //if(data.width <= 512 && data.height <= 512) cost = cost / 2;
        if(data.width * data.height > 393216) cost = cost * 2;
        if(config.image) cost = cost * 2;

        const log_id = uuid();

        new_log({
            tag: 'imagedraw',
            id: log_id,
            token: token,
            ip: req.headers['x-forwarded-for'],
            group: get_group(token),
            left: get_left(token),
            query: req.body,
            time: new Date()
        });

        let node;

        if(req.body.dreambooth) {
            node = pick_webui();
            let dreambooth = decodeURIComponent(req.body.dreambooth);
            dreambooth = pick_model(node,dreambooth);
            request('POST',node.url + '/run/predict/',{json: {data: [dreambooth],fn_index: node.predict_index}}).done(() => {
                if(config.image) {
                    let wdata = {
                        mode: 0,
                        prompt: data.prompt,
                        negative_prompt: data.uc,
                        prompt_style: 'None',
                        prompt_style2: 'None',
                        init_images: [config.image],
                        mask_mode: 'Draw mask',
                        steps: data.steps,
                        sampler_index: data.sampler.replace('k_euler_ancestral','Euler a').replace('k_euler','Euler').replace('k_lms','LMS').replace('plms','PLMS').replace('ddim','DDIM'),
                        mask_blur: 4,
                        inpainting_fill: 0,
                        restore_faces: false,
                        tiling: false,
                        n_iter: 1,
                        batch_size: 1,
                        cfg_scale: data.scale,
                        seed: data.seed,
                        subseed: -1,
                        subseed_strength: 0,
                        seed_resize_from_h: 0,
                        seed_resize_from_w: 0,
                        seed_enable_extras: false,
                        resize_mode: 0,
                        inpaint_full_res: false,
                        inpaint_full_res_padding: 32,
                        inpaint_mask_invert: 'Inpaint masked',
                        height: data.height,
                        width: data.width,
                        enable_hr: false,
                        denoising_strength: 0.75,
                        firstphase_width: 0,
                        firstphase_height:0
                    };
                    request('POST',node.url + '/sdapi/v1/img2img',{json:wdata}).getBody('utf8').then(JSON.parse).done(function(R) {
                        D.put(`${token}.left`,get_left(token) - cost);
                        res.send({seed: data.seed,success: true,backend: node.name,type: 'webui',output: R});
                        imageUpload('data:image/png;base64,' + R.images[0],token);
                    },() =>{
                        res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
                    });
                }
                else {
                    let wdata = {
                        prompt: data.prompt,
                        negative_prompt: data.uc,
                        prompt_style: 'None',
                        prompt_style2: 'None',
                        steps: data.steps,
                        sampler_index: data.sampler.replace('k_euler_ancestral','Euler a').replace('k_euler','Euler').replace('k_lms','LMS').replace('plms','PLMS').replace('ddim','DDIM'),
                        restore_faces: false,
                        tiling: false,
                        n_iter: 1,
                        batch_size: 1,
                        cfg_scale: data.scale,
                        seed: data.seed,
                        subseed: -1,
                        subseed_strength: 0,
                        seed_resize_from_h: 0,
                        seed_resize_from_w: 0,
                        seed_enable_extras: false,
                        height: data.height,
                        width: data.width,
                        enable_hr: false,
                        denoising_strength: 0.7,
                        firstphase_width: 0,
                        firstphase_height:0
                    };
                    request('POST',node.url + '/sdapi/v1/txt2img',{json:wdata}).getBody('utf8').then(JSON.parse).done(function(R) {
                        D.put(`${token}.left`,get_left(token) - cost);
                        res.send({seed: data.seed,success: true,backend: node.name,type: 'webui',output: R});
                        imageUpload('data:image/png;base64,' + R.images[0],token);
                    },() =>{
                        res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
                    });
                }
            },() =>{
                res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
            });
            return;
        }

        //Normal IMG2IMG Process
        if(config.image) {
            data.steps = 50;

            let rn = Math.random();

            if(!backendL.enable.webui) rn = 0.74;

            if(!backendL.enable.webui && !backendL.enable.novelai_img2img) {
                res.send({success: false,message: '当前无可用的IMG2IMG后端'});
                return;
            }

            if(rn < 0.75 && backendL.enable.novelai_img2img) {
                node = backendL.novelai[Math.floor(Math.random() * backendL.novelai.length)];
                data.image = config.image.split('base64,')[1];
                let ndata = {
                    input: data.prompt,
                    model: 'nai-diffusion',
                    parameters: data
                }
                ndata.parameters.strength = 0.7;
                ndata.parameters.noise = 0.2;
                ndata.parameters.ucPreset = 0;
                ndata.parameters.qualityToggle = true;
                //console.log(ndata);
                request('POST','https://api.novelai.net/ai/generate-image',{json:ndata,headers:{authorization: 'Bearer ' + node.token}}).getBody('utf8').done(function(R) {
                    D.put(`${token}.left`,get_left(token) - cost);
                    res.send({seed: data.seed,success: true,backend: node.name,type: 'novelai',output: R});
                    imageUpload('data:image/png;base64,' + R.split('data:')[1],token);
                },() =>{
                    res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
                });
            }
            else {
                node = pick_webui();
                const dreambooth = pick_model(node,'model');
                request('POST',node.url + '/run/predict/',{json: {data: [dreambooth],fn_index: node.predict_index}}).done(() => {
                    let wdata = {
                        mode: 0,
                        prompt: data.prompt,
                        negative_prompt: data.uc,
                        prompt_style: 'None',
                        prompt_style2: 'None',
                        init_images: [config.image],
                        mask_mode: 'Draw mask',
                        steps: data.steps,
                        sampler_index: data.sampler.replace('k_euler_ancestral','Euler a').replace('k_euler','Euler').replace('k_lms','LMS').replace('plms','PLMS').replace('ddim','DDIM'),
                        mask_blur: 4,
                        inpainting_fill: 0,
                        restore_faces: false,
                        tiling: false,
                        n_iter: 1,
                        batch_size: 1,
                        cfg_scale: data.scale,
                        seed: data.seed,
                        subseed: -1,
                        subseed_strength: 0,
                        seed_resize_from_h: 0,
                        seed_resize_from_w: 0,
                        seed_enable_extras: false,
                        resize_mode: 0,
                        inpaint_full_res: false,
                        inpaint_full_res_padding: 32,
                        inpaint_mask_invert: 'Inpaint masked',
                        height: data.height,
                        width: data.width,
                        enable_hr: false,
                        denoising_strength: 0.75,
                        firstphase_width: 0,
                        firstphase_height:0
                    };
                    request('POST',node.url + '/sdapi/v1/img2img',{json:wdata}).getBody('utf8').then(JSON.parse).done(function(R) {
                        D.put(`${token}.left`,get_left(token) - cost);
                        res.send({seed: data.seed,success: true,backend: node.name,type: 'webui',output: R});
                        imageUpload('data:image/png;base64,' + R.images[0],token);
                    },() =>{
                        res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
                    });
                });
            }
            return;
        }

        //Normal TXT2IMG Process
        let rn = Math.random();

        if(!backendL.enable.novelai_img2img && data.width * data.height > 393216) rn = 0.76;

        if(rn < 0.5) {
            node = backendL.novelai[Math.floor(Math.random() * backendL.novelai.length)];
            let ndata = {
                input: data.prompt,
                model: 'nai-diffusion',
                parameters: data
            };
            ndata.parameters.ucPreset = 0;
            ndata.parameters.qualityToggle = true;
            request('POST','https://api.novelai.net/ai/generate-image',{json:ndata,headers:{authorization: 'Bearer ' + node.token}}).getBody('utf8').done(function(R) {
                D.put(`${token}.left`,get_left(token) - cost);
                res.send({seed: data.seed,success: true,backend: node.name,type: 'novelai',output: R});
                imageUpload('data:image/png;base64,' + R.split('data:')[1],token);
            },() =>{
                res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
            });
        }
        else {
            node = pick_webui();
            const dreambooth = pick_model(node,'model');
            request('POST',node.url + '/run/predict/',{json: {data: [dreambooth],fn_index: node.predict_index}}).done(() => {
                let wdata = {
                    prompt: data.prompt,
                    negative_prompt: data.uc,
                    prompt_style: 'None',
                    prompt_style2: 'None',
                    steps: data.steps,
                    sampler_index: data.sampler.replace('k_euler_ancestral','Euler a').replace('k_euler','Euler').replace('k_lms','LMS').replace('plms','PLMS').replace('ddim','DDIM'),
                    restore_faces: false,
                    tiling: false,
                    n_iter: 1,
                    batch_size: 1,
                    cfg_scale: data.scale,
                    seed: data.seed,
                    subseed: -1,
                    subseed_strength: 0,
                    seed_resize_from_h: 0,
                    seed_resize_from_w: 0,
                    seed_enable_extras: false,
                    height: data.height,
                    width: data.width,
                    enable_hr: false,
                    denoising_strength: 0.7,
                    firstphase_width: 0,
                    firstphase_height:0
                };
                request('POST',node.url + '/sdapi/v1/txt2img',{json:wdata}).getBody('utf8').then(JSON.parse).done(function(R) {
                    D.put(`${token}.left`,get_left(token) - cost);
                    res.send({seed: data.seed,success: true,backend: node.name,type: 'webui',output: R});
                    imageUpload('data:image/png;base64,' + R.images[0],token);
                },(e) =>{
                    res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
                });
            },() =>{
                res.send({success: false,message: 'Kamiya 图像生成后端错误，将此ID上报以快速定位此次错误 ' + log_id});
            });
        }
    }
    else res.send({success: false,message: '传入参数校验失败'});
});

const load = () => J = JSON.parse(fs.readFileSync('./data/tags.json'));

/**
 * @swagger
 * /api/tagbook/get_json:
 *   get:
 *     tags:
 *       - Tag Book
 *     description: 获取Tag数据库
 *     responses:
 *       200:
 *         description: 返回数据库JSON
 */
app.get('/api/tagbook/get_json',(req,res) => {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.send(fs.readFileSync('./data/tags.json'));
});

/**
 * @swagger
 * /api/tagbook/re_tag:
 *   get:
 *     tags:
 *       - Tag Book
 *     description: 将英文Tag翻译为中文
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: q
 *         description: 英文Tag
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: 翻译结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dst:
 *                   type: string
 */
app.get('/api/tagbook/re_tag',(req,res) => {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.query.q) {
        let sq = req.query.q.replace(/\{|}/g,'').split(',');;
        for(let k = 0;k < sq.length;k++) {
            for(let i = 0;i < J.class.length;i++) {
                for(let j = 0;j < J.class[i].data.length;j++) {
                    if(sq[k] == J.class[i].data[j].en) sq[k] = sq[k].replace(J.class[i].data[j].en,J.class[i].data[j].zh);
                };
            };
        };
        let str = '';
        for(let i = 0;i < sq.length;i++) str += `${sq[i]},`;
        res.send(JSON.stringify({dst:str}));
    }
    else res.send('fail');
});

/**
 * @swagger
 * /api/magic/get_json:
 *   get:
 *     tags:
 *       - Prompts
 *     description: 获取社区Prompt列表
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: 返回列表
 */
app.get('/api/magic/get_json',(req,res) => {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.send(fs.readFileSync('./data/magic.json'));
});

app.use('/qqmid',require('./kamiya_routes/qqmiddleware'));

app.use('/',require('./kamiya_routes/dreambooth'));

app.use('/',require('./kamiya_routes/backend_checker'));

app.use('/',require('./kamiya_routes/user_content'));

app.use('/',require('./kamiya_routes/kamiya_stats'));

app.use('/',require('./kamiya_routes/aws_s3_worker'));

app.use('/',require('./kamiya_routes/kamiya_openai'));

app.use('/',require('./kamiya_routes/application_gateway'));

app.use('/',require('./kamiya_routes/custom_s3_worker'));

app.use('/',require('./kamiya_routes/bunny_worker'));

app.listen(process.env.PORT, () => {
    load();
    console.log(`App listening on port ${process.env.PORT}.`);
});