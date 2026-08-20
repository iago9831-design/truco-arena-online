const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const rooms=new Map();
function roomState(room){
  return {id:room.id,mode:room.mode,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team})),
    score:room.score,turn:room.turn,status:room.status};
}
io.on("connection",socket=>{
  socket.on("createRoom",({name,mode,game})=>{
    const id=Math.random().toString(36).slice(2,7).toUpperCase();
    const room={id,mode,game,players:new Map(),score:[0,0],turn:0,status:"aguardando jogadores"};
    room.players.set(socket.id,{id:socket.id,name:name||"Jogador",team:0});
    rooms.set(id,room); socket.join(id); socket.data.room=id;
    io.to(id).emit("state",roomState(room));
  });
  socket.on("joinRoom",({name,roomId})=>{
    const room=rooms.get(roomId?.toUpperCase());
    if(!room) return socket.emit("errorMsg","Sala não encontrada.");
    if(room.players.size>=4) return socket.emit("errorMsg","Sala cheia.");
    const team=room.players.size%2;
    room.players.set(socket.id,{id:socket.id,name:name||"Jogador",team});
    socket.join(room.id); socket.data.room=room.id;
    if(room.players.size>=2) room.status="partida pronta";
    io.to(room.id).emit("state",roomState(room));
  });
  socket.on("play",({card})=>{
    const room=rooms.get(socket.data.room); if(!room) return;
    const players=[...room.players.keys()];
    if(players[room.turn]!==socket.id) return socket.emit("errorMsg","Não é sua vez.");
    room.turn=(room.turn+1)%players.length;
    io.to(room.id).emit("played",{player:socket.id,card});
    io.to(room.id).emit("state",roomState(room));
  });
  socket.on("truco",()=>{
    const room=rooms.get(socket.data.room); if(!room)return;
    io.to(room.id).emit("truco",{by:socket.id});
  });
  socket.on("disconnect",()=>{
    const id=socket.data.room,room=rooms.get(id); if(!room)return;
    room.players.delete(socket.id);
    if(room.players.size===0) rooms.delete(id);
    else io.to(id).emit("state",roomState(room));
  });
});
server.listen(process.env.PORT||3000,()=>console.log("Truco Arena online na porta "+(process.env.PORT||3000)));