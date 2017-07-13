//var mongojs = require("mongojs");
var db = null;//mongojs('localhost:27017/myGame', ['account','progress']);

var express = require('express');
var app = express();
var serv = require('http').Server(app);
var profiler = require('v8-profiler');
var fs = require('fs');
 
app.get('/',function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
 
serv.listen(process.env.PORT || 2000);
console.log("Server started.");
 

var MAP_HEIGHT = 500;
var MAP_WIDTH = 500;

var SOCKET_LIST = {};
 
var Entity = function() {
    var self = {
        x:250,
        y:250,
        spdX:0,
        spdY:0,
        id:"",
    }

    self.update = function() {
        self.updatePosition();
    }

    self.updatePosition = function() {
        self.x += self.spdX;
        self.y += self.spdY;
    }

    self.getDistance = function(pt) {
        return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y-pt.y, 2));
    }

    return self;
}


var Player = function(id, name){
    var self = Entity();
    self.id = id;
    self.name = name;
    self.playerFace = 0;
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.maxSpd = 10;
    self.hp = 10;
    self.hpMax = 10;
    self.score = 0;
    
    
    var super_update = self.update;
    self.update = function() {
        self.updateSpd();
        super_update();

        if (self.pressingAttack == true) {
            self.shootBullet(self.playerFace);
        }

    }

    self.shootBullet = function(playerFace) {
        var bullet = Bullet(self, playerFace);
        bullet.x = self.x;
        bullet.y = self.y;
    }

    self.updateSpd = function(){
        if ((self.pressingRight) && (self.x+20 < MAP_WIDTH))
            self.spdX = self.maxSpd;
        else if ((self.pressingLeft) && (self.x-20 > 0))
            self.spdX = -self.maxSpd;
        else 
            self.spdX = 0;

        if ((self.pressingUp) && (self.y-20 > 0))
            self.spdY = -self.maxSpd;
        else if ((self.pressingDown) && (self.y + 20 < MAP_HEIGHT))
            self.spdY = self.maxSpd;
        else 
            self.spdY = 0;
    }

    Player.list[id] = self;

    self.getInitPack = function() {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            name:self.name,
            playerFace:self.playerFace,      
            number:self.number,
            hp:self.hp,
            hpMax:self.hpMax,
            score:self.score,
            
        };
    }

    self.getUpdatePack = function() {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            name:self.name,
            playerFace:self.playerFace,
            hp:self.hp,
            score:self.score,
            
        };
    }

    initPack.player.push(self.getInitPack());
    return self;
}

Player.list = {};


Player.onConnect = function(socket, username) {
    var player = Player(socket.id, username);

    socket.on('keyPress',function(data){
        if(data.inputId === 'left') {
            player.pressingLeft = data.state;
            player.playerFace = 3;
        }
        else if(data.inputId === 'right') {
            player.pressingRight = data.state;
            player.playerFace = 1;
        }
        else if(data.inputId === 'up') {
            player.pressingUp = data.state;
            player.playerFace = 0;
        }
        else if(data.inputId === 'down') {
            player.pressingDown = data.state;
            player.playerFace = 2;
        }
        else if(data.inputId === 'attack') 
            player.pressingAttack = data.state;
    });

    socket.emit('init', {
        selfId:socket.id,
        player:Player.getAllInitPack(),
        bullet:Bullet.getAllInitPack(),
    });
}

Player.getAllInitPack = function() {
    var players = [];
    for (var i in Player.list)
        players.push(Player.list[i].getInitPack());
    return players;
}

Player.onDisconnect = function(socket) {
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
}
 
Player.update = function() {
    var pack = [];
    for(var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }

    return pack;
}


var Bullet = function(parent, playerFace) {
    var self = Entity();
    self.id = Math.random();

    self.spdX = 0;
    self.spdY = 0;

    if (playerFace == 0)
    	self.spdY = parent.spdY + -10;
   	else if (playerFace == 1)
   		self.spdX = parent.spdX + 10;
   	else if (playerFace == 2)
   		self.spdY = parent.spdY + 10;
   	else if (playerFace == 3)
   		self.spdX = parent.spdX + -10;

    self.parent = parent;

    self.timer = 0;
    self.toRemove = false;

    var super_update = self.update;
    self.update = function() {
        if (self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for (var i in Player.list) {
            var p = Player.list[i];

            if (self.getDistance(p) < 32 && self.parent.id !== p.id) {

                //handling damage
                p.hp -= 1;

                if (p.hp <= 0) {

                    var shooter = self.parent;
                    if (shooter) {
                        shooter.score += 1;
                    }
                    p.hp = p.hpMax;
                    p.x = Math.random() * 500;
                    p.y = Math.random() * 500;
                }


                self.toRemove = true;
            }
        }
    }

    self.getInitPack = function() {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            number:self.number,
        };
    }

    self.getUpdatePack = function() {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            number:self.number,
        };
    }

    Bullet.list[self.id] = self;
    initPack.bullet.push(self.getInitPack());

    return self;
}

Bullet.list = {};

Bullet.update = function() {

    var pack = [];
    for(var i in Bullet.list){
        var bullet = Bullet.list[i];
        bullet.update();

        if (bullet.toRemove) {
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        }

        pack.push(bullet.getUpdatePack());    
    }

    return pack;
}

Bullet.getAllInitPack = function() {
    var bullets = [];
    for (var i in Bullet.list)
        bullets.push(Bullet.list[i].getInitPack());
    return bullets;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){

    console.log("Connection opened");

    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    socket.on('signIn', function(data) {
    	Player.onConnect(socket, data.username);
        socket.emit('signInResponse',{success:true});

    });

    socket.on('signUp', function(data) {

        isUsernameTaken(data, function(res) {
            if (res) {
                socket.emit('signUpResponse',{success:false});
            } else {
                addUser(data, function() {
                    socket.emit('signUpResponse',{success:true});   
                });
            }
        });   
    });
    

    socket.on('disconnect',function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });   
   
});
 
var initPack = {player:[], bullet:[]};
var removePack = {player:[], bullet:[]}


setInterval(function() {
    var pack = {
        player:Player.update(),
        bullet:Bullet.update(),
    }


    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('init', initPack);
        socket.emit('update', pack);
        socket.emit('remove', removePack);
    }
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];
   
}, 1000/25);




var startProfiling = function(duration) {
    profiler.startProfiling('1', true);
    setTimeout(function() {
        var profile1 = profiler.stopProfiling('1');

        profile1.export(function(error, result) {
            fs.writeFile('./profile.cpuprofile', result);
            profile1.delete();
            console.log("Profile saved");
        });
    }, duration);
}

startProfiling(10000);