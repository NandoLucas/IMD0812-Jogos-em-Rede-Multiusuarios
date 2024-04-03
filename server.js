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
        const playerLimites =
          game.player1 === ws ? game.limitesJogador1 : game.limitesJogador2;
        // retorna a quantidade de navios a serem posicionados, quando for 0, o jogo pode iniciar
        const remainingShips = Object.values(playerLimites).reduce(
          (acc, val) => acc + val,
          0
        );

        if (remainingShips > 0) {
          ws.send(
            JSON.stringify({
              action: "error",
              message: "Você ainda não posicionou todos os navios.",
            })
          );
          return;
        }

        game.readyPlayers++;
        if (game.readyPlayers === 2) {
          game.status = "playing";
          game.currentPlayer =
            Math.random() < 0.5 ? game.player1 : game.player2; // Determina aleatoriamente o primeiro jogador
          game.player1.send(JSON.stringify({ action: "startGame" }));
          game.player2.send(JSON.stringify({ action: "startGame" }));
        }
      }
    } else if (game && game.status === "playing") {
      const data = JSON.parse(message);
      if (data.action === "shoot") {
        const { row, col } = data.coordinates;
        const currentPlayer = game.currentPlayer;
        const attackingPlayer = ws;
        if (attackingPlayer === currentPlayer) {
          checkHit(row, col, game); // Chama a função para verificar o acerto
        } else {
          // Se não for o jogador da vez, envie uma mensagem de erro
          ws.send(
            JSON.stringify({
              action: "error",
              message: "Não é sua vez de atacar.",
            })
          );
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
  const gameBoardPlayer1 = Array.from(Array(10), () => Array(10).fill(0));
  const gameBoardPlayer2 = Array.from(Array(10), () => Array(10).fill(0));

  const game = {
    player1: player1,
    player2: player2,
    status: "config",
    readyPlayers: 0,
    player1Board: gameBoardPlayer1,
    player2Board: gameBoardPlayer2,
    limitesJogador1: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 3,
    },
    limitesJogador2: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 3,
    },
    currentPlayer: player1, // jogador atual
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
  const orientation = Math.floor(Math.random() * 2);

  if (limites[shipType] <= 0) {
    return { error: "Limite de navios para este tipo excedido" };
  } else {
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

      if (row >= 10 || col >= 10 || gameBoard[row][col] !== 0) {
        validPosition = false;
        break;
      }

      if (hasAdjacentShip(row, col, gameBoard)) {
        validPosition = false;
        break;
      }
    }
  }

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
    jogador: jogador,
  };
}

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

function checkHit(row, col, game) {
  //define o atacante como player atual definido ao mudar o status para playing
  const attackingPlayer = game.currentPlayer;
  // defensor de acordo com o atacante
  const defendingPlayer =
    attackingPlayer === game.player1 ? game.player2 : game.player1;
  // tabuleiro do defensor
  const defendingPlayerBoard =
    attackingPlayer === game.player1 ? game.player2Board : game.player1Board;

  if (defendingPlayerBoard[row][col] === 1) {
    defendingPlayerBoard[row][col] = 2;
    attackingPlayer.send(
      JSON.stringify({
        action: "hit",
        coordinates: { row, col },
        player: "player",
      })
    );
    defendingPlayer.send(
      JSON.stringify({
        action: "opponentHit",
        coordinates: { row, col },
        player: "opponent",
      })
    );
    if (contemNavio(defendingPlayerBoard)) {
      // Se todos os navios foram afundados, o jogador atual é o vencedor
      attackingPlayer.send(JSON.stringify({ action: "victory" }));
      defendingPlayer.send(JSON.stringify({ action: "defeat" }));
      fimJogo(game);
      return;
    }
  } else {
    attackingPlayer.send(
      JSON.stringify({
        action: "miss",
        coordinates: { row, col },
        player: "player",
      })
    );
    defendingPlayer.send(
      JSON.stringify({
        action: "opponentMiss",
        coordinates: { row, col },
        player: "opponent",
      })
    );
    // Troca a vez do jogador, quando o oponente erra
    game.currentPlayer = defendingPlayer;
  }
}
// Função que verifica se ainda existem navios no tabuleiro
function contemNavio(board) {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === 1) {
        // Se ainda houver pelo menos um navio no tabuleiro, retorna falso
        return false;
      }
    }
  }
  // Se nenhum navio for encontrado, retorna verdadeiro
  return true;
}
