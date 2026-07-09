const DATA_URL = "qa/temarios_merged.jsonl";
const TEST_SIZE = 100;

const TOPIC_LABELS = {
  comun: "Común",
  tsid: "TSID",
  rt: "RT",
};

const EXAM_TYPES = [
  {
    id: "common",
    label: "Solo temario común",
    description: "100 preguntas del temario común.",
    parts: [{ topic: "comun", count: 100 }],
  },
  {
    id: "tsid",
    label: "Solo TSID",
    description: "100 preguntas del temario TSID.",
    parts: [{ topic: "tsid", count: 100 }],
  },
  {
    id: "rt",
    label: "Solo RT",
    description: "100 preguntas del temario RT.",
    parts: [{ topic: "rt", count: 100 }],
  },
  {
    id: "tsid-common",
    label: "TSID + común",
    description: "60 preguntas de TSID y 40 del temario común.",
    parts: [
      { topic: "tsid", count: 60 },
      { topic: "comun", count: 40 },
    ],
  },
  {
    id: "rt-common",
    label: "RT + común",
    description: "60 preguntas de RT y 40 del temario común.",
    parts: [
      { topic: "rt", count: 60 },
      { topic: "comun", count: 40 },
    ],
  },
];

const state = {
  questionsByTopic: {},
  selectedExamId: "common",
  selectionMode: "random",
  selectedBlockIndex: 0,
  currentQuestions: [],
  userAnswers: new Map(),
  isSubmitted: false,
  isPendingPanelOpen: false,
};

const elements = {
  dataStatus: document.querySelector("#dataStatus"),
  setupView: document.querySelector("#setupView"),
  examView: document.querySelector("#examView"),
  examTypeGrid: document.querySelector("#examTypeGrid"),
  randomModeButton: document.querySelector("#randomModeButton"),
  blockModeButton: document.querySelector("#blockModeButton"),
  blockSelectRow: document.querySelector("#blockSelectRow"),
  blockSelect: document.querySelector("#blockSelect"),
  buildHint: document.querySelector("#buildHint"),
  startButton: document.querySelector("#startButton"),
  backButton: document.querySelector("#backButton"),
  examTitle: document.querySelector("#examTitle"),
  examMeta: document.querySelector("#examMeta"),
  answeredCount: document.querySelector("#answeredCount"),
  progressBar: document.querySelector("#progressBar"),
  examProgressDock: document.querySelector("#examProgressDock"),
  compactAnsweredCount: document.querySelector("#compactAnsweredCount"),
  compactProgressBar: document.querySelector("#compactProgressBar"),
  pendingToggleButton: document.querySelector("#pendingToggleButton"),
  pendingToggleIcon: document.querySelector("#pendingToggleIcon"),
  pendingPanel: document.querySelector("#pendingPanel"),
  pendingSummary: document.querySelector("#pendingSummary"),
  pendingQuestionGrid: document.querySelector("#pendingQuestionGrid"),
  nextUnansweredButton: document.querySelector("#nextUnansweredButton"),
  scorePanel: document.querySelector("#scorePanel"),
  questionsForm: document.querySelector("#questionsForm"),
  submitButton: document.querySelector("#submitButton"),
  newTestButton: document.querySelector("#newTestButton"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();

  try {
    const questions = await loadQuestions();
    state.questionsByTopic = groupQuestionsByTopic(questions);
    renderExamTypeCards();
    updateBuildControls();
    elements.dataStatus.textContent = `${questions.length} preguntas cargadas`;
    elements.startButton.disabled = false;
  } catch (error) {
    elements.dataStatus.textContent = "No se pudieron cargar las preguntas";
    elements.buildHint.textContent =
      "No se pudo cargar el archivo de preguntas. Sirve esta carpeta por HTTP para que el navegador pueda leer qa/temarios_merged.jsonl.";
    console.error(error);
  }
}

function bindEvents() {
  elements.randomModeButton.addEventListener("click", () => setSelectionMode("random"));
  elements.blockModeButton.addEventListener("click", () => setSelectionMode("block"));
  elements.blockSelect.addEventListener("change", () => {
    state.selectedBlockIndex = Number(elements.blockSelect.value);
    updateBuildControls();
  });
  elements.startButton.addEventListener("click", startExam);
  elements.backButton.addEventListener("click", returnToSetup);
  elements.submitButton.addEventListener("click", submitExam);
  elements.newTestButton.addEventListener("click", returnToSetup);
  elements.questionsForm.addEventListener("change", handleAnswerChange);
  elements.pendingToggleButton.addEventListener("click", () => {
    setPendingPanelOpen(!state.isPendingPanelOpen);
  });
  elements.nextUnansweredButton.addEventListener("click", goToNextUnanswered);
  elements.pendingQuestionGrid.addEventListener("click", handlePendingQuestionClick);
}

async function loadQuestions() {
  const response = await fetch(DATA_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Question file returned ${response.status}`);
  }

  const text = await response.text();

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizeQuestion(JSON.parse(line)))
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.number - b.number);
}

function normalizeQuestion(rawQuestion) {
  return {
    id: `${rawQuestion.tipo_temario}-${rawQuestion.num_pregunta}`,
    topic: rawQuestion.tipo_temario,
    number: rawQuestion.num_pregunta,
    prompt: rawQuestion.pregunta,
    options: rawQuestion.respuestas_posibles || {},
    answers: rawQuestion.respuestas || {},
    challengedBy: rawQuestion.impugnables || [],
  };
}

function groupQuestionsByTopic(questions) {
  const groups = questions.reduce((accumulator, question) => {
    if (!accumulator[question.topic]) {
      accumulator[question.topic] = [];
    }

    accumulator[question.topic].push(question);
    return accumulator;
  }, {});

  Object.values(groups).forEach((topicQuestions) => {
    topicQuestions.sort((a, b) => a.number - b.number);
  });

  return groups;
}

function renderExamTypeCards() {
  elements.examTypeGrid.replaceChildren();

  EXAM_TYPES.forEach((examType) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "exam-type-card";
    card.setAttribute("aria-pressed", String(examType.id === state.selectedExamId));
    card.dataset.examId = examType.id;

    const title = document.createElement("strong");
    title.textContent = examType.label;

    const description = document.createElement("span");
    description.textContent = examType.description;

    const composition = document.createElement("div");
    composition.className = "composition-list";
    examType.parts.forEach((part) => {
      const pill = document.createElement("span");
      pill.className = "topic-pill";
      pill.textContent = `${part.count} ${TOPIC_LABELS[part.topic]}`;
      composition.append(pill);
    });

    card.append(title, description, composition);
    card.addEventListener("click", () => {
      state.selectedExamId = examType.id;
      state.selectedBlockIndex = 0;
      renderExamTypeCards();
      updateBuildControls();
    });

    if (examType.id === state.selectedExamId) {
      card.classList.add("is-selected");
    }

    elements.examTypeGrid.append(card);
  });
}

function setSelectionMode(mode) {
  state.selectionMode = mode;
  state.selectedBlockIndex = 0;
  updateBuildControls();
}

function updateBuildControls() {
  const examType = getSelectedExamType();
  const blockCount = getBlockCount(examType);
  const isBlockMode = state.selectionMode === "block";

  elements.randomModeButton.classList.toggle("is-active", !isBlockMode);
  elements.randomModeButton.setAttribute("aria-selected", String(!isBlockMode));
  elements.blockModeButton.classList.toggle("is-active", isBlockMode);
  elements.blockModeButton.setAttribute("aria-selected", String(isBlockMode));
  elements.blockSelectRow.classList.toggle("is-hidden", !isBlockMode);

  if (state.selectedBlockIndex >= blockCount) {
    state.selectedBlockIndex = 0;
  }

  renderBlockOptions(examType, blockCount);

  elements.buildHint.textContent = isBlockMode
    ? getBlockHint(examType, state.selectedBlockIndex)
    : getRandomHint(examType, blockCount);
}

function renderBlockOptions(examType, blockCount) {
  elements.blockSelect.replaceChildren();

  for (let index = 0; index < blockCount; index += 1) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Bloque ${index + 1} de ${blockCount}`;
    option.selected = index === state.selectedBlockIndex;
    elements.blockSelect.append(option);
  }
}

function getRandomHint(examType, blockCount) {
  const composition = formatComposition(examType.parts);
  return `El modo aleatorio elige ${composition}. El modo por bloques tiene ${blockCount} bloques completos que usan una vez todas las preguntas de este tipo de examen.`;
}

function getBlockHint(examType, blockIndex) {
  const ranges = examType.parts.map((part) => {
    const start = blockIndex * part.count;
    const end = start + part.count;
    const topicQuestions = state.questionsByTopic[part.topic] || [];
    const first = topicQuestions[start]?.number;
    const last = topicQuestions[end - 1]?.number;
    return `${TOPIC_LABELS[part.topic]} ${first}-${last}`;
  });

  return `Este bloque contiene ${ranges.join(" + ")}. Al completar todos los bloques se consume el conjunto completo de este tipo de examen.`;
}

function formatComposition(parts) {
  return parts.map((part) => `${part.count} ${TOPIC_LABELS[part.topic]}`).join(" + ");
}

function getSelectedExamType() {
  return EXAM_TYPES.find((examType) => examType.id === state.selectedExamId) || EXAM_TYPES[0];
}

function getBlockCount(examType) {
  return Math.min(
    ...examType.parts.map((part) => {
      const topicCount = state.questionsByTopic[part.topic]?.length || 0;
      return Math.floor(topicCount / part.count);
    }),
  );
}

function startExam() {
  const examType = getSelectedExamType();
  state.currentQuestions =
    state.selectionMode === "block" ? buildBlockQuestions(examType) : buildRandomQuestions(examType);
  state.userAnswers = new Map();
  state.isSubmitted = false;
  state.isPendingPanelOpen = window.matchMedia("(min-width: 821px)").matches;

  elements.setupView.classList.add("is-hidden");
  elements.examView.classList.remove("is-hidden");
  elements.scorePanel.classList.add("is-hidden");
  elements.submitButton.classList.remove("is-hidden");
  elements.newTestButton.classList.add("is-hidden");

  elements.examTitle.textContent = examType.label;
  elements.examMeta.textContent =
    state.selectionMode === "block"
      ? getBlockHint(examType, state.selectedBlockIndex)
      : `Selección aleatoria: ${formatComposition(examType.parts)}.`;

  renderQuestions();
  setPendingPanelOpen(state.isPendingPanelOpen);
  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildBlockQuestions(examType) {
  return examType.parts.flatMap((part) => {
    const start = state.selectedBlockIndex * part.count;
    const end = start + part.count;
    return (state.questionsByTopic[part.topic] || []).slice(start, end);
  });
}

function buildRandomQuestions(examType) {
  const questions = examType.parts.flatMap((part) => {
    const topicQuestions = [...(state.questionsByTopic[part.topic] || [])];
    return shuffle(topicQuestions).slice(0, part.count);
  });

  return shuffle(questions);
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function renderQuestions() {
  elements.questionsForm.replaceChildren();

  state.currentQuestions.forEach((question, index) => {
    const questionCard = document.createElement("article");
    questionCard.className = "question-card";
    questionCard.id = `question-${index + 1}`;
    questionCard.tabIndex = -1;

    const header = document.createElement("div");
    header.className = "question-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "question-title";

    const questionNumber = document.createElement("span");
    questionNumber.className = "question-number";
    questionNumber.textContent = `Pregunta ${index + 1} · ${TOPIC_LABELS[question.topic]} ${question.number}`;

    const title = document.createElement("h3");
    title.textContent = question.prompt;

    titleWrap.append(questionNumber, title);

    const topicPill = document.createElement("span");
    topicPill.className = "topic-pill";
    topicPill.textContent = TOPIC_LABELS[question.topic];

    header.append(titleWrap, topicPill);
    questionCard.append(header);

    if (state.isSubmitted && question.challengedBy.length > 0) {
      questionCard.append(createChallengeNotice(question));
    }

    const fieldset = document.createElement("fieldset");
    fieldset.className = "options-list";

    const legend = document.createElement("legend");
    legend.className = "sr-only";
    legend.textContent = `Respuestas de la pregunta ${index + 1}`;
    fieldset.append(legend);

    Object.keys(question.options)
      .sort()
      .forEach((optionKey) => {
        fieldset.append(createOptionRow(question, optionKey));
      });

    questionCard.append(fieldset);
    elements.questionsForm.append(questionCard);
  });
}

function createChallengeNotice(question) {
  const notice = document.createElement("div");
  notice.className = "challenge-notice";

  const icon = document.createElement("span");
  icon.className = "challenge-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = "&#9888;";

  const text = document.createElement("div");
  const label = question.challengedBy.join(", ");
  const noAnswerText =
    getCorrectLetters(question).length === 0 ? " No hay una respuesta aceptada, así que no puntúa." : "";
  text.textContent = `Impugnable según: ${label}.${noAnswerText}`;

  notice.append(icon, text);
  return notice;
}

function createOptionRow(question, optionKey) {
  const selectedAnswer = state.userAnswers.get(question.id);
  const row = document.createElement("label");
  row.className = `option-row ${getReviewClass(question, optionKey)}`.trim();
  row.classList.toggle("is-disabled", state.isSubmitted);

  const input = document.createElement("input");
  input.type = "radio";
  input.name = question.id;
  input.value = optionKey;
  input.checked = selectedAnswer === optionKey;
  input.disabled = state.isSubmitted;

  const letter = document.createElement("span");
  letter.className = "option-letter";
  letter.textContent = optionKey;

  const textWrap = document.createElement("span");
  textWrap.className = "option-text";

  const text = document.createElement("p");
  text.textContent = question.options[optionKey];
  textWrap.append(text);

  if (state.isSubmitted) {
    const note = createAnswerNote(question, optionKey);
    if (note) {
      textWrap.append(note);
    }
  }

  row.append(input, letter, textWrap);
  return row;
}

function createAnswerNote(question, optionKey) {
  const correctLetters = getCorrectLetters(question);
  const selectedAnswer = state.userAnswers.get(question.id);
  const selectedIsCorrect = correctLetters.includes(selectedAnswer);
  const optionIsCorrect = correctLetters.includes(optionKey);
  const optionIsSelected = selectedAnswer === optionKey;
  const challengedWithMultipleAnswers = question.challengedBy.length > 0 && correctLetters.length > 1;
  const noteParts = [];

  if (correctLetters.length === 0 && optionIsSelected) {
    noteParts.push("Respuesta elegida");
  } else if (challengedWithMultipleAnswers && optionIsSelected && optionIsCorrect) {
    noteParts.push("Tu respuesta aceptada");
  } else if (challengedWithMultipleAnswers && optionIsCorrect) {
    noteParts.push("Respuesta aceptada");
  } else if (optionIsSelected && optionIsCorrect) {
    noteParts.push("Tu respuesta correcta");
  } else if (optionIsSelected && !optionIsCorrect) {
    noteParts.push("Tu respuesta");
  } else if (optionIsCorrect && selectedIsCorrect && correctLetters.length > 1) {
    noteParts.push("También aceptada");
  } else if (optionIsCorrect) {
    noteParts.push("Respuesta correcta");
  }

  if (noteParts.length === 0 && !(correctLetters.length > 1 && optionIsCorrect)) {
    return null;
  }

  const note = document.createElement("span");
  note.className = "answer-note";

  noteParts.forEach((part) => {
    const text = document.createElement("span");
    text.textContent = part;
    note.append(text);
  });

  if (optionIsCorrect && shouldShowAnswerSources(question, optionKey, correctLetters)) {
    const source = document.createElement("span");
    source.className = "source-pill";
    source.textContent = `Lo dice: ${formatSources(question.answers[optionKey])}`;
    note.append(source);
  }

  return note;
}

function getReviewClass(question, optionKey) {
  if (!state.isSubmitted) {
    return "";
  }

  const correctLetters = getCorrectLetters(question);
  const selectedAnswer = state.userAnswers.get(question.id);
  const optionIsSelected = selectedAnswer === optionKey;
  const optionIsCorrect = correctLetters.includes(optionKey);
  const selectedIsCorrect = correctLetters.includes(selectedAnswer);
  const questionIsChallenged = question.challengedBy.length > 0;

  if (questionIsChallenged && correctLetters.length === 0) {
    return "is-alternate";
  }

  if (questionIsChallenged && correctLetters.length > 1) {
    if (optionIsSelected && !optionIsCorrect) {
      return "is-wrong";
    }

    if (optionIsCorrect) {
      return "is-alternate";
    }

    return "";
  }

  if (correctLetters.length === 0) {
    return optionIsSelected ? "is-neutral" : "";
  }

  if (!selectedAnswer && optionIsCorrect) {
    return "is-alternate";
  }

  if (optionIsSelected && optionIsCorrect) {
    return "is-correct";
  }

  if (optionIsSelected && !optionIsCorrect) {
    return "is-wrong";
  }

  if (optionIsCorrect && selectedIsCorrect && correctLetters.length > 1) {
    return "is-alternate";
  }

  if (optionIsCorrect) {
    return "is-correct";
  }

  return "";
}

function handleAnswerChange(event) {
  if (!event.target.matches('input[type="radio"]') || state.isSubmitted) {
    return;
  }

  state.userAnswers.set(event.target.name, event.target.value);
  updateProgress();
}

function updateProgress() {
  const total = state.currentQuestions.length || TEST_SIZE;
  const answered = state.userAnswers.size;
  const percentage = total === 0 ? 0 : Math.round((answered / total) * 100);

  elements.answeredCount.textContent = `${answered} / ${total} respondidas`;
  elements.progressBar.style.width = `${percentage}%`;
  elements.compactAnsweredCount.textContent = `${answered} / ${total} respondidas`;
  elements.compactProgressBar.style.width = `${percentage}%`;
  elements.submitButton.disabled = state.currentQuestions.length === 0 || state.isSubmitted;
  renderPendingQuestions();
}

function renderPendingQuestions() {
  const unansweredIndexes = getUnansweredIndexes();
  const pendingCount = unansweredIndexes.length;

  elements.pendingSummary.textContent =
    pendingCount === 0 ? "Todo respondido" : `${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`;
  elements.nextUnansweredButton.disabled = pendingCount === 0;
  elements.pendingQuestionGrid.replaceChildren();

  if (pendingCount === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "pending-empty";
    emptyMessage.textContent = "No quedan preguntas sin responder.";
    elements.pendingQuestionGrid.append(emptyMessage);
    return;
  }

  unansweredIndexes.forEach((questionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pending-question-button";
    button.dataset.questionIndex = String(questionIndex);
    button.textContent = String(questionIndex + 1);
    button.title = `Ir a la pregunta ${questionIndex + 1}`;
    elements.pendingQuestionGrid.append(button);
  });
}

function getUnansweredIndexes() {
  return state.currentQuestions.reduce((indexes, question, index) => {
    if (!state.userAnswers.has(question.id)) {
      indexes.push(index);
    }

    return indexes;
  }, []);
}

function goToNextUnanswered() {
  const unansweredIndexes = getUnansweredIndexes();

  if (unansweredIndexes.length === 0) {
    return;
  }

  const currentIndex = getCurrentQuestionIndex();
  const nextIndex = unansweredIndexes.find((questionIndex) => questionIndex >= currentIndex) ?? unansweredIndexes[0];
  scrollToQuestion(nextIndex);
}

function handlePendingQuestionClick(event) {
  const button = event.target.closest(".pending-question-button");

  if (!button) {
    return;
  }

  scrollToQuestion(Number(button.dataset.questionIndex));
}

function getCurrentQuestionIndex() {
  const cards = Array.from(document.querySelectorAll(".question-card"));
  const stickyOffset = elements.examProgressDock.getBoundingClientRect().height + 24;
  const visibleIndex = cards.findIndex((card) => card.getBoundingClientRect().bottom > stickyOffset);

  return visibleIndex === -1 ? 0 : visibleIndex;
}

function scrollToQuestion(questionIndex) {
  const card = document.querySelector(`#question-${questionIndex + 1}`);

  if (!card) {
    return;
  }

  card.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => card.focus({ preventScroll: true }), 250);
}

function setPendingPanelOpen(isOpen) {
  state.isPendingPanelOpen = isOpen;
  elements.examProgressDock.classList.toggle("is-open", isOpen);
  elements.pendingPanel.hidden = !isOpen;
  elements.pendingToggleButton.setAttribute("aria-expanded", String(isOpen));
  elements.pendingToggleIcon.textContent = isOpen ? "v" : "<";
}

function submitExam() {
  state.isSubmitted = true;
  const score = calculateScore();

  renderScore(score);
  renderQuestions();

  elements.submitButton.classList.add("is-hidden");
  elements.newTestButton.classList.remove("is-hidden");
  elements.scorePanel.classList.remove("is-hidden");
  elements.scorePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function calculateScore() {
  let correct = 0;
  let scorable = 0;
  let challenged = 0;
  let notScored = 0;
  let unanswered = 0;

  state.currentQuestions.forEach((question) => {
    const correctLetters = getCorrectLetters(question);
    const selectedAnswer = state.userAnswers.get(question.id);

    if (!selectedAnswer) {
      unanswered += 1;
    }

    if (question.challengedBy.length > 0) {
      challenged += 1;
    }

    if (correctLetters.length === 0) {
      notScored += 1;
      return;
    }

    scorable += 1;

    if (correctLetters.includes(selectedAnswer)) {
      correct += 1;
    }
  });

  const grade = scorable === 0 ? 0 : Math.round((correct / scorable) * 100);
  return { grade, correct, scorable, challenged, notScored, unanswered };
}

function renderScore(score) {
  elements.scorePanel.replaceChildren();

  const main = document.createElement("div");
  const grade = document.createElement("h2");
  grade.textContent = `${score.grade} / 100`;

  const summary = document.createElement("p");
  summary.textContent = `${score.correct} respuestas correctas de ${score.scorable} preguntas puntuables.`;

  main.append(grade, summary);

  const details = document.createElement("div");
  details.className = "score-details";
  details.append(createScoreChip(`${score.unanswered} sin responder`));
  details.append(createScoreChip(`${score.challenged} impugnables`));

  if (score.notScored > 0) {
    details.append(createScoreChip(`${score.notScored} sin puntuar`));
  }

  elements.scorePanel.append(main, details);
}

function createScoreChip(text) {
  const chip = document.createElement("span");
  chip.className = "score-chip";
  chip.textContent = text;
  return chip;
}

function getCorrectLetters(question) {
  return Object.keys(question.answers || {}).sort();
}

function shouldShowAnswerSources(question, optionKey, correctLetters) {
  const sources = question.answers[optionKey] || [];
  return sources.length > 0 || correctLetters.length > 1;
}

function formatSources(sources) {
  if (!sources || sources.length === 0) {
    return "sin detalle de fuente";
  }

  return sources.join(", ");
}

function returnToSetup() {
  elements.examView.classList.add("is-hidden");
  elements.setupView.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
