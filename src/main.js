// Entry point: builds the control panel, wires DOM events, and runs the render loop.

import { state, controlSpecs, presets } from './state.js';
import { $, video } from './dom.js';
import { toast } from './util.js';
import { processFrame, resetTemporalState, rebuildGlyphBank } from './engine.js';
import {
  buildControls, buildPresetCards, syncSimpleControl, setSettings,
  updatePresetSelection, saveCurrentPreset, autoTune, handleFile, updateTransport, updateSizeReadout,
  exportPresets, importPresets
} from './ui.js';
import { exportPng, exportText, exportHtml } from './export.js';
import { exportVideo, isExportSupported } from './encoder.js';

function loop(now) {
  const minDelay = 1000 / state.settings.renderFps;
  if (now - state.lastFrameTime >= minDelay) {
    processFrame();
    state.lastFrameTime = now;
  }
  updateTransport();
  state.animationId = requestAnimationFrame(loop);
}

buildControls('sizeControls', controlSpecs.size);
buildControls('mappingControls', controlSpecs.mapping);
buildControls('imageControls', controlSpecs.image);
buildControls('motionControls', controlSpecs.motion);
buildPresetCards();
['glyphSet', 'customGlyphs', 'fontFamily', 'directionalEdges', 'invert', 'colorMode', 'backgroundColor', 'monoColor', 'resetOnSeek'].forEach((id) => syncSimpleControl(id, (v) => v));
rebuildGlyphBank();

$('loadButton').addEventListener('click', () => $('fileInput').click());
$('dropLoadButton').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (event) => handleFile(event.target.files[0]));

// Drag-and-drop a video anywhere over the stage — in the empty state or with a
// clip already loaded — to load/replace it. A depth counter keeps the overlay
// stable while the cursor moves between child elements (canvas, video, panes).
const stage = $('stageCard');
const overlay = $('dragOverlay');
let dragDepth = 0;
const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
stage.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault(); dragDepth++; overlay.classList.remove('is-hidden');
});
stage.addEventListener('dragover', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
});
stage.addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) overlay.classList.add('is-hidden');
});
stage.addEventListener('drop', (event) => {
  event.preventDefault(); dragDepth = 0; overlay.classList.add('is-hidden');
  const file = event.dataTransfer.files[0];
  if (file) handleFile(file);
});

$('playPause').addEventListener('click', () => video.paused ? video.play() : video.pause());
$('restartButton').addEventListener('click', () => { video.currentTime = 0; resetTemporalState(); });

// Loop defaults on; mute defaults off. Both toggle the source video element.
video.loop = true;
$('loopButton').addEventListener('click', () => {
  video.loop = !video.loop;
  $('loopButton').classList.toggle('active', video.loop);
  $('loopButton').setAttribute('aria-pressed', String(video.loop));
});
$('muteButton').addEventListener('click', () => {
  video.muted = !video.muted;
  $('muteButton').textContent = video.muted ? '🔇' : '🔊';
  $('muteButton').classList.toggle('active', video.muted);
  $('muteButton').setAttribute('aria-pressed', String(video.muted));
});
$('timeline').addEventListener('input', (event) => {
  if (!Number.isFinite(video.duration)) return;
  video.currentTime = (Number(event.target.value) / 1000) * video.duration;
});
// The export loop drives its own seeking/rendering, so skip the live handler then.
video.addEventListener('seeked', () => { if (state.exporting) return; if (state.settings.resetOnSeek) resetTemporalState(); processFrame(); });
video.addEventListener('loadedmetadata', () => { updateTransport(); updateSizeReadout(); processFrame(); });
$('showOriginal').addEventListener('change', (event) => $('visualGrid').classList.toggle('original-hidden', !event.target.checked));

$('pngButton').addEventListener('click', exportPng);
$('txtButton').addEventListener('click', exportText);
$('htmlButton').addEventListener('click', exportHtml);
$('mp4Button').addEventListener('click', () => runExport('mp4', 'MP4'));
$('webmButton').addEventListener('click', () => runExport('webm', 'WebM'));
$('resetButton').addEventListener('click', () => { state.activePreset = 'default'; setSettings(presets.default.values); updatePresetSelection(); toast('Controls reset.'); });
$('autoTuneButton').addEventListener('click', autoTune);
$('savePresetButton').addEventListener('click', saveCurrentPreset);
$('exportPresetsButton').addEventListener('click', exportPresets);
$('importPresetsButton').addEventListener('click', () => $('importPresetsInput').click());
$('importPresetsInput').addEventListener('change', (event) => { importPresets(event.target.files[0]); event.target.value = ''; });

// Clip export: while running, the clicked button becomes Cancel and the other is
// disabled; progress shows in the status line.
function runExport(format, label) {
  if (state.exporting) { state.exportCancel = true; return; }
  const btn = $(format === 'mp4' ? 'mp4Button' : 'webmButton');
  const other = $(format === 'mp4' ? 'webmButton' : 'mp4Button');
  const original = btn.textContent;
  btn.textContent = 'Cancel';
  other.disabled = true;
  exportVideo(format, (pct) => { $('recordStatus').textContent = `${label} ${Math.round(pct * 100)}%`; })
    .finally(() => { btn.textContent = original; other.disabled = false; $('recordStatus').textContent = ''; });
}

if (!isExportSupported()) {
  const note = 'Video export requires a browser with WebCodecs (Chrome, Edge, Firefox, or Safari 17+).';
  ['mp4Button', 'webmButton'].forEach((id) => { $(id).disabled = true; $(id).title = note; });
  $('recordStatus').textContent = 'Video export needs WebCodecs';
}

window.addEventListener('keydown', (event) => {
  if (event.target.matches('input,select')) return;
  if (event.code === 'Space') { event.preventDefault(); video.paused ? video.play() : video.pause(); }
  if (event.key.toLowerCase() === 'r') { video.currentTime = 0; resetTemporalState(); }
});

setSettings(presets.default.values);
state.animationId = requestAnimationFrame(loop);
