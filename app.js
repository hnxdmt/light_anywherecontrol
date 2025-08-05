const Koa = require('koa');
const koaBody = require('koa-body');
const koaSend = require('koa-send');
const fs = require('fs');
const path = require('path');
const views = require('koa-views');
const json = require('koa-json');
const onerror = require('koa-onerror');
const bodyparser = require('koa-bodyparser');
const logger = require('koa-logger');
const cors = require('koa2-cors');
const session = require('koa-generic-session');
const mqtt = require('mqtt');
const {mqttsave, mqttupdate,isJSON} = require('./services/MqttSave');

const api = require('./routes/api');
const app = new Koa();
    app.proxy = true;
// error handler
onerror(app);

// middlewares
/*app.use(bodyparser({
    enableTypes: ['json', 'form', 'text']
}));*/
app.use(json());
app.use(koaBody({
    multipart:true, // 支持文件上传
    formidable: {
        uploadDir: path.join('public/upload/'),
        keepExtensions: true,
        maxFieldsSize: 10 * 1024 * 1024,
        onFileBegin: (name, file) => {
            console.log(file.path);
        },
        onError:(err)=>{
            console.log(err);
        }
    },
    enableTypes: ['json', 'form', 'text']
}));
app.use(logger());
app.use(cors());
app.keys = ['my secret key'];
app.use(session());
app.use(require('koa-static')(__dirname + '/public'));

app.use(views(__dirname + '/views', {
    extension: 'pug'
}));

// logger
app.use(async (ctx, next) => {
    const start = new Date()
    await next()
    const ms = new Date() - start
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms - ${ctx.request.ip}`)
});

// routes
app.use(api.routes(), api.allowedMethods());

// error-handling
app.on('error', (err, ctx) => {
    console.error('server error', err, ctx)
});

const mqtt_client = mqtt.connect('mqtt://www.anywherecontrol.com', {
    username: 'myweb',
    password: 'xtdmtygm7828',
    clientId: 'HNXT000000',
    port: '1993'
});
mqtt_client.on('connect', function () {
    console.log('MqttServer Connect Port 1993!');
    mqtt_client.subscribe('MST2SER/#');
    mqtt_client.subscribe('SER2MST/#');
    mqtt_client.subscribe('WEB2MST/#');
    mqtt_client.subscribe('$SYS/brokers/+/clients/#')
});

mqtt_client.on('message', function (topic, message) {
    console.log(topic.toString(), message.toString());
    if (topic.toString().indexOf("WEB2SER/USER") === 0 || topic.toString().indexOf("$SYS") === 0 || message.toString().indexOf("MST:") === 0) {
        console.log(topic.toString(), message.toString())
    } else if ((topic.toString().indexOf("MST2SER/HD") === 0 || topic.toString().indexOf("SER2MST/HD") === 0) && (isJSON(message.toString()))) {
        mqttupdate(topic, message);
        console.log(topic.toString(), message.toString());
    } else if ((topic.toString().indexOf("WEB2MST/HD") === 0) && (isJSON(message.toString()))) {
        mqttsave(topic, message);
    }
});

mqtt_client.on('error', function (err) {
    console.log(err);
});

mqtt_client.on('offline', function () {
    mqtt_client.reconnect();
});

module.exports = app;
