import { JSDOM } from 'jsdom';
import fs from 'fs';
import vm from 'vm';

const REPO = '../roconn-pse-experiment-main';

export async function runSession(query, opts = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>t</title></head><body></body></html>`, {
    url: 'http://localhost:8000/' + query,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const w = dom.window;

  // ---- browser shims jsdom lacks ----
  w.HTMLElement.prototype.requestFullscreen = function () { return Promise.resolve(); };
  w.Document.prototype.exitFullscreen = function () { return Promise.resolve(); };
  Object.defineProperty(w.document, 'fullscreenElement', { get: () => null, configurable: true });
  w.URL.createObjectURL = () => 'blob:stub';
  w.URL.revokeObjectURL = () => {};
  if (!w.performance) w.performance = { now: () => Date.now() };
  const downloads = [];
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'a') {
      el.click = function () { downloads.push(el.download); };
    }
    return el;
  };

  // ---- load jsPsych + plugins as globals (mirrors the CDN <script> tags) ----
  const files = [
    'node_modules/jspsych/dist/index.browser.js',
    'node_modules/@jspsych/plugin-html-keyboard-response/dist/index.browser.js',
    'node_modules/@jspsych/plugin-html-button-response/dist/index.browser.js',
    'node_modules/@jspsych/plugin-survey-text/dist/index.browser.js',
    'node_modules/@jspsych/plugin-survey-likert/dist/index.browser.js',
    'node_modules/@jspsych/plugin-survey-multi-choice/dist/index.browser.js',
    'node_modules/@jspsych/plugin-preload/dist/index.browser.js',
    'node_modules/@jspsych/plugin-call-function/dist/index.browser.js',
    'node_modules/@jspsych/plugin-fullscreen/dist/index.browser.js',
  ];
  const ctx = vm.createContext(w);
  for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  // jsPsych umd exports jsPsychModule; index.html relies on globals initJsPsych etc.
  vm.runInContext(`
    if (typeof initJsPsych === 'undefined' && typeof jsPsychModule !== 'undefined') {
      window.initJsPsych = jsPsychModule.initJsPsych;
      window.JsPsych = jsPsychModule.JsPsych;
    }`, ctx);

  const warnings = [], errors = [];
  w.console.warn = (...a) => warnings.push(a.join(' '));
  w.console.error = (...a) => errors.push(a.join(' '));
  w.onerror = (e) => errors.push('window.onerror: ' + e);

  // ---- load the experiment sources in index.html order ----
  const src = ['js/config.js','js/panels.js','js/tasks.js','js/phases.js','js/experiment.js'];
  let loadError = null;
  try {
    for (const f of src) vm.runInContext(fs.readFileSync(`${REPO}/${f}`, 'utf8'), ctx, { filename: f });
  } catch (e) { loadError = e; }
  return { dom, w, ctx, downloads, warnings, errors, loadError };
}
