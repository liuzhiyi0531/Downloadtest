# Kamiya Product UI
## 简介
本Repo储存了Kamiya现阶段部署的UI的全部源代码，本项目基于NodeJS与Express实现。本仓库的代码处于快速迭代阶段，如果希望使用我们维护的稳定版本，可以查看[Kamiya Open UI](https://git.hudaye.work/MiuliKain/Kamiya-OpenUI)，该仓库将发布面向用户的稳定分支。
## Usage
将 `data.exam` 与 `.env.exam` 去掉后缀，按格式配置
其中后端示例如下
```json
{
    "novelai":[
        {
            "name":"NovelAI Provider",
            "token":"<your novelai token>"
        }
    ],
    "webui": [
        {
            "id": "tcloud-1",
            "name":"Tencent Cloud Guangzhou Node",
            "url":"http://<ip>:<port>"
        }
    ],
    "enable":{
        "novelai": true,
        "webui": true,
        "novelai_img2img": true
    }
}
```
其中，webui指开启了API模式的[WebUI项目](https://github.com/AUTOMATIC1111/stable-diffusion-webui/).
### Run
```shell
npm install
npm install pm2 -g
pm2 start pm2.json
```
或
```shell
node app.js && node telegram.js
```
或
```shell
npm install forever -g
forever start app.js
forever start telegram.js
```
## 有关代码
由于本人只是业余全栈开发者，能力与精力有限，所以在某些方面可能有严重瑕疵，比如后端使用了低效率的数据库解决方案而前端也同样用了比较低端的解决方案；请路过大佬在轻喷的同时考虑帮帮孩子。