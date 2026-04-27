const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const STORAGE_KEY = "tetris-best-score";

const COLORS = {
  I: "#45d9ff",
  O: "#ffd84d",
  T: "#b56cff",
  S: "#4be37b",
  Z: "#ff5f72",
  J: "#5d8cff",
  L: "#ffad42",
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

const POINTS = [0, 100, 300, 500, 800];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const els = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  level: document.getElementById("level"),
  lines: document.getElementById("lines"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  restartButton: document.getElementById("restartButton"),
};

const state = {
  board: createMatrix(ROWS, COLS),
  current: null,
  next: null,
  score: 0,
  best: Number(localStorage.getItem(STORAGE_KEY)) || 0,
  level: 1,
  lines: 0,
  dropCounter: 0,
  dropInterval: 900,
  lastTime: 0,
  paused: false,
  gameOver: false,
};

function createMatrix(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const matrix = SHAPES[type].map((row) => row.slice());
  return {
    type,
    matrix,
    row: 0,
    col: Math.floor((COLS - matrix[0].length) / 2),
  };
}

function resetGame() {
  state.board = createMatrix(ROWS, COLS);
  state.current = randomPiece();
  state.next = randomPiece();
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.dropCounter = 0;
  state.dropInterval = getDropInterval();
  state.lastTime = 0;
  state.paused = false;
  state.gameOver = false;
  updateStats();
  hideOverlay();
  draw();
}

function spawnPiece() {
  state.current = state.next;
  state.current.row = 0;
  state.current.col = Math.floor((COLS - state.current.matrix[0].length) / 2);
  state.next = randomPiece();
  if (collides(state.current.matrix, state.current.row, state.current.col)) {
    endGame();
  }
}

function collides(matrix, row, col) {
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      if (!matrix[r][c]) continue;
      const boardRow = row + r;
      const boardCol = col + c;
      if (boardCol < 0 || boardCol >= COLS || boardRow >= ROWS) return true;
      if (boardRow >= 0 && state.board[boardRow][boardCol]) return true;
    }
  }
  return false;
}

function mergePiece() {
  const { matrix, row, col, type } = state.current;
  matrix.forEach((line, r) => {
    line.forEach((value, c) => {
      if (value && row + r >= 0) state.board[row + r][col + c] = type;
    });
  });
}

function clearLines() {
  let cleared = 0;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (state.board[row].every(Boolean)) {
      state.board.splice(row, 1);
      state.board.unshift(Array(COLS).fill(null));
      cleared += 1;
      row += 1;
    }
  }

  if (cleared > 0) {
    state.lines += cleared;
    state.score += POINTS[cleared] * state.level;
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = getDropInterval();
    saveBestScore();
    updateStats();
  }
}

function getDropInterval() {
  return Math.max(90, 900 - (state.level - 1) * 75);
}

function movePiece(delta) {
  if (!canPlay()) return;
  const nextCol = state.current.col + delta;
  if (!collides(state.current.matrix, state.current.row, nextCol)) {
    state.current.col = nextCol;
    draw();
  }
}

function softDrop(awardPoint = true) {
  if (!canPlay()) return;
  if (!collides(state.current.matrix, state.current.row + 1, state.current.col)) {
    state.current.row += 1;
    if (awardPoint) state.score += 1;
    saveBestScore();
    updateStats();
  } else {
    lockPiece();
  }
  state.dropCounter = 0;
  draw();
}

function hardDrop() {
  if (!canPlay()) return;
  let distance = 0;
  while (!collides(state.current.matrix, state.current.row + 1, state.current.col)) {
    state.current.row += 1;
    distance += 1;
  }
  state.score += distance * 2;
  lockPiece();
  saveBestScore();
  updateStats();
  draw();
}

function rotatePiece() {
  if (!canPlay()) return;
  const rotated = rotate(state.current.matrix);
  const originalCol = state.current.col;
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    state.current.col = originalCol + kick;
    if (!collides(rotated, state.current.row, state.current.col)) {
      state.current.matrix = rotated;
      draw();
      return;
    }
  }
  state.current.col = originalCol;
}

function rotate(matrix) {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]).reverse());
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
}

function togglePause() {
  if (state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    showOverlay("Paused", "Press P to resume");
  } else {
    state.dropCounter = 0;
    state.lastTime = performance.now();
    hideOverlay();
  }
}

function canPlay() {
  return !state.paused && !state.gameOver && state.current;
}

function endGame() {
  state.gameOver = true;
  saveBestScore();
  updateStats();
  showOverlay("Game Over", "Press Restart to play again");
}

function saveBestScore() {
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }
}

function updateStats() {
  els.score.textContent = state.score;
  els.best.textContent = state.best;
  els.level.textContent = state.level;
  els.lines.textContent = state.lines;
}

function showOverlay(title, text) {
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = text;
  els.overlay.hidden = false;
}

function hideOverlay() {
  els.overlay.hidden = true;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, COLS, ROWS, BLOCK);
  drawBoard();
  if (state.current) drawMatrix(ctx, state.current.matrix, state.current.col, state.current.row, BLOCK, state.current.type);
  drawNext();
}

function drawGrid(context, cols, rows, size) {
  context.fillStyle = "#0b0f18";
  context.fillRect(0, 0, cols * size, rows * size);
  context.strokeStyle = "rgba(255, 255, 255, 0.055)";
  context.lineWidth = 1;
  for (let col = 0; col <= cols; col += 1) {
    context.beginPath();
    context.moveTo(col * size + 0.5, 0);
    context.lineTo(col * size + 0.5, rows * size);
    context.stroke();
  }
  for (let row = 0; row <= rows; row += 1) {
    context.beginPath();
    context.moveTo(0, row * size + 0.5);
    context.lineTo(cols * size, row * size + 0.5);
    context.stroke();
  }
}

function drawBoard() {
  state.board.forEach((row, r) => {
    row.forEach((type, c) => {
      if (type) drawBlock(ctx, c * BLOCK, r * BLOCK, BLOCK, COLORS[type]);
    });
  });
}

function drawMatrix(context, matrix, col, row, size, type) {
  matrix.forEach((line, r) => {
    line.forEach((value, c) => {
      if (value) drawBlock(context, (col + c) * size, (row + r) * size, size, COLORS[type]);
    });
  });
}

function drawBlock(context, x, y, size, color) {
  const padding = Math.max(2, size * 0.08);
  const w = size - padding * 2;
  const gradient = context.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, lighten(color, 22));
  gradient.addColorStop(1, color);
  context.fillStyle = gradient;
  context.fillRect(x + padding, y + padding, w, w);
  context.strokeStyle = "rgba(255,255,255,0.18)";
  context.strokeRect(x + padding + 0.5, y + padding + 0.5, w - 1, w - 1);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "#111725";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!state.next) return;
  const matrix = state.next.matrix;
  const size = 24;
  const width = matrix[0].length * size;
  const height = matrix.length * size;
  const startCol = (nextCanvas.width - width) / 2 / size;
  const startRow = (nextCanvas.height - height) / 2 / size;
  drawMatrix(nextCtx, matrix, startCol, startRow, size, state.next.type);
}

function lighten(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, (value >> 16) + amount);
  const g = Math.min(255, ((value >> 8) & 255) + amount);
  const b = Math.min(255, (value & 255) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function update(time = 0) {
  const deltaTime = time - state.lastTime;
  state.lastTime = time;

  if (!state.paused && !state.gameOver) {
    state.dropCounter += deltaTime;
    if (state.dropCounter > state.dropInterval) softDrop(false);
  }

  draw();
  requestAnimationFrame(update);
}

function handleAction(action) {
  if (action === "left") movePiece(-1);
  if (action === "right") movePiece(1);
  if (action === "down") softDrop();
  if (action === "rotate") rotatePiece();
  if (action === "drop") hardDrop();
  if (action === "pause") togglePause();
}

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    " ": "drop",
    p: "pause",
    P: "pause",
  };
  const action = keyMap[event.key];
  if (!action) return;
  event.preventDefault();
  handleAction(action);
});

document.querySelectorAll(".touch-controls button").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

els.restartButton.addEventListener("click", resetGame);

updateStats();
resetGame();
requestAnimationFrame(update);
