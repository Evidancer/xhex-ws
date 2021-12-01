const axios = require("axios");
const hc = require("./httpconfig.json");

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
        
        //console.log(ws.verified);
        
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
                console.log("UNVALIDATED ACCESS");
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
            console.log("ERROR");
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
                        rg:1,
                    },
                },
                {
                    id: 1,
                    team: 1,
                    bpos: [400, 100],
                    bang: Math.PI/2,
                    tang: Math.PI/2,
                    cooldowns: {
                        rg: 1
                    }  
                }
            ],
            
            proj: [
                /*
                {
                    pos: [x, y],
                    ang: alpha,
                    team: int
                }
                */
            ]

            
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

        /* 
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
            
            proj: [
                {
                    pos: [x, y],
                    ang: alpha,
                    team: int
                }
            ]
            
        }
        */

        let vehSpec = {
            vel: 8,
            avel: 0.1,
            rad: 60
        }


        let projSpec = {
            vel: 14,
        }

        function pseudoScalar(P, A, B){
            return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]);
        }



        room.units.veh.forEach(el => {
            let sinA = Math.sin(el.bang), cosA = Math.cos(el.bang);
            el.vers = [
                [50*cosA - 30*sinA + el.bpos[0], 50*sinA + 30*cosA + el.bpos[1]],
                [-50*cosA - 30*sinA + el.bpos[0], -50*sinA + 30*cosA + el.bpos[1]],
                [-50*cosA - -30*sinA + el.bpos[0], -50*sinA + -30*cosA + el.bpos[1]],
                [50*cosA - -30*sinA + el.bpos[0], 50*sinA + -30*cosA + el.bpos[1]],
            ]
        });



        let players = Object.values(room.players);
        let result = -1;


        players.forEach((pl)=>{
            let units = room.units;
            let pl_veh = units.veh[pl.unit];

            let pl_inputs = inputs[pl.ws.id];

            
            //////////    СЧИТАЕМ ПОПАДАНИЯ И ДВИГАЕМ СНАРЯДЫ И УДАЛЯЕМ

            units.proj.forEach((p,i) => {
                let vel = [
                    projSpec.vel*Math.cos(p.ang),
                    projSpec.vel*Math.sin(p.ang),
                ];

                let deltaX = vel[0]/10;
                let deltaY = vel[1]/10;
                
                console.log(pl_veh.vers);

                console.log("p:");
                console.log(p);console.log("-----------------------------------");

                for(let i = 0; i < 10; ++i){
                    p.pos[0] += deltaX;
                    p.pos[1] += deltaY;
                     
                    let p1 = pseudoScalar(p.pos, pl_veh.vers[0],pl_veh.vers[1]);
                    let p2 = pseudoScalar(p.pos, pl_veh.vers[1],pl_veh.vers[2]);
                    let p3 = pseudoScalar(p.pos, pl_veh.vers[2],pl_veh.vers[3]);
                    let p4 = pseudoScalar(p.pos, pl_veh.vers[3],pl_veh.vers[0]);
                    
                    console.log("pps:");
                    console.log(p1 + " --- " + p2 + " --- " + p3 + " --- " + p4);

                    if(p1 >= 0 && p2 >= 0 && p3 >= 0 && p4>= 0 ||
                        p1 <= 0 && p2 <= 0 && p3 <= 0 && p4 <= 0){
                            result  = +!pl_veh.team;

                            console.log("HIT!!!!!!!!!!!!!!!");
                    }  
                }

                if(p.pos[0]**2 > 800**2 || p.pos[0] < 0 || p.pos[1]**2 > 800**2 || p.pos[1] < 0){
                    units.proj.splice(i,1);
                    console.log("OUT OF BOUNDS!!!!!!!________");
                }
            });            



            //////////  ДВИГАЕМ ТЕХНИКУ

            pl_veh.bang += vehSpec.avel*pl_inputs.dir[1];

            let vel_vec = [
                pl_inputs.dir[0]*vehSpec.vel*Math.cos(pl_veh.bang),
                pl_inputs.dir[0]*vehSpec.vel*Math.sin(pl_veh.bang),
            ];

            pl_veh.bpos[0] += vel_vec[0];
            pl_veh.bpos[1] += vel_vec[1];
            
            if(pl_veh.bpos[0] > 800){
                pl_veh.bpos[0] = 800;
            }
            if(pl_veh.bpos[0] < 0){
                pl_veh.bpos[0] = 0;
            }
            if(pl_veh.bpos[1] > 800){
                pl_veh.bpos[1] = 800;
            }
            if(pl_veh.bpos[1] < 0){
                pl_veh.bpos[1] = 0;
            }
            

            if(pl_inputs.mpos)
                pl_veh.tang = getRelAngle(...pl_veh.bpos, ...pl_inputs.mpos);
            else
                pl_veh.tang = pl_veh.bang;



            /////// СОЗДАЁМ СНАРЯДЫ

            if(pl_inputs.mb0 && !pl_veh.cooldowns.rg) {
                let np = {
                    pos:[
                        pl_veh.bpos[0] + 65*Math.cos(pl_veh.tang),
                        pl_veh.bpos[1] + 65*Math.sin(pl_veh.tang)
                    ],
                    ang: pl_veh.tang,
                    team: pl_veh.team
                };


                units.proj.push(np);
                pl_veh.cooldowns.rg = 90;
                
            } else if(pl_veh.cooldowns.rg > 0) {
                --pl_veh.cooldowns.rg;
            }

        });

        return result;

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
        let ws = this;
        inputs[ws.id] = data;
    }

    //////////////////////////////

    static finishGame(room){
        console.log(room.players);
        Object.values(room.players).forEach((el)=>{
            console.log("Finishng GAME");
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
