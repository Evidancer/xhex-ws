const {Server} = require("ws");
const wsport = 81;



const webSocketServer = new Server({
    port: wsport
});


webSocketServer.on('connection', function(ws){
    console.log("There is a connection");
    // console.log(ws);

    let inputs = {
        dir:null,
        mb0:null,
        mc0:null,
        mb1:null,
        mc1:null,
        mb2:null,
        mc2:null,
        mpos: []
    }
    let unit = {
        id: 0,
        team: "red",
        bpos: [400, 400],
        bang: Math.PI/2,
        tang: Math.PI/2,
    };
    ws.on('message', (m)=>{
        inputs = JSON.parse(m.toString('utf-8'));
        //console.log(inputs);
    });
    let seq = setInterval(function next(){
        moveUnit(unit, inputs);
        ws.send(JSON.stringify(unit));
    }, 15);
    ws.on('close', ()=>{
        clearInterval(seq);
        console.log("User left.");
    })
});

function moveUnit(unit, inputs){
    let vel = 10;
    let rt = 300;
    let avel = 0.1;

    switch(inputs.dir){
        case "a":
            unit.bang -= avel;
            break;
        case "d":
            unit.bang += avel;
            break;
        case "w":
            unit.bpos[0] += vel*Math.cos(unit.bang);
            unit.bpos[1] += vel*Math.sin(unit.bang);
            break;
        case "s":
            unit.bpos[0] -= vel*Math.cos(unit.bang);
            unit.bpos[1] -= vel*Math.sin(unit.bang);
            break;
        case "wa":
            unit.bang -= avel;
            unit.bpos[0] += vel*Math.cos(unit.bang);
            unit.bpos[1] += vel*Math.sin(unit.bang);
            break;
        case "wd":
            unit.bang += avel;
            unit.bpos[0] += vel*Math.cos(unit.bang);
            unit.bpos[1] += vel*Math.sin(unit.bang);
            break;
        case "sa":
            unit.bang -= avel;
            unit.bpos[0] -= vel*Math.cos(unit.bang);
            unit.bpos[1] -= vel*Math.sin(unit.bang);
            break;
        case "sd":
            unit.bang += avel;
            unit.bpos[0] -= vel*Math.cos(unit.bang);
            unit.bpos[1] -= vel*Math.sin(unit.bang);
            break;
    }
    if(inputs.mpos)
        unit.tang = getRelAngle(...unit.bpos, ...inputs.mpos);
    else
        unit.tang = unit.bang;
}

function getAngle(x, y) {
    let a = (x<0||x>0&&y<0)?1: 0, b = (x>0&&y<0)? 2: 1;
    return a*b*Math.PI + Math.atan(y/x);
}

function getRelAngle(ox, oy, x, y){
    return getAngle(x-ox, y-oy);
}