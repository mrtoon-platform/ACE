import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, Plus, Play, MessageSquare, Send, Trophy } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const socket = io(BACKEND_URL);

const SUIT_ICONS = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣'
};

const Card = ({ suit, value, onClick, isBack, style }) => {
    if (isBack) {
        return (
            <motion.div
                className="card card-back"
                style={style}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: 0 }}
            />
        );
    }

    return (
        <motion.div
            className={`card ${suit}`}
            onClick={onClick}
            layoutId={`${suit}-${value}`}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ ...style, cursor: 'pointer', '--suit-color': suit === 'hearts' || suit === 'diamonds' ? '#d63031' : '#1a1a1a' }}
        >
            <div className="card-corner top-left">
                <div className="card-value">{value}</div>
                <div className="card-suit-mini">{SUIT_ICONS[suit]}</div>
            </div>
            <div className="card-suit-large">{SUIT_ICONS[suit]}</div>
            <div className="card-corner bottom-right">
                <div className="card-value">{value}</div>
                <div className="card-suit-mini">{SUIT_ICONS[suit]}</div>
            </div>
        </motion.div>
    );
};

export default function App() {
    const [view, setView] = useState('landing');
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [currentRoomCode, setCurrentRoomCode] = useState('');
    const [gameState, setGameState] = useState(null);
    const [playerIndex, setPlayerIndex] = useState(-1);
    const [isHost, setIsHost] = useState(false);
    const [hand, setHand] = useState([]);
    const [error, setError] = useState(null);
    const [players, setPlayers] = useState([]);
    const [playersCount, setPlayersCount] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, showChat]);

    useEffect(() => {
        socket.on('room_created', ({ roomCode, playerIndex, players }) => {
            setCurrentRoomCode(roomCode);
            setPlayerIndex(playerIndex);
            setIsHost(true);
            setView('lobby');
            setPlayersCount(1);
            if (players) setPlayers(players);
        });

        socket.on('joined_room', ({ roomCode, playerIndex, players }) => {
            setCurrentRoomCode(roomCode);
            setPlayerIndex(playerIndex);
            setIsHost(false);
            setView('lobby');
            if (players) setPlayers(players);
        });

        socket.on('player_joined', ({ playersCount, players }) => {
            setPlayersCount(playersCount);
            if (players) setPlayers(players);
        });

        socket.on('you_are_host', () => setIsHost(true));

        socket.on('game_started', ({ hand, gameState }) => {
            setHand(hand);
            setGameState(gameState);
            setView('game');
        });

        socket.on('update_state', ({ gameState, lastMove }) => {
            setGameState(gameState);
            if (lastMove?.error) setError(lastMove.error);
            else setError(null);
        });

        socket.on('update_hand', (newHand) => setHand(newHand));

        socket.on('error', (msg) => {
            setError(msg);
            setTimeout(() => setError(null), 3000);
        });

        socket.on('receive_message', (msg) => {
            setChatMessages(prev => [...prev.slice(-49), msg]);
        });

        return () => {
            socket.off('room_created');
            socket.off('joined_room');
            socket.off('player_joined');
            socket.off('game_started');
            socket.off('update_state');
            socket.off('update_hand');
            socket.off('error');
            socket.off('you_are_host');
            socket.off('receive_message');
        };
    }, []);

    const handleCreateRoom = () => {
        if (!playerName.trim()) return setError('Please enter your name');
        socket.emit('create_room', playerName);
    };

    const handleJoinRoom = () => {
        if (!playerName.trim()) return setError('Please enter your name');
        if (roomCode.length >= 4) {
            socket.emit('join_room', { roomCode, playerName });
        } else {
            setError('Please enter a valid room code');
        }
    };

    const handleStartGame = () => socket.emit('start_game', currentRoomCode);

    const handlePlayCard = (cardIndex) => {
        socket.emit('play_card', { roomCode: currentRoomCode, playerIndex, cardIndex });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        socket.emit('send_message', { roomCode: currentRoomCode, message: chatInput, playerName });
        setChatInput('');
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(currentRoomCode);
        setError('Room code copied!');
        setTimeout(() => setError(null), 2000);
    };

    if (view === 'landing') {
        return (
            <div className="landing-screen">
                <motion.h1 initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="title">
                    Pattern Card Game
                </motion.h1>
                <div className="landing-card">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="YOUR NAME"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleCreateRoom} style={{ marginTop: '1rem' }}>
                        <Plus size={20} /> Create New Room
                    </button>
                    <div className="divider"><span>OR</span></div>
                    <div className="join-group">
                        <input
                            type="text"
                            placeholder="ROOM CODE"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        />
                        <button className="btn btn-secondary" onClick={handleJoinRoom}>Join</button>
                    </div>
                    {error && <p className="error-msg">{error}</p>}
                </div>
            </div>
        );
    }

    if (view === 'lobby') {
        return (
            <div className="lobby-screen">
                <div className="lobby-card">
                    <h2>Room: {currentRoomCode}</h2>
                    <button className="copy-btn" onClick={copyRoomCode}>
                        <Copy size={16} /> Copy Code
                    </button>
                    <div className="player-status">
                        <Users size={24} />
                        <span>{playersCount} / 6 Players</span>
                        <div className="player-list" style={{ marginTop: '1rem', width: '100%' }}>
                            {players.map(p => (
                                <div key={p.id} style={{ fontSize: '0.9rem', padding: '5px', opacity: 0.8 }}>
                                    {p.name} {p.id === 0 ? '(Host)' : ''}
                                </div>
                            ))}
                        </div>
                        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>(Min 3 to start)</p>
                    </div>
                    {isHost ? (
                        <button
                            className={`btn btn-primary ${playersCount < 3 ? 'disabled' : ''}`}
                            onClick={handleStartGame}
                            disabled={playersCount < 3}
                        >
                            <Play size={20} /> Start Game
                        </button>
                    ) : (
                        <div className="waiting-area">
                            <div className="waiting-animation"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
                            <p>Waiting for host to start...</p>
                        </div>
                    )}
                    {error && <p className="error-msg">{error}</p>}
                </div>
            </div>
        );
    }

    if (gameState && gameState.isGameOver) {
        return (
            <div className="game-over-screen">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="game-over-card">
                    <h1 className="donkey-title">DONKEY!</h1>
                    <div className="loser-badge">
                        <Users size={40} style={{ color: 'var(--accent-gold)' }} />
                        <h2>{gameState.playerNames[gameState.donkey]}</h2>
                        <p>Total Loss</p>
                    </div>
                    <div className="rankings-container">
                        <h3 style={{ marginBottom: '1rem', opacity: 0.5 }}>Final Rankings</h3>
                        {gameState.winners.map((pId, i) => (
                            <div key={pId} className="ranking-item">
                                <span className="rank-num">#{i + 1}</span>
                                <span className="rank-name">{gameState.playerNames[pId]}</span>
                                <Trophy size={14} style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32' }} />
                            </div>
                        ))}
                    </div>
                    <button className="btn btn-primary" onClick={() => window.location.reload()}>New Game</button>
                </motion.div>
            </div>
        );
    }

    const isMyTurn = gameState?.turnIndex === playerIndex;
    const isOut = gameState?.players[playerIndex]?.isOut;

    return (
        <div className="game-container">
            {isOut && (
                <div className="out-overlay">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="out-overlay-card">
                        <h2>🎉 You're Out!</h2>
                        <p style={{ opacity: 0.7 }}>You successfully disposed of all cards.</p>
                        <p style={{ marginTop: '1rem', color: 'var(--accent-gold)' }}>Waiting for others to finish...</p>
                    </motion.div>
                </div>
            )}

            <button className="chat-toggle" onClick={() => setShowChat(!showChat)}>
                <MessageSquare size={24} />
                {chatMessages.length > 0 && !showChat && <span className="chat-badge">{chatMessages.length}</span>}
            </button>

            <AnimatePresence>
                {showChat && (
                    <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="chat-window">
                        <div className="chat-header">
                            <h3>Room Chat</h3>
                            <button onClick={() => setShowChat(false)}>×</button>
                        </div>
                        <div className="chat-messages">
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`chat-msg ${msg.playerName === playerName ? 'own' : ''}`}>
                                    <div className="msg-info">
                                        <span className="msg-user">{msg.playerName}</span>
                                        <span className="msg-time">{msg.time}</span>
                                    </div>
                                    <div className="msg-text">{msg.message}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <form className="chat-input" onSubmit={handleSendMessage}>
                            <input type="text" placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                            <button type="submit"><Send size={18} /></button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="game-info">
                <div className="room-indicator" onClick={copyRoomCode}>Room: {currentRoomCode}</div>
                <div className={`turn-indicator ${isMyTurn ? 'active' : ''}`}>
                    {isMyTurn ? "YOUR TURN" : `${gameState?.playerNames[gameState?.turnIndex]}'S TURN`}
                </div>
                {gameState?.currentSuit && (
                    <div className="suit-indicator">
                        Suit: <span className={gameState.currentSuit}>{SUIT_ICONS[gameState.currentSuit]} {gameState.currentSuit.toUpperCase()}</span>
                    </div>
                )}
            </div>

            <div className="table-surface">
                <div className="trick-center">
                    {gameState?.currentSuit && (
                        <div className="center-lead-suit">
                            <div className={`suit-icon ${gameState.currentSuit}`}>{SUIT_ICONS[gameState.currentSuit]}</div>
                            <div className="suit-label">LEAD</div>
                        </div>
                    )}
                    {gameState?.players.map((p, i) => {
                        const angle = (i / gameState.players.length) * 360;
                        const rad = (angle * Math.PI) / 180;
                        const radius = 125;
                        return (
                            <div key={`spot-${i}`} className={`player-spot-placeholder ${p.isOut ? 'out' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${Math.sin(rad) * radius}px, ${Math.cos(rad) * -radius}px) rotate(${angle - 180}deg)` }}>
                                <div className="placeholder-name" style={{ transform: `rotate(${-(angle - 180)}deg)` }}>{gameState.playerNames[i]} {p.isOut ? '🏁' : ''}</div>
                            </div>
                        );
                    })}
                    <AnimatePresence>
                        {gameState?.currentTrick.map((move, i) => {
                            const angle = (move.playerIndex / gameState.players.length) * 360;
                            const rad = (angle * Math.PI) / 180;
                            const radius = 125;
                            return (
                                <motion.div key={`${move.card.suit}-${move.card.value}`} initial={{ opacity: 0, scale: 1.2, x: 0, y: 300, rotate: 0 }} animate={{ opacity: 1, scale: 1, x: Math.sin(rad) * radius, y: Math.cos(rad) * -radius, rotate: angle - 180 }} exit={{ opacity: 0, scale: 1.1, x: Math.sin(rad) * radius * 1.5, y: Math.cos(rad) * -radius * 1.5, transition: { delay: i * 0.1 } }} transition={{ type: "spring", stiffness: 180, damping: 18 }} style={{ position: 'absolute', zIndex: 10 + i }}>
                                    <Card suit={move.card.suit} value={move.card.value} />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <div className="player-hand-container">
                {hand.map((card, i) => {
                    const total = hand.length;
                    const midpoint = (total - 1) / 2;
                    const offset = i - midpoint;
                    const rotation = offset * (30 / Math.max(total, 5));
                    const translateY = Math.abs(offset) * 10;
                    return (
                        <div key={`${card.suit}-${card.value}-${i}`} className="hand-card-wrapper" style={{ transform: `rotate(${rotation}deg) translateY(${translateY}px)`, transformOrigin: 'bottom center', zIndex: i }}>
                            <Card suit={card.suit} value={card.value} onClick={() => handlePlayCard(i)} />
                        </div>
                    );
                })}
            </div>

            {gameState?.players.map((p, idx) => (
                idx !== playerIndex && (
                    <div key={idx} className={`opponent-badge p${idx} ${p.isOut ? 'out' : ''}`} style={getOpponentStyle(idx, gameState.players.length)}>
                        {gameState.playerNames[idx]}: {p.isOut ? 'Winner' : p.cardCount}
                    </div>
                )
            ))}
            {error && <div className="game-error-toast">{error}</div>}
        </div>
    );
}

const getOpponentStyle = (idx, total) => {
    const angle = (idx / total) * 360;
    const rad = (angle * Math.PI) / 180;
    return {
        position: 'absolute',
        top: `${50 + Math.cos(rad) * -40}%`,
        left: `${50 + Math.sin(rad) * 40}%`,
        transform: 'translate(-50%, -50%)',
        padding: '8px 15px',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: '20px',
        fontSize: '0.8rem',
        backdropFilter: 'blur(5px)',
        border: '1px solid rgba(255,255,255,0.1)'
    };
};
