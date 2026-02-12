// 房间管理器

const { createDeck, shuffleDeck, dealCards, findWinner, evaluateHand } = require('./game-logic');

class Room {
    constructor(id, name, creator) {
        this.id = id;
        this.name = name;
        this.creator = creator;
        this.players = [];
        this.maxPlayers = 6;
        this.minPlayers = 2;
        this.status = 'waiting'; // waiting, playing, finished
        this.deck = [];
        this.currentRound = 0;
        this.pot = 0; // 奖池
        this.currentBet = 10; // 当前下注额
        this.baseChips = 1000; // 初始筹码
        this.ante = 10; // 底注
        this.activePlayers = []; // 还在游戏中的玩家
        this.currentPlayerIndex = 0;
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            return { success: false, message: '房间已满' };
        }

        if (this.status !== 'waiting') {
            return { success: false, message: '游戏已开始' };
        }

        const playerData = {
            id: player.id,
            name: player.name,
            chips: this.baseChips,
            cards: [],
            bet: 0,
            hasSeenCards: false,
            folded: false,
            isReady: false
        };

        this.players.push(playerData);
        return { success: true, player: playerData };
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);

            // 如果房主离开，选择新房主
            if (this.creator === playerId && this.players.length > 0) {
                this.creator = this.players[0].id;
            }

            return true;
        }
        return false;
    }

    setPlayerReady(playerId, ready) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.isReady = ready;
            return true;
        }
        return false;
    }

    canStartGame() {
        return this.players.length >= this.minPlayers &&
            this.players.every(p => p.isReady) &&
            this.status === 'waiting';
    }

    startGame() {
        if (!this.canStartGame()) {
            return { success: false, message: '无法开始游戏' };
        }

        this.status = 'playing';
        this.currentRound = 1;
        this.pot = 0;
        this.currentBet = this.ante;

        // 重置玩家状态
        this.players.forEach(player => {
            player.bet = 0;
            player.hasSeenCards = false;
            player.folded = false;
            player.cards = [];
        });

        // 收取底注
        this.players.forEach(player => {
            player.chips -= this.ante;
            player.bet = this.ante;
            this.pot += this.ante;
        });

        // 发牌
        this.deck = shuffleDeck(createDeck());
        const hands = dealCards(this.deck, this.players.length);

        this.players.forEach((player, index) => {
            player.cards = hands[index];
        });

        this.activePlayers = [...this.players];
        this.currentPlayerIndex = 0;

        return {
            success: true,
            pot: this.pot,
            currentBet: this.currentBet,
            currentPlayer: this.activePlayers[this.currentPlayerIndex].id
        };
    }

    playerAction(playerId, action, amount = 0) {
        const player = this.players.find(p => p.id === playerId);
        const activePlayer = this.activePlayers[this.currentPlayerIndex];

        if (!player || !activePlayer || activePlayer.id !== playerId) {
            return { success: false, message: '不是你的回合' };
        }

        if (player.folded) {
            return { success: false, message: '你已弃牌' };
        }

        let result = { success: true };

        switch (action) {
            case 'see':
                // 看牌
                player.hasSeenCards = true;
                result.message = '已看牌';
                break;

            case 'fold':
                // 弃牌
                player.folded = true;
                this.activePlayers = this.activePlayers.filter(p => p.id !== playerId);
                result.message = '已弃牌';

                // 检查是否只剩一个玩家
                if (this.activePlayers.length === 1) {
                    return this.endGame();
                }
                break;

            case 'call':
                // 跟注
                const callAmount = this.currentBet - player.bet;
                if (player.chips < callAmount) {
                    return { success: false, message: '筹码不足' };
                }
                player.chips -= callAmount;
                player.bet += callAmount;
                this.pot += callAmount;
                result.message = `跟注 ${callAmount}`;
                break;

            case 'raise':
                // 加注
                const raiseAmount = amount || this.currentBet;
                const totalAmount = this.currentBet - player.bet + raiseAmount;

                if (player.chips < totalAmount) {
                    return { success: false, message: '筹码不足' };
                }

                player.chips -= totalAmount;
                player.bet += totalAmount;
                this.pot += totalAmount;
                this.currentBet += raiseAmount;
                result.message = `加注 ${raiseAmount}`;
                break;

            case 'compare':
                // 比牌（与下一个玩家）
                if (this.activePlayers.length < 2) {
                    return { success: false, message: '没有可比牌的对手' };
                }

                const nextPlayerIndex = (this.currentPlayerIndex + 1) % this.activePlayers.length;
                const opponent = this.activePlayers[nextPlayerIndex];

                return this.compareCards(player, opponent);

            default:
                return { success: false, message: '未知操作' };
        }

        // 移动到下一个玩家
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.activePlayers.length;
        result.nextPlayer = this.activePlayers[this.currentPlayerIndex].id;
        result.pot = this.pot;
        result.currentBet = this.currentBet;

        return result;
    }

    compareCards(player1, player2) {
        const hand1 = player1.cards;
        const hand2 = player2.cards;

        const eval1 = evaluateHand(hand1);
        const eval2 = evaluateHand(hand2);

        let loser;
        if (eval1.value > eval2.value || eval1.type > eval2.type) {
            loser = player2;
        } else {
            loser = player1;
        }

        loser.folded = true;
        this.activePlayers = this.activePlayers.filter(p => p.id !== loser.id);

        // 检查是否只剩一个玩家
        if (this.activePlayers.length === 1) {
            return this.endGame();
        }

        return {
            success: true,
            action: 'compare',
            winner: loser.id === player1.id ? player2.id : player1.id,
            loser: loser.id,
            nextPlayer: this.activePlayers[this.currentPlayerIndex % this.activePlayers.length].id
        };
    }

    endGame() {
        const winner = this.activePlayers[0];
        winner.chips += this.pot;

        // 显示所有玩家的牌
        const results = this.players.map(p => ({
            id: p.id,
            name: p.name,
            cards: p.cards,
            handType: evaluateHand(p.cards),
            chips: p.chips,
            folded: p.folded
        }));

        this.status = 'finished';

        return {
            success: true,
            gameOver: true,
            winner: winner.id,
            winnerName: winner.name,
            pot: this.pot,
            results: results
        };
    }

    resetGame() {
        this.status = 'waiting';
        this.currentRound = 0;
        this.pot = 0;
        this.currentBet = this.ante;

        this.players.forEach(player => {
            player.bet = 0;
            player.hasSeenCards = false;
            player.folded = false;
            player.cards = [];
            player.isReady = false;
        });
    }

    getState() {
        return {
            id: this.id,
            name: this.name,
            creator: this.creator,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                chips: p.chips,
                bet: p.bet,
                hasSeenCards: p.hasSeenCards,
                folded: p.folded,
                isReady: p.isReady,
                cardCount: p.cards.length
            })),
            status: this.status,
            pot: this.pot,
            currentBet: this.currentBet,
            currentPlayer: this.activePlayers[this.currentPlayerIndex]?.id,
            maxPlayers: this.maxPlayers
        };
    }
}

class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.roomIdCounter = 1;
    }

    createRoom(name, creator) {
        const roomId = `room_${this.roomIdCounter++}`;
        const room = new Room(roomId, name, creator.id);
        room.addPlayer(creator);
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    deleteRoom(roomId) {
        return this.rooms.delete(roomId);
    }

    getRoomList() {
        return Array.from(this.rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            status: room.status
        }));
    }

    findPlayerRoom(playerId) {
        for (const room of this.rooms.values()) {
            if (room.players.some(p => p.id === playerId)) {
                return room;
            }
        }
        return null;
    }
}

module.exports = RoomManager;
