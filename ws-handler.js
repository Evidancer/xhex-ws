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
        room.public.score = [0, 0];
        room.public.round = 0;
        room.public.score = [0, 0];
        room.public.hits = [0, 0];
        room.public.misses = [0, 0];
        room.public.deflects = [0, 0];

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
                    statuses:{
                        shield:false,
                        shot:false,
                        antiarmor:false,
                    },
                    cooldowns: {
                        rg:0,
                        sh:0,
                    },
                    hp: 3,
                },
                {
                    id: 1,
                    team: 1,
                    bpos: [400, 100],
                    bang: Math.PI/2,
                    tang: Math.PI/2,
                    statuses:{
                        shield:false,
                        shot:false,
                        antiarmor:false,
                    },
                    cooldowns: {
                        rg:0,
                        sh:0,
                    },
                    hp: 3,
                }
            ],
            
            proj: [
                /*
                {
                    pos: [x, y],
                    ang: alpha,
                    team: int,
                    antiarmor: bool
                }
                */
            ],

            blocks:[
                // {
                //     pos:[x,y],
                //     ang:alpha,
                //     vers: [[,],[,],[,],[,]];
                // }                

            ],

            items:[
                {
                    pos: [400, 400],
                    ang: 0,
                    type: 0, // heal,
                    cd: 720,
                    stdcd: 720,
                    status: false,
                },
                {
                    pos: [400, 700],
                    ang: 0,
                    type: 1, // antiarmor,
                    cd: 600,
                    stdcd: 600,
                    status: false,
                },
                {
                    pos: [400, 100],
                    ang: 0,
                    type: 1, // antiarmor,
                    cd: 600,
                    stdcd: 600,
                    status: false,
                }
            ]
            
        }

        for(let i = 1; i <= 20; ++i){
            room.units.blocks.push(
                {
                    hp:7,
                    pos:[40*i-20,-20],ang:0,
                    vers:[
                        [40*i, 0],
                        [40*i, -40],
                        [40*i-40, -40],
                        [40*i-40, 0],
                    ],
                },
                {
                    hp:7,
                    pos:[40*i-20,820],ang:0,
                    vers:[
                        [40*i, 840],
                        [40*i, 800],
                        [40*i-40, 800],
                        [40*i-40, 840],
                    ],
                },
                {
                    hp:7,
                    pos:[-20,40*i-20],ang:0,
                    vers:[
                        [0, 40*i],
                        [-40, 40*i],
                        [-40, 40*i-40],
                        [0, 40*i-40],
                    ],
                },
                {
                    hp:7,
                    pos:[820, 40*i-20],ang:0,
                    vers:[
                        [840, 40*i],
                        [800, 40*i],
                        [800, 40*i-40],
                        [840, 40*i-40],
                    ],
                }
            );
        }

        for(let i = 1; i <= 6; ++i){
            room.units.blocks.push(
                {
                    hp:7,
                    pos:[280+40*i-20, 260],ang:0,
                    vers:[
                        [280+40*i, 280],
                        [280+40*i, 240],
                        [280+40*i-40, 240],
                        [280+40*i-40, 280],
                    ]
                },
                {
                    hp:7,
                    pos:[280+40*i-20, 540],ang:0,
                    vers:[
                        [280+40*i, 560],
                        [280+40*i, 520],
                        [280+40*i-40, 520],
                        [280+40*i-40, 560],
                    ]
                },
            );
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
                        units: room.units,
                        score: room.public.score,
                    }
                }));
            });

            let roundStatus = wsController.calcFrame(room);
            
            if(~roundStatus){

                room.public.score[roundStatus]++;

                clearInterval(room.frameInterval);

                if(room.round == 6){
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
                    team: int,
                    antiarmor: bool
                }
            ]
            
        }
        */

        // let vehSpec = {
        //     vel: 8,
        //     avel: 0.1,
        //     rad: 60
        // }

        
        let vehSpec = {
            vel: 5,
            avel: 0.05,
            rad: 60
        }


        let projSpec = {
            vel: 9,
        }

        // let projSpec = {
        //     vel: 14,
        // }

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

        
        ///////////////////// ?????????????? ????????????????

        room.units.items.forEach(item=>{
            if(item.cd <= 0 && !item.status){
                item.status = true;
                item.cd = item.stdcd;
            } else if(item.cd > 0 && !item.status) {
                --item.cd;
            }
        });





        let players = Object.values(room.players);
        let result = -1;


        players.forEach((pl)=>{
            let units = room.units;
            let pl_veh = units.veh[pl.unit];

            let pl_inputs = inputs[pl.ws.id];

            
            //////////    ?????????????? ?????????????????? ?? ??????????????, ???????????????? ?????????????? ?? ??????????????

            units.proj.forEach((p,i) => {
                let vel = [
                    projSpec.vel*Math.cos(p.ang),
                    projSpec.vel*Math.sin(p.ang),
                ];

                let deltaX = vel[0]/10;
                let deltaY = vel[1]/10;

                

                let intersects = false;
                for(let block of units.blocks){
                    let p1 = pseudoScalar(p.pos, block.vers[0],block.vers[1]);
                    let p2 = pseudoScalar(p.pos, block.vers[1],block.vers[2]);
                    let p3 = pseudoScalar(p.pos, block.vers[2],block.vers[3]);
                    let p4 = pseudoScalar(p.pos, block.vers[3],block.vers[0]);

                    if(p1 >= 0 && p2 >= 0 && p3 >= 0 && p4>= 0 ||
                       p1 <= 0 && p2 <= 0 && p3 <= 0 && p4 <= 0){
                            intersects = true;
                    }
                    if(intersects){
                        if (p.antiarmor){
                            units.blocks.splice(units.blocks.indexOf(block),1);
                            units.proj.splice(i,1);
                            return;
                        }
                        block.hp--;
                        if(block.hp <= 0){
                            units.blocks.splice(units.blocks.indexOf(block),1);
                        }
                        units.proj.splice(i,1);
                        return;              
                    }
                }
                 
                


                let shot = false;

                for(let i = 0; i < 10; ++i){
                    p.pos[0] += deltaX;
                    p.pos[1] += deltaY;
                    
                    if(p.team == pl_veh.team){
                        continue;
                    }

                    let p1 = pseudoScalar(p.pos, pl_veh.vers[0],pl_veh.vers[1]);
                    let p2 = pseudoScalar(p.pos, pl_veh.vers[1],pl_veh.vers[2]);
                    let p3 = pseudoScalar(p.pos, pl_veh.vers[2],pl_veh.vers[3]);
                    let p4 = pseudoScalar(p.pos, pl_veh.vers[3],pl_veh.vers[0]);

                    if((p.pos[0]-pl_veh.bpos[0])**2 + (p.pos[1]-pl_veh.bpos[1])**2 <= 4000 
                        && pl_veh.statuses.shield 
                        && !p.antiarmor){
                        // units.proj.splice(i,1);
                        p.team = +!p.team;

                        p.ang = (
                            Math.PI + 2*getAngle((p.pos[0]-pl_veh.bpos[0]),(p.pos[1]-pl_veh.bpos[1])) - p.ang
                        );

                        room.public.deflects[pl_veh.id]++;
                        room.public.misses[+!pl_veh.id]--;
                        break;
                    } else if(p1 >= 0 && p2 >= 0 && p3 >= 0 && p4>= 0 ||
                        p1 <= 0 && p2 <= 0 && p3 <= 0 && p4 <= 0){
                            shot = true;
                            break;
                    }
                }

                if(shot){
                    units.proj.splice(i,1);
                    --pl_veh.hp;
                    room.public.hits[+!pl_veh.id]++;
                    room.public.misses[+!pl_veh.id]--;
                } 
                if(!pl_veh.hp){
                    result = +!pl_veh.team;
                 }
                


                if(p.pos[0]**2 > 800**2 || p.pos[0] < 0 || p.pos[1]**2 > 800**2 || p.pos[1] < 0){
                    units.proj.splice(i,1);
                }
            });            



            //////////  ?????????????? ??????????????

            let newData = {bpos:[pl_veh.bpos[0],pl_veh.bpos[1]], bang:pl_veh.bang};

            newData.bang += vehSpec.avel*pl_inputs.dir[1];

            let vel_vec = [
                pl_inputs.dir[0]*vehSpec.vel*Math.cos(newData.bang),
                pl_inputs.dir[0]*vehSpec.vel*Math.sin(newData.bang),
            ];

            newData.bpos[0] += vel_vec[0];
            newData.bpos[1] += vel_vec[1];
            
            if(newData.bpos[0] > 800){
                newData.bpos[0] = 800;
            }
            if(newData.bpos[0] < 0){
                newData.bpos[0] = 0;
            }
            if(newData.bpos[1] > 800){
                newData.bpos[1] = 800;
            }
            if(newData.bpos[1] < 0){
                newData.bpos[1] = 0;
            }
            
            let sinA = Math.sin(newData.bang), cosA = Math.cos(newData.bang);
            newData.vers = [
                [50*cosA - 30*sinA + newData.bpos[0], 50*sinA + 30*cosA + newData.bpos[1]],
                [-50*cosA - 30*sinA + newData.bpos[0], -50*sinA + 30*cosA + newData.bpos[1]],
                [-50*cosA - -30*sinA + newData.bpos[0], -50*sinA + -30*cosA + newData.bpos[1]],
                [50*cosA - -30*sinA + newData.bpos[0], 50*sinA + -30*cosA + newData.bpos[1]],
            ]

            let intersects = false;
            for(let block of units.blocks){
                for(let i = 0; i < 4; ++i){
                    let p1 = pseudoScalar(newData.vers[i], block.vers[0],block.vers[1]);
                    let p2 = pseudoScalar(newData.vers[i], block.vers[1],block.vers[2]);
                    let p3 = pseudoScalar(newData.vers[i], block.vers[2],block.vers[3]);
                    let p4 = pseudoScalar(newData.vers[i], block.vers[3],block.vers[0]);

                    if(p1 > 0 && p2 > 0 && p3 > 0 && p4> 0 ||
                        p1 < 0 && p2 < 0 && p3 < 0 && p4 < 0){
                            intersects = true;
                            break;
                    }

                    p1 = pseudoScalar(block.vers[i], newData.vers[0], newData.vers[1]);
                    p2 = pseudoScalar(block.vers[i], newData.vers[1], newData.vers[2]);
                    p3 = pseudoScalar(block.vers[i], newData.vers[2], newData.vers[3]);
                    p4 = pseudoScalar(block.vers[i], newData.vers[3], newData.vers[0]);

                    if(p1 > 0 && p2 > 0 && p3 > 0 && p4> 0 ||
                        p1 < 0 && p2 < 0 && p3 < 0 && p4 < 0){
                            intersects = true;
                            break;
                    }
                }
                if(intersects) break;
            }


            if(!intersects){
                pl_veh.bpos[0] = newData.bpos[0];
                pl_veh.bpos[1] = newData.bpos[1];
                pl_veh.bang = newData.bang;
            }

            /// ????????

            if(pl_inputs.mpos)
                pl_veh.tang = getRelAngle(...pl_veh.bpos, ...pl_inputs.mpos);
            else
                pl_veh.tang = pl_veh.bang;


            /////// ?????????????????? ???????????? ????????????????


            units.items.forEach(item=>{
                if((pl_veh.bpos[0]-item.pos[0])**2 
                    +(pl_veh.bpos[1]-item.pos[1])**2 <= 2500
                    && item.status){
                    switch(item.type){
                        case 0: // heal
                            pl_veh.hp = pl_veh.hp >= 3? pl_veh.hp: pl_veh.hp+1; 
                            break;
                        case 1: // antiarmor
                            pl_veh.statuses.antiarmor = true; 
                            break;
                    }
                    item.status = false;
                }
            })
            

            /////// ?????????????? ??????????????

            if(pl_inputs.mb0 && !pl_veh.cooldowns.rg) {
                let np = {
                    pos:[
                        pl_veh.bpos[0] + 65*Math.cos(pl_veh.tang),
                        pl_veh.bpos[1] + 65*Math.sin(pl_veh.tang)
                    ],
                    ang: pl_veh.tang,
                    team: pl_veh.team,
                    antiarmor: pl_veh.statuses.antiarmor
                };

                if(pl_veh.statuses.antiarmor){
                    pl_veh.statuses.antiarmor = false;
                }

                units.proj.push(np);
                pl_veh.cooldowns.rg = 90;
                room.public.misses[pl_veh.id]++;

            } else if(pl_veh.cooldowns.rg > 0) {
                --pl_veh.cooldowns.rg;
            }

            ///// ?????????????? ??????
            if(pl_inputs.mb2 && !pl_veh.cooldowns.sh){
                pl_veh.statuses.shield = true;
                pl_veh.cooldowns.sh = 100;
            } else if (pl_veh.cooldowns.sh > 0) {
                if(pl_veh.cooldowns.sh == 70) // 70
                    pl_veh.statuses.shield = false;
                --pl_veh.cooldowns.sh;
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
        
        clearInterval(room.frameInterval);
        Object.values(room.players).forEach((el)=>{
            console.log("Finishng GAME");
            el.ws.close();
        });

        console.log(room);

        try{
            axios.post(`${hc.url}/api/save-game-record`, {
                room: room.id,
                time: Date.now(),
                blue_player: room.public.players[0],
                red_player: room.public.players[1],
                result: room.public.score[0]>room.public.score[1] ? 0: 1,
                score_red: room.public.score[1],
                score_blue: room.public.score[0],
                hits_blue: room.public.hits[0],
                hits_red: room.public.hits[1],
                misses_blue: room.public.misses[0],
                misses_red: room.public.misses[1],
                deflects_blue: room.public.deflects[0],
                deflects_red: room.public.deflects[1],
            }).then(()=>{}).catch(()=>{});
        } catch { }

        
        delete rooms[room.id];
    }

    //////////////////////////////////////////////////////////
}

``


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
