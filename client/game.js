// 炸金花客户端游戏逻辑

class PokerGame {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.currentRoom = null;
        this.myCards = [];
        this.hasSeenCards = false;

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // 屏幕
        this.screens = {
            login: document.getElementById('loginScreen'),
            lobby: document.getElementById('lobbyScreen'),
            room: document.getElementById('roomScreen'),
            game: document.getElementById('gameScreen'),
            gameOver: document.getElementById('gameOverScreen')
        };

        // 登录界面元素
        this.elements = {
            playerNameInput: document.getElementById('playerName'),
            serverAddressInput: document.getElementById('serverAddress'),
            joinBtn: document.getElementById('joinBtn'),
            loginStatus: document.getElementById('loginStatus'),

            // 大厅界面
            currentPlayerName: document.getElementById('currentPlayerName'),
            logoutBtn: document.getElementById('logoutBtn'),
            roomList: document.getElementById('roomList'),
            refreshRoomsBtn: document.getElementById('refreshRoomsBtn'),
            roomNameInput: document.getElementById('roomName'),
            createRoomBtn: document.getElementById('createRoomBtn'),

            // 房间界面
            roomTitle: document.getElementById('roomTitle'),
            leaveRoomBtn: document.getElementById('leaveRoomBtn'),
            playerCount: document.getElementById('playerCount'),
            waitingPlayerList: document.getElementById('waitingPlayerList'),
            readyBtn: document.getElementById('readyBtn'),
            startGameBtn: document.getElementById('startGameBtn'),
            roomStatus: document.getElementById('roomStatus'),

            // 游戏界面
            potAmount: document.getElementById('potAmount'),
            currentBet: document.getElementById('currentBet'),
            exitGameBtn: document.getElementById('exitGameBtn'),
            opponentsArea: document.getElementById('opponentsArea'),
            myPlayerName: document.getElementById('myPlayerName'),
            myChips: document.getElementById('myChips'),
            myBet: document.getElementById('myBet'),
            myCards: document.getElementById('myCards'),
            actionButtons: document.getElementById('actionButtons'),
            seeCardsBtn: document.getElementById('seeCardsBtn'),
            foldBtn: document.getElementById('foldBtn'),
            callBtn: document.getElementById('callBtn'),
            raiseBtn: document.getElementById('raiseBtn'),
            compareBtn: document.getElementById('compareBtn'),
            raiseInput: document.getElementById('raiseInput'),
            raiseAmount: document.getElementById('raiseAmount'),
            confirmRaiseBtn: document.getElementById('confirmRaiseBtn'),
            cancelRaiseBtn: document.getElementById('cancelRaiseBtn'),
            gameMessage: document.getElementById('gameMessage'),

            // 游戏结束界面
            gameResults: document.getElementById('gameResults'),
            playAgainBtn: document.getElementById('playAgainBtn'),
            backToLobbyBtn: document.getElementById('backToLobbyBtn')
        };
    }

    attachEventListeners() {
        // 登录
        this.elements.joinBtn.addEventListener('click', () => this.joinServer());
        this.elements.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinServer();
        });

        // 大厅
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
        this.elements.refreshRoomsBtn.addEventListener('click', () => this.refreshRooms());
        this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());

        // 房间
        this.elements.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.elements.readyBtn.addEventListener('click', () => this.toggleReady());
        this.elements.startGameBtn.addEventListener('click', () => this.startGame());

        // 游戏
        this.elements.exitGameBtn.addEventListener('click', () => this.exitGame());
        this.elements.seeCardsBtn.addEventListener('click', () => this.seeCards());
        this.elements.foldBtn.addEventListener('click', () => this.fold());
        this.elements.callBtn.addEventListener('click', () => this.call());
        this.elements.raiseBtn.addEventListener('click', () => this.showRaiseInput());
        this.elements.compareBtn.addEventListener('click', () => this.compare());
        this.elements.confirmRaiseBtn.addEventListener('click', () => this.confirmRaise());
        this.elements.cancelRaiseBtn.addEventListener('click', () => this.hideRaiseInput());

        // 游戏结束
        this.elements.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.elements.backToLobbyBtn.addEventListener('click', () => this.backToLobby());
    }

    // ========== WebSocket 连接 ==========

    joinServer() {
        const name = this.elements.playerNameInput.value.trim();
        const serverAddress = this.elements.serverAddressInput.value.trim();

        if (!name) {
            this.showLoginStatus('请输入昵称', 'error');
            return;
        }

        if (!serverAddress) {
            this.showLoginStatus('请输入服务器地址', 'error');
            return;
        }

        this.playerName = name;
        this.showLoginStatus('正在连接...', 'info');

        try {
            this.ws = new WebSocket(serverAddress);

            this.ws.onopen = () => {
                this.showLoginStatus('连接成功！', 'success');
                this.send({ type: 'join', name: this.playerName });
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onerror = () => {
                this.showLoginStatus('连接失败，请检查服务器地址', 'error');
            };

            this.ws.onclose = () => {
                this.showLoginStatus('连接已断开', 'error');
                if (this.playerId) {
                    this.showScreen('login');
                    this.playerId = null;
                }
            };
        } catch (error) {
            this.showLoginStatus('连接失败: ' + error.message, 'error');
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(message) {
        console.log('收到消息:', message);

        switch (message.type) {
            case 'joined':
                this.playerId = message.playerId;
                this.playerName = message.playerName;
                this.elements.currentPlayerName.textContent = this.playerName;
                this.showScreen('lobby');
                break;

            case 'roomList':
                this.updateRoomList(message.rooms);
                break;

            case 'roomCreated':
            case 'roomJoined':
                this.currentRoom = message.room;
                this.showRoomScreen();
                break;

            case 'playerJoined':
                this.currentRoom = message.room;
                this.updateWaitingPlayers();
                break;

            case 'playerLeft':
                this.currentRoom = message.room;
                this.updateWaitingPlayers();
                break;

            case 'playerReady':
                this.currentRoom = message.room;
                this.updateWaitingPlayers();
                this.checkStartButton();
                break;

            case 'roomLeft':
                this.currentRoom = null;
                this.showScreen('lobby');
                this.refreshRooms();
                break;

            case 'gameStarted':
                this.myCards = message.cards;
                this.hasSeenCards = false;
                this.currentRoom = message.room;
                this.showGameScreen(message);
                break;

            case 'actionResult':
                this.handleActionResult(message);
                break;

            case 'gameOver':
                this.showGameOver(message);
                break;

            case 'gameReset':
                this.currentRoom = message.room;
                this.showRoomScreen();
                break;

            case 'error':
                this.showMessage(message.message, 'error');
                break;
        }
    }

    // ========== 界面切换 ==========

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        this.screens[screenName].classList.add('active');
    }

    showLoginStatus(message, type) {
        this.elements.loginStatus.textContent = message;
        this.elements.loginStatus.style.color =
            type === 'error' ? '#e74c3c' :
                type === 'success' ? '#2ecc71' : '#3498db';
    }

    // ========== 大厅功能 ==========

    logout() {
        if (this.ws) {
            this.ws.close();
        }
        this.showScreen('login');
        this.playerId = null;
    }

    refreshRooms() {
        this.send({ type: 'getRoomList' });
    }

    updateRoomList(rooms) {
        const roomList = this.elements.roomList;

        if (rooms.length === 0) {
            roomList.innerHTML = '<div class="empty-message">暂无房间</div>';
            return;
        }

        roomList.innerHTML = rooms.map(room => `
      <div class="room-item" onclick="game.joinRoom('${room.id}')">
        <div class="room-info">
          <h4>${room.name}</h4>
          <div class="room-meta">
            👥 ${room.playerCount}/${room.maxPlayers}
          </div>
        </div>
        <div class="room-status ${room.status}">
          ${room.status === 'waiting' ? '等待中' : '游戏中'}
        </div>
      </div>
    `).join('');
    }

    createRoom() {
        const roomName = this.elements.roomNameInput.value.trim() || `${this.playerName}的房间`;
        this.send({ type: 'createRoom', roomName });
        this.elements.roomNameInput.value = '';
    }

    joinRoom(roomId) {
        this.send({ type: 'joinRoom', roomId });
    }

    // ========== 房间功能 ==========

    showRoomScreen() {
        this.elements.roomTitle.textContent = this.currentRoom.name;
        this.updateWaitingPlayers();
        this.checkStartButton();
        this.showScreen('room');
    }

    updateWaitingPlayers() {
        const players = this.currentRoom.players;
        this.elements.playerCount.textContent = players.length;

        this.elements.waitingPlayerList.innerHTML = players.map(player => `
      <div class="waiting-player ${player.isReady ? 'ready' : ''}">
        <span>${player.name} ${player.id === this.currentRoom.creator ? '👑' : ''}</span>
        ${player.isReady ? '<span class="ready-badge">准备</span>' : ''}
      </div>
    `).join('');
    }

    checkStartButton() {
        const isCreator = this.currentRoom.creator === this.playerId;
        const allReady = this.currentRoom.players.every(p => p.isReady);
        const enoughPlayers = this.currentRoom.players.length >= 2;

        if (isCreator) {
            this.elements.startGameBtn.style.display = 'block';
            this.elements.startGameBtn.disabled = !(allReady && enoughPlayers);
        } else {
            this.elements.startGameBtn.style.display = 'none';
        }
    }

    toggleReady() {
        const myPlayer = this.currentRoom.players.find(p => p.id === this.playerId);
        const newReadyState = !myPlayer.isReady;

        this.send({ type: 'ready', ready: newReadyState });
        this.elements.readyBtn.textContent = newReadyState ? '取消准备' : '准备';
        this.elements.readyBtn.classList.toggle('btn-success', !newReadyState);
        this.elements.readyBtn.classList.toggle('btn-secondary', newReadyState);
    }

    leaveRoom() {
        this.send({ type: 'leaveRoom' });
    }

    startGame() {
        this.send({ type: 'startGame' });
    }

    // ========== 游戏功能 ==========

    showGameScreen(data) {
        this.elements.potAmount.textContent = data.pot;
        this.elements.currentBet.textContent = data.currentBet;
        this.elements.myPlayerName.textContent = this.playerName;

        this.updateGameState(data.room);
        this.renderMyCards();
        this.renderOpponents();

        this.showScreen('game');
    }

    updateGameState(room) {
        this.currentRoom = room;

        const myPlayer = room.players.find(p => p.id === this.playerId);
        if (myPlayer) {
            this.elements.myChips.textContent = `💰 ${myPlayer.chips}`;
            this.elements.myBet.textContent = `已下注: ${myPlayer.bet}`;
        }

        this.elements.potAmount.textContent = room.pot;
        this.elements.currentBet.textContent = room.currentBet;

        this.updateActionButtons(room.currentPlayer === this.playerId);
        this.renderOpponents();
    }

    renderMyCards() {
        if (this.hasSeenCards) {
            this.elements.myCards.innerHTML = this.myCards.map(card =>
                this.createCardHTML(card)
            ).join('');
        } else {
            this.elements.myCards.innerHTML = this.myCards.map(() =>
                '<div class="card hidden"><div class="card-value">?</div></div>'
            ).join('');
        }
    }

    createCardHTML(card) {
        const isRed = card.suit === '♥' || card.suit === '♦';
        return `
      <div class="card ${isRed ? 'red' : 'black'}">
        <div class="card-value">${card.value}</div>
        <div class="card-suit">${card.suit}</div>
      </div>
    `;
    }

    renderOpponents() {
        const opponents = this.currentRoom.players.filter(p => p.id !== this.playerId);

        this.elements.opponentsArea.innerHTML = opponents.map(player => `
      <div class="opponent ${player.id === this.currentRoom.currentPlayer ? 'active' : ''} ${player.folded ? 'folded' : ''}">
        <div class="opponent-name">${player.name}</div>
        <div class="opponent-chips">💰 ${player.chips}</div>
        <div class="opponent-cards">
          ${Array(player.cardCount).fill(0).map(() => '<div class="card-back"></div>').join('')}
        </div>
        <div class="opponent-bet">下注: ${player.bet}</div>
        ${player.folded ? '<div style="color: #e74c3c;">已弃牌</div>' : ''}
      </div>
    `).join('');
    }

    updateActionButtons(isMyTurn) {
        const buttons = [
            this.elements.foldBtn,
            this.elements.callBtn,
            this.elements.raiseBtn,
            this.elements.compareBtn
        ];

        buttons.forEach(btn => btn.disabled = !isMyTurn);

        if (isMyTurn) {
            this.showMessage('轮到你了！', 'info', 2000);
        }
    }

    seeCards() {
        this.hasSeenCards = true;
        this.renderMyCards();
        this.send({ type: 'action', action: 'see' });
        this.elements.seeCardsBtn.disabled = true;
    }

    fold() {
        if (confirm('确定要弃牌吗？')) {
            this.send({ type: 'action', action: 'fold' });
        }
    }

    call() {
        this.send({ type: 'action', action: 'call' });
    }

    showRaiseInput() {
        this.elements.raiseInput.style.display = 'flex';
        this.elements.raiseBtn.style.display = 'none';
    }

    hideRaiseInput() {
        this.elements.raiseInput.style.display = 'none';
        this.elements.raiseBtn.style.display = 'inline-block';
    }

    confirmRaise() {
        const amount = parseInt(this.elements.raiseAmount.value);
        if (amount > 0) {
            this.send({ type: 'action', action: 'raise', amount });
            this.hideRaiseInput();
        }
    }

    compare() {
        if (confirm('确定要比牌吗？')) {
            this.send({ type: 'action', action: 'compare' });
        }
    }

    handleActionResult(message) {
        this.updateGameState(message.room);

        if (message.action === 'compare') {
            const winnerName = this.currentRoom.players.find(p => p.id === message.winner)?.name;
            const loserName = this.currentRoom.players.find(p => p.id === message.loser)?.name;
            this.showMessage(`${winnerName} 赢了比牌！${loserName} 弃牌`, 'info', 3000);
        } else {
            this.showMessage(message.message, 'info', 1500);
        }
    }

    exitGame() {
        if (confirm('确定要退出游戏吗？')) {
            this.send({ type: 'leaveRoom' });
        }
    }

    // ========== 游戏结束 ==========

    showGameOver(data) {
        const results = data.results;
        const winner = results.find(r => r.id === data.winner);

        this.elements.gameResults.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3>🏆 ${winner.name} 获胜！</h3>
        <p>赢得奖池: ${data.pot}</p>
      </div>
      
      <div style="text-align: left;">
        <h4>玩家牌型：</h4>
        ${results.map(player => `
          <div class="result-item ${player.id === data.winner ? 'winner' : ''}">
            <div>
              <div><strong>${player.name}</strong> ${player.id === data.winner ? '🏆' : ''}</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.7);">
                ${player.handType.name} - 💰 ${player.chips}
              </div>
              <div class="result-cards">
                ${player.cards.map(card => {
            const isRed = card.suit === '♥' || card.suit === '♦';
            return `<div class="result-card ${isRed ? 'red' : 'black'}">${card.value}${card.suit}</div>`;
        }).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

        this.showScreen('gameOver');
    }

    playAgain() {
        this.send({ type: 'resetGame' });
    }

    backToLobby() {
        this.send({ type: 'leaveRoom' });
    }

    // ========== 工具函数 ==========

    showMessage(text, type, duration = 2000) {
        this.elements.gameMessage.textContent = text;
        this.elements.gameMessage.classList.add('show');

        setTimeout(() => {
            this.elements.gameMessage.classList.remove('show');
        }, duration);
    }
}

// 初始化游戏
const game = new PokerGame();
