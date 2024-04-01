const WebSocket = require("ws");
const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT });

let aguardaJogador = null;
let jogosAtivos = [];

wss.on("connection", function connection(ws) {
  console.log("New connection");

  if (aguardaJogador === null) {
    aguardaJogador = ws;
    ws.send(JSON.stringify({ action: "waitingForOpponent" }));
  } else {
    startNewGame(aguardaJogador, ws);
    aguardaJogador = null;
  }

  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
    const game = findGameByPlayer(ws);
    if (game && game.status === "config") {
      const data = JSON.parse(message);
      if (data.action === "selectShip") {
        let gameBoard;
        let jogador;
        let limites;
        if (game.player1 === ws) {
          gameBoard = game.player1Board;
          jogador = "player1";
          limites = game.limitesJogador1;
        } else if (game.player2 === ws) {
          gameBoard = game.player2Board;
          jogador = "player2";
          limites = game.limitesJogador2;
        }
        const coordinates = posicionarNavio(
          data.shipType,
          gameBoard,
          jogador,
          limites
        );
        if (coordinates.error) {
          ws.send(
            JSON.stringify({ action: "error", message: coordinates.error })
          );
        } else {
          ws.send(
            JSON.stringify({ action: "shipPosition", coordinates: coordinates })
          );
        }
      } else if (data.action === "finalizeShips") {
        game.readyPlayers++;
        if (game.readyPlayers === 2) {
          game.status = "playing";
          game.player1.send(JSON.stringify({ action: "startGame" }));
          game.player2.send(JSON.stringify({ action: "startGame" }));
        }
      }
    }
  });

  ws.on("close", function () {
    console.log("Connection closed");
    const game = findGameByPlayer(ws);
    if (game) {
      const opponent = ws === game.player1 ? game.player2 : game.player1;
      opponent.send(JSON.stringify({ action: "opponentDisconnected" }));
      fimJogo(game);
    }
  });
});

function startNewGame(player1, player2) {
  const gameBoardPlayer1 = Array.from(Array(10), () => Array(10).fill(0)); // Novo tabuleiro para o jogador 1
  const gameBoardPlayer2 = Array.from(Array(10), () => Array(10).fill(0)); // Novo tabuleiro para o jogador 2

  const game = {
    player1: player1,
    player2: player2,
    status: "config",
    readyPlayers: 0,
    player1Board: gameBoardPlayer1,
    player2Board: gameBoardPlayer2,
    limitesJogador1: {
      1: 1, // Limite para o tipo 1: 1 navio
      2: 2, // Limite para o tipo 2: 2 navios
      3: 3, // Limite para o tipo 3: 3 navios
      4: 4, // Limite para o tipo 4: 4 navios
      5: 3, // Limite para o tipo 5: 3 navios
    },
    limitesJogador2: {
      1: 1, // Limite para o tipo 1: 1 navio
      2: 2, // Limite para o tipo 2: 2 navios
      3: 3, // Limite para o tipo 3: 3 navios
      4: 4, // Limite para o tipo 4: 4 navios
      5: 3, // Limite para o tipo 5: 3 navios
    },
    opponentBoard: [], // tabuleiro do oponente, usado para mostrar os tiros
  };

  jogosAtivos.push(game);
  player1.send(JSON.stringify({ action: "gameStarted" }));
  player2.send(JSON.stringify({ action: "gameStarted" }));
}

function findGameByPlayer(player) {
  return jogosAtivos.find(
    (game) => game.player1 === player || game.player2 === player
  );
}

function fimJogo(game) {
  const index = jogosAtivos.indexOf(game);
  if (index !== -1) {
    jogosAtivos.splice(index, 1);
  }
}

function posicionarNavio(shipType, gameBoard, jogador, limites) {
  const shipSize = getTamNavio(shipType);
  const orientation = Math.floor(Math.random() * 2); // 0 para horizontal, 1 para vertical

  // Verificar se o limite para este tipo de navio foi atingido para o jogador atual
  if (limites[shipType] <= 0) {
    // Se o limite foi atingido, retorne uma mensagem informando que o limite foi excedido
    return { error: "Limite de navios para este tipo excedido" };
  } else {
    // Diminuir o contador para este tipo de navio para o jogador atual
    limites[shipType]--;
  }

  let validPosition = false;
  let coordinates = {};

  while (!validPosition) {
    if (orientation === 0) {
      coordinates.row = Math.floor(Math.random() * 10);
      coordinates.col = Math.floor(Math.random() * (10 - shipSize + 1));
    } else {
      coordinates.row = Math.floor(Math.random() * (10 - shipSize + 1));
      coordinates.col = Math.floor(Math.random() * 10);
    }

    validPosition = true;
    for (let i = 0; i < shipSize; i++) {
      const row = orientation === 1 ? coordinates.row + i : coordinates.row;
      const col = orientation === 0 ? coordinates.col + i : coordinates.col;

      // Verificar se a posição está dentro do tabuleiro
      if (row >= 10 || col >= 10 || gameBoard[row][col] !== 0) {
        validPosition = false;
        break;
      }

      // Verificar se há navios adjacentes
      if (hasAdjacentShip(row, col, gameBoard)) {
        validPosition = false;
        break;
      }
    }
  }

  // Marcar as coordenadas no tabuleiro como ocupadas pelo navio
  for (let i = 0; i < shipSize; i++) {
    const row = coordinates.row + (orientation === 1 ? i : 0);
    const col = coordinates.col + (orientation === 0 ? i : 0);
    gameBoard[row][col] = 1;
  }

  return {
    row: coordinates.row,
    col: coordinates.col,
    orientation: orientation,
    size: shipSize,
    jogador: jogador, // Adiciona o jogador à resposta
  };
}

// Função auxiliar para verificar se há navios adjacentes
function hasAdjacentShip(row, col, gameBoard) {
  const adjacentOffsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const offset of adjacentOffsets) {
    const newRow = row + offset[0];
    const newCol = col + offset[1];
    if (
      newRow >= 0 &&
      newRow < 10 &&
      newCol >= 0 &&
      newCol < 10 &&
      gameBoard[newRow][newCol] !== 0
    ) {
      return true;
    }
  }
  return false;
}

function getTamNavio(shipType) {
  switch (shipType) {
    case "1":
      return 5;
    case "2":
      return 4;
    case "3":
      return 3;
    case "4":
      return 1;
    case "5":
      return 2;
    default:
      return 0;
  }
}
