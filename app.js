const chat = document.getElementById("chat");
const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const answers = document.getElementById("answers");
const restartBtn = document.getElementById("restartBtn");

let tree = null;
let currentNode = null;

function scrollToLatest() {
  const lastItem = chat.lastElementChild;
  if (!lastItem) return;

  requestAnimationFrame(() => {
    lastItem.scrollIntoView({ behavior: "smooth", block: "end" });
  });
}

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `message message-${type}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  scrollToLatest();
}

function showButtons(show) {
  if (show) {
    chat.appendChild(answers);
  }
  answers.classList.toggle("hidden", !show);
  yesBtn.disabled = !show;
  noBtn.disabled = !show;
  scrollToLatest();
}

function showRestart(show) {
  restartBtn.classList.toggle("hidden", !show);
}

function askQuestion(node) {
  currentNode = node;
  addMessage(node.question || "Вопрос не задан", "system");
  showButtons(true);
  showRestart(false);
}

function showResult(code) {
  addMessage(`Код классификатора ЕСКД: ${code}`, "result");
  showButtons(false);
  showRestart(true);
}

function handleAnswer(answerKey) {
  if (!currentNode) return;

  showButtons(false);
  addMessage(answerKey === "yes" ? "Да" : "Нет", "user");

  const nextNode = currentNode[answerKey];
  if (!nextNode) {
    showResult("Не найден");
    return;
  }

  if (nextNode.result) {
    showResult(nextNode.result);
    return;
  }

  askQuestion(nextNode);
}

function startDialog() {
  chat.innerHTML = "";
  if (!tree) return;
  addMessage("Привет! Давай подберем номер", "system");
  askQuestion(tree);
}

fetch("classifier.json")
  .then((res) => res.json())
  .then((data) => {
    tree = data;
    startDialog();
  })
  .catch(() => {
    addMessage("Ошибка загрузки файла классификатора", "system");
    showButtons(false);
    showRestart(false);
  });

yesBtn.addEventListener("click", () => handleAnswer("yes"));
noBtn.addEventListener("click", () => handleAnswer("no"));
restartBtn.addEventListener("click", startDialog);
