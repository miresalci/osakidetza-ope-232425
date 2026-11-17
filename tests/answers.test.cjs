const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const questions = fs.readFileSync(path.join(root, "qa/temarios_merged.jsonl"), "utf8")
  .trim().split(/\r?\n/).map((line) => JSON.parse(line));

function createExam() {
  const checkedInputs = [];
  const context = vm.createContext({
    document: {
      addEventListener() {},
      querySelector: () => ({
        classList: { add() {}, remove() {}, toggle() {} },
        style: {},
        setAttribute() {},
        scrollIntoView() {},
        querySelectorAll: () => checkedInputs,
      }),
    },
  });
  vm.runInContext(source, context);
  // Keep the real answer handling, scoring and progress; omit DOM rendering.
  vm.runInContext(`
    renderQuestions = () => {};
    renderScore = (score) => { globalThis.lastScore = score; };
    renderPendingQuestions = () => {};
    globalThis.exam = {
      state, elements, normalizeQuestion, submitExam, handlePageShow,
      handleAnswerChange, getReviewStatus,
    };
  `, context);
  const exam = context.exam;
  exam.state.currentQuestions = questions.filter((q) => q.tipo_temario === "rt")
    .map(exam.normalizeQuestion);
  return { ...exam, checkedInputs, context };
}

test("correction uses visible RT answers when the recorded answers are stale", () => {
  const exam = createExam();
  for (const number of [47, 48, 69, 71, 86]) {
    const question = exam.state.currentQuestions.find((q) => q.number === number);
    const correct = Object.keys(question.answers)[0];
    const wrong = Object.keys(question.options).find((key) => !(key in question.answers));
    exam.state.userAnswers.set(question.id, wrong);
    exam.checkedInputs.push({ name: question.id, value: correct });
  }

  exam.submitExam();

  assert.equal(exam.context.lastScore.correct, 5);
  for (const input of exam.checkedInputs) {
    const question = exam.state.currentQuestions.find((q) => q.id === input.name);
    assert.equal(exam.state.userAnswers.get(input.name), input.value);
    assert.equal(exam.getReviewStatus(question), "correct");
  }
  assert.equal(exam.elements.answeredCount.textContent, "5 / 300 respondidas");
  assert.equal(exam.elements.compactAnsweredCount.textContent, "5 / 300 respondidas");
});

test("correction captures eventless selections and removes answers no longer checked", () => {
  const exam = createExam();
  exam.state.userAnswers.set("rt-47", "A");
  exam.state.userAnswers.set("comun-47", "A");
  exam.checkedInputs.push({ name: "rt-48", value: "D" });

  exam.submitExam();

  assert.deepEqual(Object.fromEntries(exam.state.userAnswers), { "rt-48": "D" });
  assert.equal(exam.context.lastScore.correct, 1);
  assert.equal(exam.context.lastScore.unanswered, 299);
});

test("a visible wrong answer overrides a previously recorded correct answer", () => {
  const exam = createExam();
  exam.state.userAnswers.set("rt-47", "A");
  exam.checkedInputs.push({ name: "rt-47", value: "B" });

  exam.submitExam();

  const question = exam.state.currentQuestions.find((q) => q.id === "rt-47");
  assert.equal(exam.context.lastScore.correct, 0);
  assert.equal(exam.getReviewStatus(question), "incorrect");
  assert.equal(exam.state.userAnswers.get("rt-47"), "B");
});

test("all accepted answers and unscored questions retain their scoring rules", () => {
  for (const answer of ["A", "D"]) {
    const exam = createExam();
    const unscored = exam.normalizeQuestion({
      tipo_temario: "rt", num_pregunta: 301,
      respuestas_posibles: { A: "Sin respuesta aceptada" }, respuestas: {},
    });
    exam.state.currentQuestions.push(unscored);
    exam.checkedInputs.push({ name: "rt-71", value: answer });
    exam.checkedInputs.push({ name: unscored.id, value: Object.keys(unscored.options)[0] });

    exam.submitExam();

    assert.equal(exam.context.lastScore.correct, 1);
    assert.equal(exam.getReviewStatus(unscored), "unscored");
  }
});

test("pageshow reconciles progress with restored selections", () => {
  const exam = createExam();
  exam.state.userAnswers.set("rt-47", "B");
  exam.state.userAnswers.set("rt-48", "D");
  exam.checkedInputs.push({ name: "rt-47", value: "A" });

  exam.handlePageShow();

  assert.deepEqual(Object.fromEntries(exam.state.userAnswers), { "rt-47": "A" });
  assert.equal(exam.elements.answeredCount.textContent, "1 / 300 respondidas");
  assert.equal(exam.state.isSubmitted, false);
});

test("restoring or submitting an already corrected test preserves its result", () => {
  const exam = createExam();
  exam.checkedInputs.push({ name: "rt-47", value: "A" });
  exam.submitExam();
  const score = exam.context.lastScore;
  exam.checkedInputs[0].value = "B";

  exam.handlePageShow();
  exam.submitExam();

  assert.equal(exam.state.userAnswers.get("rt-47"), "A");
  assert.equal(exam.context.lastScore, score);
});

test("input and change events record an answer once and cannot alter a corrected test", () => {
  const exam = createExam();
  const target = { name: "rt-47", value: "A", matches: () => true };
  exam.handleAnswerChange({ target });
  exam.handleAnswerChange({ target });
  assert.equal(exam.state.userAnswers.size, 1);
  assert.equal(exam.elements.answeredCount.textContent, "1 / 300 respondidas");

  exam.state.isSubmitted = true;
  target.value = "B";
  exam.handleAnswerChange({ target });
  assert.equal(exam.state.userAnswers.get("rt-47"), "A");
});

test("an empty exam cannot be submitted", () => {
  const exam = createExam();
  exam.state.currentQuestions = [];
  exam.submitExam();
  assert.equal(exam.state.isSubmitted, false);
  assert.equal(exam.context.lastScore, undefined);
});
