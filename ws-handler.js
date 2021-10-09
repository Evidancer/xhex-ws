const axios = require("axios");
const hc = require("./httpconfig.json");

const queue = {};
const rooms = {};
const inputs = {};

module.exports = function handler(ws) {
    console.log("There is a connection");

    ws.on("message", wsController.initValidate.bind(ws));

    ws.on("close", ()=>{
        console.log("closing connection");
    })
}

class wsController{
    /////////////////////////////////////////
    static router(req){
        console.log("Message!!");
        let ws = this;

        switch(req.type){
             case "req-inputs":
                (wsController.handleInputs.bind(ws))(req.data);
                break;
        }
    }

    ///////////////////

    static async initValidate(msg){
        let ws = this;
        let req = JSON.parse(msg.toString('utf-8'));
        
        console.log("message!");
        console.log(ws.verified);
        
        if(ws.verified){
            wsController.router.bind(ws)(req);
            return;
        }

        if(req.type != 'req-validate' 
        || !req.data.player.socket_id
        || !req.data.player.room){
            ws.close();
            return;
        }


        axios.post(`${hc.url}/api/validate`, {
            socket_id: req.data.player.socket_id, 
            room: req.data.player.room
        }).then((res)=>{
            res=res.data;

            if(!res.status){
                ws.close();
                return;
            }   

            ws.verified = true;
            ws.id = req.data.player.socket_id;
            let room = res.data.room;

            if(!(room.id in rooms)){
                rooms[room.id] = room;
            }

            rooms[room.id].players[ws.id].ws = ws;
            rooms[room.id].players[ws.id].status = 3;

            ws.send(JSON.stringify({
                type: "res-await",
                data: {
                    status: 1
                }
            }));

            wsController.checkFull(rooms[room.id]);

        }).catch((err)=>{

            console.log(err);
            ws.close();

        })
    }
    
    //////////////////////////

    static checkFull(room){

        let isFull = true;
        Object.values(room.players).forEach((pl)=>{
            if(pl.status != 3) isFull = false;
        });

        if(!isFull){
            return;
        }

        wsController.startGame(room);
    }

    /////////////////////////

    static startGame(room){
        room.round = 0;
        room.score = [0, 0];
        room.public.round = 0;
        room.public.score = [0, 0];

        Object.values(room.players)[0].team = 0;
        Object.values(room.players)[1].team = 1;        

        wsController.startRound(room);
    }

    ////////////////////////////

    static startRound(room){
        room.round++;

        Object.values(room.players)[0].unit = 0;
        Object.values(room.players)[1].unit = 1;  

        room.units = {
            veh:[
                {
                    id: 0,
                    team: 0,
                    bpos: [400, 700],
                    bang: -Math.PI/2,
                    tang: -Math.PI/2,
                    cooldowns: {
                        rg: 0
                    }
                },
                {
                    id: 1,
                    team: 1,
                    bpos: [400, 100],
                    bang: Math.PI/2,
                    tang: Math.PI/2,
                    cooldowns: {
                        rg: 0
                    }  
                }
            ],
            
            proj: []
            
        }

        Object.values(room.players).forEach(pl=>{
            inputs[pl.ws.id] = {
                dir:[0, 0],
                mb:[0, 0, 0],
                mc:[0, 0, 0],
                mpos: null
            }
        });

        Object.values(room.players).forEach(pl=>{
            pl.ws.send(JSON.stringify({
                type: "res-update-data",
                data: {
                    room: room.public,
                    team: pl.team
                }
            }));
            pl.ws.send(JSON.stringify({
                type: "res-start-countdown",
                data: { }
            }));
        });

        room.countdown = setTimeout(()=>{
            wsController.handleGame(room);
        }, 3000);
    }

    /////////////////////////////

    static handleGame(room){

        room.frameInterval = setInterval(()=>{
            
            Object.values(room.players).forEach((pl)=>{
                pl.ws.send(JSON.stringify({
                    type: "res-frame",
                    data: {
                        units: room.units
                    }
                }));
            });

            let roundStatus = wsController.calcFrame(room);

            if(~roundStatus){
                room.score[roundStatus]++;

                clearInterval(room.frameInterval);

                if(room.round == 4){
                    wsController.finishGame(room);
                } else {
                    wsController.startRound(room);
                }
            }

        }, 15);
        
    }

    /////////////////////////////

    static calcFrame(room){

        let veh = {
            vel: 8,
            avel: 0.1,
            rad: 60
        }

        let proj = {
            vel: 14,
        }

        let players = Object.values(room.players);
        let result = -1;

        players.forEach((pl)=>{
            let units = room.units;
            let pl_veh = units.veh[pl.unit];
            // let en_vehs = units.veh.filter((veh)=>{
            //     if(unit.id != pl.init) return true; 
            // });
            let pl_inputs = inputs[pl.ws.id];


            /*
                {
                    unit: ;
                    pos: [,];
                    vel: [,];
                    ang: ;
                }
            */

            // let en_projs = units.proj.fileter((p)=>{
            //     if(p.unit != pl.unit) return true;
            // });


            pl_veh.bang += veh.avel*pl_inputs.dir[1];

            let vel_vec = [
                pl_inputs.dir[0]*veh.vel*Math.cos(pl_veh.bang),
                pl_inputs.dir[0]*veh.vel*Math.sin(pl_veh.bang),
            ];

            pl_veh.bpos[0] += vel_vec[0];
            pl_veh.bpos[1] += vel_vec[1];

            if(pl_inputs.mpos)
                pl_veh.tang = getRelAngle(...pl_veh.bpos, ...pl_inputs.mpos);
            else
                pl_veh.tang = pl_veh.bang;

        });

        return -1;

        // function moveUnit(unit, inputs){
        //     let vel = 10;
        //     let rt = 300;
        //     let avel = 0.1;
                
        //     console.log(inputs.dir);
        //     if(inputs.dir){
        //         unit.bang += avel*inputs.dir[1];
        //         unit.bpos[0] += inputs.dir[0]*vel*Math.cos(unit.bang);
        //         unit.bpos[1] += inputs.dir[0]*vel*Math.sin(unit.bang);
        //     }
        

        // }

        function getAngle(x, y) {
            let a = (x<0||x>0&&y<0)?1: 0, b = (x>0&&y<0)? 2: 1;
            return a*b*Math.PI + Math.atan(y/x);
        }

        function getRelAngle(ox, oy, x, y){
            return getAngle(x-ox, y-oy);
        }
    }    

    /////////////////////////////

    static handleInputs(data){
        console.log(data);
        let ws = this;
        inputs[ws.id] = data;
    }

    //////////////////////////////

    static finishGame(room){
        room.players.forEach((el)=>{
            el.ws.close();
        });
    }

    //////////////////////////////////////////////////////////
}




// webSocketServer.on('connection', function(ws){

//     // console.log(ws);

//     let inputs = {
//         dir:null,
//         mb0:null,
//         mc0:null,
//         mb1:null,
//         mc1:null,
//         mb2:null,
//         mc2:null,
//         mpos: []
//     }
//     let unit = {
//         id: 0,
//         team: "red",
//         bpos: [400, 400],
//         bang: Math.PI/2,
//         tang: Math.PI/2,
//     };
//     ws.on('message', (m)=>{
//         inputs = JSON.parse(m.toString('utf-8'));
//         //console.log(inputs);
//     });
//     let seq = setInterval(function next(){
//         moveUnit(unit, inputs);
//         ws.send(JSON.stringify(unit));
//     }, 15);
//     ws.on('close', ()=>{
//         clearInterval(seq);
//         console.log("User left.");
//     })
// });



// function moveUnit(unit, inputs){
//     let vel = 10;
//     let rt = 300;
//     let avel = 0.1;

//     console.log(inputs.dir);
//     if(inputs.dir){
//         unit.bang += avel*inputs.dir[1];
//         unit.bpos[0] += inputs.dir[0]*vel*Math.cos(unit.bang);
//         unit.bpos[1] += inputs.dir[0]*vel*Math.sin(unit.bang);
//     }

//     if(inputs.mpos)
//         unit.tang = getRelAngle(...unit.bpos, ...inputs.mpos);
//     else
//         unit.tang = unit.bang;
// }

// function getAngle(x, y) {
//     let a = (x<0||x>0&&y<0)?1: 0, b = (x>0&&y<0)? 2: 1;
//     return a*b*Math.PI + Math.atan(y/x);
// }

// function getRelAngle(ox, oy, x, y){
//     return getAngle(x-ox, y-oy);
// }