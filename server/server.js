// WebSocket 服务器

const WebSocket = require('ws');
const RoomManager = require('./room-manager');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });
const roomManager = new RoomManager();
const clients = new Map(); // playerId -> ws

console.log(`🎮 炸金花游戏服务器启动在端口 ${PORT}`);
console.log(`📡 等待玩家连接...`);

// 广播消息到房间内所有玩家
function broadcastToRoom(room, message, excludeId = null) {
    room.players.forEach(player => {
        if (player.id !== excludeId) {
            const ws = clients.get(player.id);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }
    });
}

// 发送消息给特定玩家
function sendToPlayer(playerId, message) {
    const ws = clients.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

wss.on('connection', (ws) => {
    let playerId = null;
    let playerName = null;

    console.log('🔌 新玩家连接');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'join':
                    // 玩家加入服务器
                    playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    playerName = message.name || `玩家${playerId.substr(-4)}`;
                    clients.set(playerId, ws);

                    console.log(`✅ ${playerName} (${playerId}) 已连接`);

                    ws.send(JSON.stringify({
                        type: 'joined',
                        playerId: playerId,
                        playerName: playerName
                    }));

                    // 发送房间列表
                    ws.send(JSON.stringify({
                        type: 'roomList',
                        rooms: roomManager.getRoomList()
                    }));
                    break;

                case 'createRoom':
                    // 创建房间
                    const room = roomManager.createRoom(
                        message.roomName || `${playerName}的房间`,
                        { id: playerId, name: playerName }
                    );

                    console.log(`🏠 ${playerName} 创建了房间: ${room.name}`);

                    ws.send(JSON.stringify({
                        type: 'roomCreated',
                        room: room.getState()
                    }));

                    // 广播房间列表更新
                    broadcastRoomList();
                    break;

                case 'joinRoom':
                    // 加入房间
                    const joinRoom = roomManager.getRoom(message.roomId);
                    if (!joinRoom) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: '房间不存在'
                        }));
                        break;
                    }

                    const joinResult = joinRoom.addPlayer({ id: playerId, name: playerName });
                    if (joinResult.success) {
                        console.log(`👥 ${playerName} 加入了房间: ${joinRoom.name}`);

                        ws.send(JSON.stringify({
                            type: 'roomJoined',
                            room: joinRoom.getState()
                        }));

                        // 通知房间内其他玩家
                        broadcastToRoom(joinRoom, {
                            type: 'playerJoined',
                            player: joinResult.player,
                            room: joinRoom.getState()
                        }, playerId);

                        broadcastRoomList();
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: joinResult.message
                        }));
                    }
                    break;

                case 'leaveRoom':
                    // 离开房间
                    const currentRoom = roomManager.findPlayerRoom(playerId);
                    if (currentRoom) {
                        currentRoom.removePlayer(playerId);

                        console.log(`👋 ${playerName} 离开了房间: ${currentRoom.name}`);

                        // 通知其他玩家
                        broadcastToRoom(currentRoom, {
                            type: 'playerLeft',
                            playerId: playerId,
                            room: currentRoom.getState()
                        });

                        // 如果房间空了，删除房间
                        if (currentRoom.players.length === 0) {
                            roomManager.deleteRoom(currentRoom.id);
                            console.log(`🗑️  房间已删除: ${currentRoom.name}`);
                        }

                        ws.send(JSON.stringify({
                            type: 'roomLeft'
                        }));

                        broadcastRoomList();
                    }
                    break;

                case 'ready':
                    // 玩家准备
                    const readyRoom = roomManager.findPlayerRoom(playerId);
                    if (readyRoom) {
                        readyRoom.setPlayerReady(playerId, message.ready);

                        broadcastToRoom(readyRoom, {
                            type: 'playerReady',
                            playerId: playerId,
                            ready: message.ready,
                            room: readyRoom.getState()
                        });
                    }
                    break;

                case 'startGame':
                    // 开始游戏
                    const gameRoom = roomManager.findPlayerRoom(playerId);
                    if (gameRoom && gameRoom.creator === playerId) {
                        const startResult = gameRoom.startGame();

                        if (startResult.success) {
                            console.log(`🎲 游戏开始: ${gameRoom.name}`);

                            // 给每个玩家发送他们的手牌
                            gameRoom.players.forEach(player => {
                                sendToPlayer(player.id, {
                                    type: 'gameStarted',
                                    cards: player.cards,
                                    pot: startResult.pot,
                                    currentBet: startResult.currentBet,
                                    currentPlayer: startResult.currentPlayer,
                                    room: gameRoom.getState()
                                });
                            });
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: startResult.message
                            }));
                        }
                    }
                    break;

                case 'action':
                    // 玩家操作
                    const actionRoom = roomManager.findPlayerRoom(playerId);
                    if (actionRoom) {
                        const actionResult = actionRoom.playerAction(
                            playerId,
                            message.action,
                            message.amount
                        );

                        if (actionResult.success) {
                            console.log(`🎯 ${playerName} ${message.action}`);

                            // 广播操作结果
                            if (actionResult.gameOver) {
                                // 游戏结束
                                broadcastToRoom(actionRoom, {
                                    type: 'gameOver',
                                    ...actionResult,
                                    room: actionRoom.getState()
                                });
                            } else {
                                broadcastToRoom(actionRoom, {
                                    type: 'actionResult',
                                    playerId: playerId,
                                    action: message.action,
                                    ...actionResult,
                                    room: actionRoom.getState()
                                });
                            }
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: actionResult.message
                            }));
                        }
                    }
                    break;

                case 'resetGame':
                    // 重新开始游戏
                    const resetRoom = roomManager.findPlayerRoom(playerId);
                    if (resetRoom && resetRoom.creator === playerId) {
                        resetRoom.resetGame();

                        broadcastToRoom(resetRoom, {
                            type: 'gameReset',
                            room: resetRoom.getState()
                        });
                    }
                    break;

                case 'getRoomList':
                    // 获取房间列表
                    ws.send(JSON.stringify({
                        type: 'roomList',
                        rooms: roomManager.getRoomList()
                    }));
                    break;

                default:
                    console.log('❓ 未知消息类型:', message.type);
            }
        } catch (error) {
            console.error('❌ 处理消息错误:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '服务器错误'
            }));
        }
    });

    ws.on('close', () => {
        if (playerId) {
            console.log(`🔌 ${playerName} (${playerId}) 断开连接`);

            // 从房间中移除玩家
            const room = roomManager.findPlayerRoom(playerId);
            if (room) {
                room.removePlayer(playerId);

                broadcastToRoom(room, {
                    type: 'playerLeft',
                    playerId: playerId,
                    room: room.getState()
                });

                // 如果房间空了，删除房间
                if (room.players.length === 0) {
                    roomManager.deleteRoom(room.id);
                }

                broadcastRoomList();
            }

            clients.delete(playerId);
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket 错误:', error);
    });
});

// 广播房间列表给所有连接的客户端
function broadcastRoomList() {
    const roomList = {
        type: 'roomList',
        rooms: roomManager.getRoomList()
    };

    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(roomList));
        }
    });
}

// 获取本机 IP 地址
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

console.log(`\n🌐 局域网地址: ws://${getLocalIP()}:${PORT}`);
console.log(`🏠 本地地址: ws://localhost:${PORT}\n`);
