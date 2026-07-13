// Entry point: builds the control panel, wires DOM events, and runs the render loop.

import { state, controlSpecs, presets } from './state.js';
import { $, video } from './dom.js';
import { toast } from './util.js';
import { processFrame, resetTemporalState, rebuildGlyphBank } from './engine.js';
import {
  buildControls, buildPresetCards, syncSimpleControl, setSettings,
  updatePresetSelection, saveCurrentPreset, autoTune, handleFile, updateTransport
} from './ui.js';
import { exportPng, exportText, exportHtml, toggleRecording } from './export.js';

function loop(now) {
  const minDelay = 1000 / state.settings.renderFps;
  if (now - state.lastFrameTime >= minDelay) {
    processFrame();
    state.lastFrameTime = now;
  }
  updateTransport();
  state.animationId = requestAnimationFrame(loop);
}

buildControls('mappingControls', controlSpecs.mapping);
buildControls('imageControls', controlSpecs.image);
buildControls('motionControls', controlSpecs.motion);
buildPresetCards();
['glyphSet', 'customGlyphs', 'fontFamily', 'directionalEdges', 'invert', 'colorMode', 'backgroundColor', 'monoColor', 'resetOnSeek'].forEach((id) => syncSimpleControl(id, (v) => v));
rebuildGlyphBank();

$('loadButton').addEventListener('click', () => $('fileInput').click());
$('dropLoadButton').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (event) => handleFile(event.target.files[0]));
$('dropZone').addEventListener('dragover', (event) => { event.preventDefault(); $('dropZone').classList.add('dragging'); });
$('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('dragging'));
$('dropZone').addEventListener('drop', (event) => { event.preventDefault(); $('dropZone').classList.remove('dragging'); handleFile(event.dataTransfer.files[0]); });

$('playPause').addEventListener('click', () => video.paused ? video.play() : video.pause());
$('restartButton').addEventListener('click', () => { video.currentTime = 0; resetTemporalState(); });
$('timeline').addEventListener('input', (event) => {
  if (!Number.isFinite(video.duration)) return;
  video.currentTime = (Number(event.target.value) / 1000) * video.duration;
});
video.addEventListener('seeked', () => { if (state.settings.resetOnSeek) resetTemporalState(); processFrame(); });
video.addEventListener('loadedmetadata', () => { updateTransport(); processFrame(); });
video.addEventListener('ended', () => { if (state.recorder?.state === 'recording') state.recorder.stop(); });
$('showOriginal').addEventListener('change', (event) => $('visualGrid').classList.toggle('original-hidden', !event.target.checked));

$('pngButton').addEventListener('click', exportPng);
$('txtButton').addEventListener('click', exportText);
$('htmlButton').addEventListener('click', exportHtml);
$('recordButton').addEventListener('click', toggleRecording);
$('resetButton').addEventListener('click', () => { state.activePreset = 'crisp'; setSettings(presets.crisp.values); updatePresetSelection(); toast('Controls reset.'); });
$('autoTuneButton').addEventListener('click', autoTune);
$('savePresetButton').addEventListener('click', saveCurrentPreset);

window.addEventListener('keydown', (event) => {
  if (event.target.matches('input,select')) return;
  if (event.code === 'Space') { event.preventDefault(); video.paused ? video.play() : video.pause(); }
  if (event.key.toLowerCase() === 'r') { video.currentTime = 0; resetTemporalState(); }
});

setSettings(presets.crisp.values);
state.animationId = requestAnimationFrame(loop);
