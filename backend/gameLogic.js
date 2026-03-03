const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Game {
    constructor(numPlayers) {
        this.numPlayers = numPlayers;
        this.players = Array.from({ length: numPlayers }, (_, i) => ({
            id: i,
            hand: [],
            isOut: false
        }));
        this.winners = [];
        this.donkey = null;
        this.deck = this.createDeck();
        this.currentTrick = [];
        this.currentSuit = null;
        this.startingPlayerIndex = -1;
        this.turnIndex = -1;
        this.isGameOver = false;
        this.isStarted = false;
    }

    createDeck() {
        let deck = [];
        for (let suit of SUITS) {
            for (let value of VALUES) {
                deck.push({ suit, value, rank: VALUES.indexOf(value) });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    deal() {
        this.isStarted = true;
        let i = 0;
        while (this.deck.length > 0) {
            this.players[i % this.numPlayers].hand.push(this.deck.pop());
            i++;
        }
        this.players.forEach(p => this.sortHand(p));
        this.findStartingPlayer();
    }

    sortHand(player) {
        const order = ['spades', 'diamonds', 'clubs', 'hearts'];

        player.hand.sort((a, b) => {
            if (a.suit !== b.suit) {
                return order.indexOf(a.suit) - order.indexOf(b.suit);
            }
            return b.rank - a.rank; // Descending rank
        });
    }

    findStartingPlayer() {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].hand.some(card => card.suit === 'spades' && card.value === 'A')) {
                this.startingPlayerIndex = i;
                this.turnIndex = i;
                break;
            }
        }
    }

    playCard(playerIndex, cardIndex) {
        if (!this.isStarted) return { error: "Game has not started" };
        if (playerIndex !== this.turnIndex) return { error: "Not your turn" };
        if (this.players[playerIndex].isOut) return { error: "You are already out" };

        const player = this.players[playerIndex];
        const card = player.hand[cardIndex];

        if (this.currentTrick.length === 0) {
            if (this.isFirstMove() && !(card.suit === 'spades' && card.value === 'A')) {
                return { error: "Must start with Ace of Spades" };
            }
            this.currentSuit = card.suit;
        } else {
            const hasSuit = player.hand.some(c => c.suit === this.currentSuit);
            if (hasSuit && card.suit !== this.currentSuit) {
                return { error: "Must follow suit" };
            }
        }

        player.hand.splice(cardIndex, 1);
        this.currentTrick.push({ playerIndex, card });

        const activePlayersCount = this.players.filter(p => !p.isOut).length;
        if (this.currentTrick.length === activePlayersCount || card.suit !== this.currentSuit) {
            return this.resolveTrick();
        }

        this.turnIndex = this.findNextActivePlayer(this.turnIndex);
        return { success: true, gameState: this.getState() };
    }

    findNextActivePlayer(currentIndex) {
        let next = (currentIndex + 1) % this.numPlayers;
        let count = 0;
        while (this.players[next].isOut && count < this.numPlayers) {
            next = (next + 1) % this.numPlayers;
            count++;
        }
        return next;
    }

    isFirstMove() {
        const initialTotal = 52;
        const currentTotal = this.players.reduce((sum, p) => sum + p.hand.length, 0);
        return currentTotal === initialTotal && this.currentTrick.length === 0;
    }

    resolveTrick() {
        const leadSuit = this.currentSuit;
        let highestCard = -1;
        let winnerIndex = -1;

        for (const move of this.currentTrick) {
            if (move.card.suit === leadSuit && move.card.rank > highestCard) {
                highestCard = move.card.rank;
                winnerIndex = move.playerIndex;
            }
        }

        const broken = this.currentTrick.some(move => move.card.suit !== leadSuit);
        if (broken) {
            const penaltyCards = this.currentTrick.map(m => m.card);
            this.players[winnerIndex].hand.push(...penaltyCards);
            this.sortHand(this.players[winnerIndex]);
        }

        this.players.forEach(p => {
            if (!p.isOut && p.hand.length === 0) {
                p.isOut = true;
                this.winners.push(p.id);
            }
        });

        this.currentTrick = [];
        this.currentSuit = null;

        const stillIn = this.players.filter(p => !p.isOut);
        if (stillIn.length <= 1) {
            this.isGameOver = true;
            if (stillIn.length === 1) {
                this.donkey = stillIn[0].id;
            }
            this.turnIndex = -1;
            return { success: true, trickResolved: true, gameState: this.getState() };
        }

        if (this.players[winnerIndex].isOut) {
            this.turnIndex = this.findNextActivePlayer(winnerIndex);
        } else {
            this.turnIndex = winnerIndex;
        }

        return { success: true, trickResolved: true, winner: winnerIndex, broken, gameState: this.getState() };
    }

    getState() {
        return {
            players: this.players.map(p => ({
                id: p.id,
                cardCount: p.hand.length,
                isOut: p.isOut
            })),
            currentTrick: this.currentTrick,
            currentSuit: this.currentSuit,
            turnIndex: this.turnIndex,
            isGameOver: this.isGameOver,
            isStarted: this.isStarted,
            winners: this.winners,
            donkey: this.donkey
        };
    }
}

module.exports = Game;
