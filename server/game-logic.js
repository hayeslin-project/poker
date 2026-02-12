// 炸金花游戏逻辑

// 牌面值映射
const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 花色
const SUITS = ['♠', '♥', '♣', '♦'];

// 牌型常量
const HAND_TYPES = {
  LEOPARD: 7,      // 豹子
  STRAIGHT_FLUSH: 6, // 顺金
  FLUSH: 5,        // 金花
  STRAIGHT: 4,     // 顺子
  PAIR: 3,         // 对子
  HIGH_CARD: 2     // 散牌
};

/**
 * 创建一副牌
 */
function createDeck() {
  const deck = [];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  
  for (const suit of SUITS) {
    for (const value of values) {
      deck.push({ suit, value, numValue: CARD_VALUES[value] });
    }
  }
  
  return deck;
}

/**
 * 洗牌
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 发牌
 */
function dealCards(deck, numPlayers) {
  const hands = Array(numPlayers).fill(null).map(() => []);
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < numPlayers; j++) {
      hands[j].push(deck.pop());
    }
  }
  
  return hands;
}

/**
 * 判断是否是豹子（三张相同）
 */
function isLeopard(cards) {
  return cards[0].numValue === cards[1].numValue && 
         cards[1].numValue === cards[2].numValue;
}

/**
 * 判断是否是顺子
 */
function isStraight(cards) {
  const sorted = [...cards].sort((a, b) => a.numValue - b.numValue);
  
  // 特殊情况：A-2-3
  if (sorted[0].numValue === 2 && sorted[1].numValue === 3 && sorted[2].numValue === 14) {
    return true;
  }
  
  return sorted[1].numValue === sorted[0].numValue + 1 &&
         sorted[2].numValue === sorted[1].numValue + 1;
}

/**
 * 判断是否是金花（同花）
 */
function isFlush(cards) {
  return cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
}

/**
 * 判断是否是对子
 */
function isPair(cards) {
  return cards[0].numValue === cards[1].numValue ||
         cards[1].numValue === cards[2].numValue ||
         cards[0].numValue === cards[2].numValue;
}

/**
 * 获取对子的值
 */
function getPairValue(cards) {
  if (cards[0].numValue === cards[1].numValue) {
    return { pair: cards[0].numValue, kicker: cards[2].numValue };
  }
  if (cards[1].numValue === cards[2].numValue) {
    return { pair: cards[1].numValue, kicker: cards[0].numValue };
  }
  return { pair: cards[0].numValue, kicker: cards[1].numValue };
}

/**
 * 评估手牌类型和分数
 */
function evaluateHand(cards) {
  const sorted = [...cards].sort((a, b) => b.numValue - a.numValue);
  
  // 豹子
  if (isLeopard(sorted)) {
    return {
      type: HAND_TYPES.LEOPARD,
      value: sorted[0].numValue * 1000000,
      name: '豹子',
      cards: sorted
    };
  }
  
  // 顺金
  if (isStraight(sorted) && isFlush(sorted)) {
    const maxValue = sorted[0].numValue === 14 && sorted[1].numValue === 3 ? 3 : sorted[0].numValue;
    return {
      type: HAND_TYPES.STRAIGHT_FLUSH,
      value: maxValue * 10000,
      name: '顺金',
      cards: sorted
    };
  }
  
  // 金花
  if (isFlush(sorted)) {
    return {
      type: HAND_TYPES.FLUSH,
      value: sorted[0].numValue * 100 + sorted[1].numValue * 10 + sorted[2].numValue,
      name: '金花',
      cards: sorted
    };
  }
  
  // 顺子
  if (isStraight(sorted)) {
    const maxValue = sorted[0].numValue === 14 && sorted[1].numValue === 3 ? 3 : sorted[0].numValue;
    return {
      type: HAND_TYPES.STRAIGHT,
      value: maxValue * 100,
      name: '顺子',
      cards: sorted
    };
  }
  
  // 对子
  if (isPair(sorted)) {
    const { pair, kicker } = getPairValue(sorted);
    return {
      type: HAND_TYPES.PAIR,
      value: pair * 100 + kicker,
      name: '对子',
      cards: sorted
    };
  }
  
  // 散牌
  return {
    type: HAND_TYPES.HIGH_CARD,
    value: sorted[0].numValue * 100 + sorted[1].numValue * 10 + sorted[2].numValue,
    name: '散牌',
    cards: sorted
  };
}

/**
 * 比较两手牌
 * 返回 1 表示 hand1 赢，-1 表示 hand2 赢，0 表示平局
 */
function compareHands(hand1, hand2) {
  const eval1 = evaluateHand(hand1);
  const eval2 = evaluateHand(hand2);
  
  if (eval1.type !== eval2.type) {
    return eval1.type > eval2.type ? 1 : -1;
  }
  
  if (eval1.value > eval2.value) return 1;
  if (eval1.value < eval2.value) return -1;
  return 0;
}

/**
 * 找出赢家
 */
function findWinner(hands) {
  let winnerIndex = 0;
  let winnerEval = evaluateHand(hands[0]);
  
  for (let i = 1; i < hands.length; i++) {
    const currentEval = evaluateHand(hands[i]);
    
    if (currentEval.type > winnerEval.type ||
        (currentEval.type === winnerEval.type && currentEval.value > winnerEval.value)) {
      winnerIndex = i;
      winnerEval = currentEval;
    }
  }
  
  return { winnerIndex, handType: winnerEval };
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
  evaluateHand,
  compareHands,
  findWinner,
  HAND_TYPES
};
