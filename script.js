/* ============================================================
   SketchSync — script.js
   Vanilla JS whiteboard app. Organized into clear modules:
     1. Theme module        - dark/light toggle + localStorage
   2. Toast module         - notification popups
   3. Navbar module        - mobile menu + scroll behavior
   4. Hero mini-canvas     - small decorative drawable demo
   5. Whiteboard state     - shared state for the main board
   6. History module       - undo / redo stack
   7. Drawing engine       - all canvas drawing math
   8. Toolbar UI           - tool/color/brush controls
   9. Pointer events       - mouse + touch input handling
   10. Stats module        - strokes / time / tool tracking
   11. Export module       - PNG / JPG download
   12. Keyboard shortcuts
   13. Init
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. THEME MODULE
     Handles dark/light toggle and remembers the choice.
     ============================================================ */
  const ThemeModule = (() => {
    const STORAGE_KEY = 'sketchsync-theme';
    const root = document.documentElement;
    const toggleBtn = document.getElementById('themeToggle');

    function getSavedTheme() {
      return localStorage.getItem(STORAGE_KEY);
    }

    function applyTheme(theme) {
      if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    }

    function saveTheme(theme) {
      localStorage.setItem(STORAGE_KEY, theme);
    }

    function toggle() {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
      ToastModule.show(`${next === 'dark' ? 'Dark' : 'Light'} mode on`, 'info');
    }

    function init() {
      // Respect saved preference, otherwise fall back to system preference
      const saved = getSavedTheme();
      if (saved) {
        applyTheme(saved);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
      }
      toggleBtn.addEventListener('click', toggle);
    }

    return { init };
  })();

  /* ============================================================
     2. TOAST MODULE
     Small floating notifications for user feedback.
     ============================================================ */
  const ToastModule = (() => {
    const container = document.getElementById('toastContainer');

    const ICONS = {
      success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"/></svg>',
      error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
    };

    function show(message, type = 'success', duration = 2200) {
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.innerHTML = `${ICONS[type] || ICONS.success}<span>${message}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('is-leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
      }, duration);
    }

    return { show };
  })();

  /* ============================================================
     3. NAVBAR MODULE
     Mobile hamburger menu + smooth link closing.
     ============================================================ */
  const NavbarModule = (() => {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    function toggleMenu() {
      navbar.classList.toggle('is-menu-open');
      hamburger.classList.toggle('is-open');
    }

    function closeMenu() {
      navbar.classList.remove('is-menu-open');
      hamburger.classList.remove('is-open');
    }

    function init() {
      hamburger.addEventListener('click', toggleMenu);
      navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMenu);
      });
    }

    return { init };
  })();

  /* ============================================================
     4. HERO MINI-CANVAS
     A small decorative canvas in the hero card that visitors
     can doodle on immediately — pure delight, no history needed.
     ============================================================ */
  const HeroCanvasModule = (() => {
    const canvas = document.getElementById('heroCanvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let last = { x: 0, y: 0 };

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const imageData = canvas.width > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Note: we intentionally don't restore imageData on resize since
      // the hero canvas is decorative and resets are acceptable.
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return {
        x: point.clientX - rect.left,
        y: point.clientY - rect.top
      };
    }

    function start(e) {
      drawing = true;
      last = getPos(e);
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.strokeStyle = '#FF5A36';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      last = pos;
    }

    function end() {
      drawing = false;
    }

    function init() {
      resize();
      window.addEventListener('resize', resize);
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: true });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
    }

    return { init };
  })();

  /* ============================================================
     5. WHITEBOARD STATE
     Single shared state object for the main drawing board.
     ============================================================ */
  const BoardState = {
    canvas: document.getElementById('drawCanvas'),
    ctx: null,
    tool: 'pen',
    color: '#1A1A1A',
    brushSize: 4,
    isDrawing: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    strokeCount: 0,
    drawStartTime: null,
    elapsedSeconds: 0,
    timerInterval: null
  };
  BoardState.ctx = BoardState.canvas.getContext('2d');

  /* ============================================================
     6. HISTORY MODULE
     Undo/redo implemented as a stack of full-canvas snapshots
     (ImageData). Simple, reliable, and easy to reason about
     for a whiteboard-scale canvas.
     ============================================================ */
  const HistoryModule = (() => {
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 40;

    function snapshot() {
      return BoardState.ctx.getImageData(0, 0, BoardState.canvas.width, BoardState.canvas.height);
    }

    function restore(imageData) {
      BoardState.ctx.putImageData(imageData, 0, 0);
    }

    // Call BEFORE a new stroke begins, so we can undo back to this point.
    function pushState() {
      undoStack.push(snapshot());
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack.length = 0; // any new action invalidates the redo stack
      UIModule.refreshHistoryButtons(undoStack.length, redoStack.length);
    }

    function undo() {
      if (undoStack.length === 0) {
        ToastModule.show('Nothing to undo', 'info');
        return;
      }
      redoStack.push(snapshot());
      const previous = undoStack.pop();
      restore(previous);
      StatsModule.decrementStroke();
      UIModule.refreshHistoryButtons(undoStack.length, redoStack.length);
    }

    function redo() {
      if (redoStack.length === 0) {
        ToastModule.show('Nothing to redo', 'info');
        return;
      }
      undoStack.push(snapshot());
      const next = redoStack.pop();
      restore(next);
      StatsModule.incrementStroke();
      UIModule.refreshHistoryButtons(undoStack.length, redoStack.length);
    }

    function clearHistory() {
      undoStack.length = 0;
      redoStack.length = 0;
      UIModule.refreshHistoryButtons(0, 0);
    }

    function canUndo() { return undoStack.length > 0; }
    function canRedo() { return redoStack.length > 0; }

    return { pushState, undo, redo, clearHistory, canUndo, canRedo };
  })();

  /* ============================================================
     7. DRAWING ENGINE
     All the actual canvas math: freehand paths, shapes, eraser.
     Shapes use a "redraw last snapshot + preview" technique so
     the in-progress shape can follow the cursor cleanly.
     ============================================================ */
  const DrawingEngine = (() => {
    let freehandPoints = [];
    let preDragSnapshot = null; // snapshot taken right when a shape drag starts

    function setupContextDefaults() {
      const ctx = BoardState.ctx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    function resizeCanvas() {
      const canvas = BoardState.canvas;
      const wrap = canvas.parentElement;
      const ratio = window.devicePixelRatio || 1;

      // Preserve existing artwork across a resize by copying pixels first.
      const prevW = canvas.width;
      const prevH = canvas.height;
      let prevImage = null;
      if (prevW > 0 && prevH > 0) {
        prevImage = BoardState.ctx.getImageData(0, 0, prevW, prevH);
      }

      const rect = wrap.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      BoardState.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      setupContextDefaults();

      // Fill with a transparent background (canvas defaults to transparent,
      // which is fine — the checkerboard/grid look comes from CSS).
      if (prevImage) {
        BoardState.ctx.putImageData(prevImage, 0, 0);
      }
    }

    function getPointerPos(e) {
      const canvas = BoardState.canvas;
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
      return {
        x: point.clientX - rect.left,
        y: point.clientY - rect.top
      };
    }

    /* ---- Freehand pen / eraser ---- */
    function startFreehand(pos) {
      freehandPoints = [pos];
      const ctx = BoardState.ctx;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function continueFreehand(pos) {
      freehandPoints.push(pos);
      const ctx = BoardState.ctx;

      if (BoardState.tool === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = BoardState.brushSize * 2.2; // eraser feels better a bit larger
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.restore();
        // Begin a fresh path segment so the next stroke() call doesn't
        // re-draw the whole accumulated path (keeps it smooth + cheap).
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      } else {
        ctx.strokeStyle = BoardState.color;
        ctx.lineWidth = BoardState.brushSize;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    }

    /* ---- Shape tools (line, rectangle, circle, arrow) ---- */
    function beginShapeDrag() {
      preDragSnapshot = BoardState.ctx.getImageData(0, 0, BoardState.canvas.width, BoardState.canvas.height);
    }

    function drawShapePreview(start, current) {
      const ctx = BoardState.ctx;
      // Restore the clean snapshot first, then draw the in-progress shape
      // on top, so dragging never leaves "ghost" outlines behind.
      ctx.putImageData(preDragSnapshot, 0, 0);
      ctx.save();
      ctx.strokeStyle = BoardState.color;
      ctx.fillStyle = BoardState.color;
      ctx.lineWidth = BoardState.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (BoardState.tool) {
        case 'line':
          drawLine(ctx, start, current);
          break;
        case 'rectangle':
          drawRectangle(ctx, start, current);
          break;
        case 'circle':
          drawCircle(ctx, start, current);
          break;
        case 'arrow':
          drawArrow(ctx, start, current);
          break;
        default:
          break;
      }
      ctx.restore();
    }

    function drawLine(ctx, start, end) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    function drawRectangle(ctx, start, end) {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();
    }

    function drawCircle(ctx, start, end) {
      const radius = Math.hypot(end.x - start.x, end.y - start.y);
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawArrow(ctx, start, end) {
      const headLength = Math.max(12, BoardState.brushSize * 3.2);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      // Shaft
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Arrowhead (two angled lines forming a "V" at the end point)
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 7),
        end.y - headLength * Math.sin(angle - Math.PI / 7)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 7),
        end.y - headLength * Math.sin(angle + Math.PI / 7)
      );
      ctx.stroke();
    }

    function clearCanvas() {
      BoardState.ctx.clearRect(0, 0, BoardState.canvas.width, BoardState.canvas.height);
    }

    return {
      resizeCanvas,
      getPointerPos,
      startFreehand,
      continueFreehand,
      beginShapeDrag,
      drawShapePreview,
      clearCanvas
    };
  })();

  /* ============================================================
     8. TOOLBAR UI MODULE
     Tool selection, color picking, brush size, tool indicator.
     ============================================================ */
  const UIModule = (() => {
    const toolButtons = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('colorPicker');
    const colorRing = document.querySelector('.color-swatch__ring');
    const paletteDots = document.querySelectorAll('.palette__dot');
    const brushSizeInput = document.getElementById('brushSize');
    const brushSizeLabel = document.getElementById('brushSizeLabel');
    const brushPreviewDot = document.getElementById('brushPreviewDot');
    const toolIndicatorLabel = document.getElementById('toolIndicatorLabel');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const fabUndo = document.getElementById('fabUndo');
    const fabRedo = document.getElementById('fabRedo');

    const TOOL_LABELS = {
      pen: 'Pen',
      eraser: 'Eraser',
      line: 'Line',
      rectangle: 'Rectangle',
      circle: 'Circle',
      arrow: 'Arrow'
    };

    function setTool(toolName) {
      BoardState.tool = toolName;
      toolButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.tool === toolName);
      });
      toolIndicatorLabel.textContent = TOOL_LABELS[toolName] || toolName;
      StatsModule.setCurrentTool(TOOL_LABELS[toolName] || toolName);
      updateBrushPreviewColor();
    }

    function setColor(hex) {
      BoardState.color = hex;
      colorRing.style.setProperty('--c', hex);
      colorPicker.value = hex;
      paletteDots.forEach((dot) => {
        dot.classList.toggle('is-active', dot.dataset.color.toLowerCase() === hex.toLowerCase());
      });
      updateBrushPreviewColor();
      StatsModule.setColor(hex);
    }

    function updateBrushPreviewColor() {
      brushPreviewDot.style.backgroundColor = BoardState.tool === 'eraser' ? '#C9C4B6' : BoardState.color;
    }

    function setBrushSize(size) {
      BoardState.brushSize = Number(size);
      brushSizeLabel.textContent = `${size}px`;
      const previewSize = Math.min(28, Math.max(4, Number(size)));
      brushPreviewDot.style.width = `${previewSize}px`;
      brushPreviewDot.style.height = `${previewSize}px`;
      StatsModule.setBrushSize(size);
    }

    function refreshHistoryButtons(undoCount, redoCount) {
      const noUndo = !HistoryModule.canUndo();
      const noRedo = !HistoryModule.canRedo();
      undoBtn.disabled = noUndo;
      redoBtn.disabled = noRedo;
      fabUndo.disabled = noUndo;
      fabRedo.disabled = noRedo;
    }

    function bindToolbar() {
      toolButtons.forEach((btn) => {
        btn.addEventListener('click', () => setTool(btn.dataset.tool));
      });

      colorPicker.addEventListener('input', (e) => setColor(e.target.value));

      paletteDots.forEach((dot) => {
        dot.addEventListener('click', () => setColor(dot.dataset.color));
      });

      brushSizeInput.addEventListener('input', (e) => setBrushSize(e.target.value));

      // Initialize displayed state to match BoardState defaults
      setTool(BoardState.tool);
      setColor(BoardState.color);
      setBrushSize(BoardState.brushSize);
    }

    return { setTool, setColor, setBrushSize, refreshHistoryButtons, bindToolbar, TOOL_LABELS };
  })();

  /* ============================================================
     9. POINTER EVENTS MODULE
     Unifies mouse + touch input into one drawing flow.
     ============================================================ */
  const PointerModule = (() => {
    const canvas = BoardState.canvas;

    function isShapeTool(tool) {
      return ['line', 'rectangle', 'circle', 'arrow'].includes(tool);
    }

    function handleStart(e) {
      e.preventDefault();
      const pos = DrawingEngine.getPointerPos(e);
      BoardState.isDrawing = true;
      BoardState.startPoint = pos;
      BoardState.currentPoint = pos;

      // Save a snapshot BEFORE this stroke so undo can return to this point.
      HistoryModule.pushState();
      StatsModule.startTimerIfNeeded();

      if (isShapeTool(BoardState.tool)) {
        DrawingEngine.beginShapeDrag();
      } else {
        DrawingEngine.startFreehand(pos);
      }
    }

    function handleMove(e) {
      if (!BoardState.isDrawing) return;
      e.preventDefault();
      const pos = DrawingEngine.getPointerPos(e);
      BoardState.currentPoint = pos;

      if (isShapeTool(BoardState.tool)) {
        DrawingEngine.drawShapePreview(BoardState.startPoint, pos);
      } else {
        DrawingEngine.continueFreehand(pos);
      }
    }

    function handleEnd(e) {
      if (!BoardState.isDrawing) return;
      BoardState.isDrawing = false;

      if (isShapeTool(BoardState.tool)) {
        // Commit the final shape at the release point.
        const pos = e && e.changedTouches ? DrawingEngine.getPointerPos(e) : BoardState.currentPoint;
        DrawingEngine.drawShapePreview(BoardState.startPoint, pos);
      }

      StatsModule.incrementStroke();
    }

    function bind() {
      // Mouse events
      canvas.addEventListener('mousedown', handleStart);
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);

      // Touch events (passive: false so preventDefault can stop scrolling)
      canvas.addEventListener('touchstart', handleStart, { passive: false });
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      canvas.addEventListener('touchend', handleEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleEnd, { passive: false });
    }

    return { bind };
  })();

  /* ============================================================
     10. STATS MODULE
     Tracks stroke count, active tool/color/brush, and elapsed
     drawing time, reflecting all of it into the stats bar.
     ============================================================ */
  const StatsModule = (() => {
    const statStrokes = document.getElementById('statStrokes');
    const statTool = document.getElementById('statTool');
    const statTime = document.getElementById('statTime');
    const statColorSwatch = document.getElementById('statColorSwatch');
    const statColorText = document.getElementById('statColorText');
    const statBrush = document.getElementById('statBrush');

    function incrementStroke() {
      BoardState.strokeCount += 1;
      statStrokes.textContent = BoardState.strokeCount;
    }

    function decrementStroke() {
      BoardState.strokeCount = Math.max(0, BoardState.strokeCount - 1);
      statStrokes.textContent = BoardState.strokeCount;
    }

    function resetStrokes() {
      BoardState.strokeCount = 0;
      statStrokes.textContent = '0';
    }

    function setCurrentTool(label) {
      statTool.textContent = label;
    }

    function setColor(hex) {
      statColorSwatch.style.backgroundColor = hex;
      statColorText.textContent = hex.toUpperCase();
    }

    function setBrushSize(size) {
      statBrush.textContent = `${size}px`;
    }

    function formatTime(totalSeconds) {
      const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
      const secs = (totalSeconds % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
    }

    function startTimerIfNeeded() {
      if (BoardState.timerInterval) return; // already running
      BoardState.timerInterval = setInterval(() => {
        BoardState.elapsedSeconds += 1;
        statTime.textContent = formatTime(BoardState.elapsedSeconds);
      }, 1000);
    }

    function resetTimer() {
      clearInterval(BoardState.timerInterval);
      BoardState.timerInterval = null;
      BoardState.elapsedSeconds = 0;
      statTime.textContent = '00:00';
    }

    return {
      incrementStroke,
      decrementStroke,
      resetStrokes,
      setCurrentTool,
      setColor,
      setBrushSize,
      startTimerIfNeeded,
      resetTimer
    };
  })();

  /* ============================================================
     11. EXPORT MODULE
     Downloads the current canvas as PNG or JPG. JPG export
     flattens onto a white background first since canvas
     transparency doesn't translate to JPG.
     ============================================================ */
  const ExportModule = (() => {
    function download(format) {
      const sourceCanvas = BoardState.canvas;
      let dataUrl;
      let filename;

      if (format === 'jpg') {
        // Flatten transparent areas to white for JPG (no alpha channel).
        const flatCanvas = document.createElement('canvas');
        flatCanvas.width = sourceCanvas.width;
        flatCanvas.height = sourceCanvas.height;
        const flatCtx = flatCanvas.getContext('2d');
        flatCtx.fillStyle = '#FFFFFF';
        flatCtx.fillRect(0, 0, flatCanvas.width, flatCanvas.height);
        flatCtx.drawImage(sourceCanvas, 0, 0);
        dataUrl = flatCanvas.toDataURL('image/jpeg', 0.92);
        filename = 'sketchsync-board.jpg';
      } else {
        dataUrl = sourceCanvas.toDataURL('image/png');
        filename = 'sketchsync-board.png';
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastModule.show(`Downloaded as ${format.toUpperCase()}`, 'success');
    }

    return { download };
  })();

  /* ============================================================
     12. WHITEBOARD CONTROLS BINDING
     Wires up undo/redo/clear/download buttons + FABs + dropdown.
     ============================================================ */
  const ControlsModule = (() => {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const fabUndo = document.getElementById('fabUndo');
    const fabRedo = document.getElementById('fabRedo');
    const fabDownload = document.getElementById('fabDownload');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadMenu = document.getElementById('downloadMenu');
    const downloadItems = document.querySelectorAll('.dropdown__item');

    function clearBoard() {
      HistoryModule.pushState();
      DrawingEngine.clearCanvas();
      StatsModule.resetStrokes();
      ToastModule.show('Canvas cleared', 'info');
    }

    function toggleDownloadMenu() {
      downloadMenu.classList.toggle('is-open');
    }

    function closeDownloadMenu(e) {
      if (!downloadBtn.contains(e.target) && !downloadMenu.contains(e.target)) {
        downloadMenu.classList.remove('is-open');
      }
    }

    function bind() {
      undoBtn.addEventListener('click', HistoryModule.undo);
      redoBtn.addEventListener('click', HistoryModule.redo);
      fabUndo.addEventListener('click', HistoryModule.undo);
      fabRedo.addEventListener('click', HistoryModule.redo);
      clearBtn.addEventListener('click', clearBoard);

      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDownloadMenu();
      });
      fabDownload.addEventListener('click', () => ExportModule.download('png'));
      downloadItems.forEach((item) => {
        item.addEventListener('click', () => {
          ExportModule.download(item.dataset.format);
          downloadMenu.classList.remove('is-open');
        });
      });
      document.addEventListener('click', closeDownloadMenu);
    }

    return { bind, clearBoard };
  })();

  /* ============================================================
     13. KEYBOARD SHORTCUTS MODULE
     ============================================================ */
  const KeyboardModule = (() => {
    const TOOL_KEYS = {
      p: 'pen',
      e: 'eraser',
      l: 'line',
      r: 'rectangle',
      c: 'circle',
      a: 'arrow'
    };

    function isTypingTarget(target) {
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || target.isContentEditable;
    }

    function handleKeydown(e) {
      if (isTypingTarget(e.target)) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        HistoryModule.undo();
        return;
      }
      if (isCtrlOrCmd && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        HistoryModule.redo();
        return;
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        ExportModule.download('png');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only treat Backspace as "clear" if it's not inside a text field
        // (already filtered above) — safe to trigger clear here.
        if (e.key === 'Delete') {
          e.preventDefault();
          ControlsModule.clearBoard();
          return;
        }
      }

      const key = e.key.toLowerCase();
      if (TOOL_KEYS[key]) {
        UIModule.setTool(TOOL_KEYS[key]);
      }
    }

    function bind() {
      window.addEventListener('keydown', handleKeydown);
    }

    return { bind };
  })();

  /* ============================================================
     14. SCROLL REVEAL (subtle entrance animation for cards)
     ============================================================ */
  const ScrollRevealModule = (() => {
    function init() {
      const targets = document.querySelectorAll('.feature-card, .about__inner, .board-shell');
      if (!('IntersectionObserver' in window)) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      targets.forEach((el) => observer.observe(el));
    }
    return { init };
  })();

  /* ============================================================
     15. INIT
     Boots every module once the DOM is ready.
     ============================================================ */
  function init() {
    ThemeModule.init();
    NavbarModule.init();
    HeroCanvasModule.init();

    DrawingEngine.resizeCanvas();
    UIModule.bindToolbar();
    UIModule.refreshHistoryButtons();
    PointerModule.bind();
    ControlsModule.bind();
    KeyboardModule.bind();
    ScrollRevealModule.init();

    // Keep the main canvas crisp and correctly sized on resize,
    // including orientation changes on tablets/phones.
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(DrawingEngine.resizeCanvas, 150);
    });

    ToastModule.show('Welcome to SketchSync — start sketching!', 'success');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
