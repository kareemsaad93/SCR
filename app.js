    const $ = (id) => document.getElementById(id);

    // ---- Shared scaling so Plan & Elevation align & look slightly larger ----
    const SYNC = {
      scale: 1,      // Scale
      pad: 40,       // consistent outer padding for both views
      fontPx: 12,    // baseline on-screen font size for labels
      opR: 120,      // operator circle radius (mm) in plan
      roomW: null,   // will be set by the Plan compute() and read by Elevation
    };

    // ---------- Section 1 ----------
    const DOM = {
      total: $('total_cams'),
      critical: $('critical_cams'),
      cpm: $('cycles_per_min'),
      RotOut: $('rotating_out'),
      cycledOut: $('cycled_per_scene_out'),
    };

    const U = {
      parseIntSafe(el) { const n = Math.trunc(Number(el?.value)); return Number.isFinite(n) ? n : null; },
      fmtInt(n) { return Number.isFinite(n) ? String(n) : '—'; },
    };

    const MOD = {
      compute() {
        let total = U.parseIntSafe(DOM.total);
        let critical = U.parseIntSafe(DOM.critical);
        let cpm = U.parseIntSafe(DOM.cpm);
        if (total === null || critical === null || cpm === null || total < 0 || critical < 0 || cpm < 1) {
          DOM.RotOut.textContent = '—'; DOM.cycledOut.textContent = '—'; return;
        }
        if (critical > total) critical = total;
        const regular = total - critical;
        const cycledPerScene = Math.ceil(regular / cpm);
        DOM.RotOut.textContent = U.fmtInt(regular);
        DOM.cycledOut.textContent = U.fmtInt(cycledPerScene);
        window.dispatchEvent(new CustomEvent('cameraCycling:update', { detail: { total, critical, regular, cpm, cycledPerScene } }));
      },
      init() {
        ['input', 'change'].forEach(ev => [DOM.total, DOM.critical, DOM.cpm].forEach(el => el?.addEventListener(ev, () => this.compute())));
        this.compute();
      }
    };

    // ---------- Section 2 ----------
    const DDOM = {
      type: $('disp_type'),
      diagIn: $('diag_in'),
      widthMM: $('disp_width_mm'),
      heightMM: $('disp_height_mm'),
      screenSizeBox: $('screen_size_mm_box'),
      resW: $('res_w'),
      resH: $('res_h'),
      ppMM: $('pixel_pitch_mm'),
      cols: $('cols_per_display'),
      rows: $('rows_per_display'),
      feedBox: $('feed_wh_mm_box'),
      wallCols: $('wall_cols'),
      wallRows: $('wall_rows'),
      wallBoxMM: $('wall_total_mm_box'),
      totalFeeds: $('total_feeds'),
      fixedSpots: $('fixed_spots_out'),
      rotatingSpots: $('rotating_spots_out'),
      freeSpots: $('free_spots_out'),
      freeRatio: $('free_ratio_out'),
      viz: $('wall_viz'),
    };

    const DISP = {
      _state: {
        type: 'LCD', diagIn: null, widthMM: null, heightMM: null,
        resW: null, resH: null, cols: null, rows: null,
        feedWmm: null, feedHmm: null,
        wallCols: null, wallRows: null,
        wallTotalWMM: null,
        wallTotalHMM: null,
        totalFeeds: null,
        fixedCams: null, rotatingNeeded: null,
      },
      _syncing: false, _syncingGrid: false,

      _fmtMM(x, dec = 1) { return Number.isFinite(x) ? x.toFixed(dec) : '—'; },
      _fmtInt(x) { return Number.isFinite(x) ? String(x) : '—'; },
      _fmtPct(x, dec = 0) { return Number.isFinite(x) ? `${(x * 100).toFixed(dec)}%` : '—'; },
      _parseInt1(v) { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= 1 ? n : null; },

      _computeFeedSize() {
        const { widthMM, heightMM, cols, rows } = this._state;
        const fw = (Number.isFinite(widthMM) && Number.isFinite(cols) && cols > 0) ? (widthMM / cols) : null;
        const fh = (Number.isFinite(heightMM) && Number.isFinite(rows) && rows > 0) ? (heightMM / rows) : null;
        this._state.feedWmm = fw; this._state.feedHmm = fh;
        if (DDOM.feedBox) {
          DDOM.feedBox.textContent = (Number.isFinite(fw) && Number.isFinite(fh))
            ? `${this._fmtMM(fw)} mm × ${this._fmtMM(fh)} mm` : '—';
        }
      },

      _computeTotalFeedsGrid() {
        const { cols, rows, wallCols, wallRows } = this._state;
        const tfc = (Number.isFinite(cols) && Number.isFinite(wallCols) && cols > 0 && wallCols > 0) ? cols * wallCols : null;
        const tfr = (Number.isFinite(rows) && Number.isFinite(wallRows) && rows > 0 && wallRows > 0) ? rows * wallRows : null;
        const tf = (Number.isFinite(tfc) && Number.isFinite(tfr)) ? tfc * tfr : null;
        this._state.totalFeeds = tf;
        if (DDOM.totalFeeds) DDOM.totalFeeds.textContent = this._fmtInt(tf);
      },

      _setWall(nCols, nRows) {
        const c = this._parseInt1(nCols), r = this._parseInt1(nRows);
        this._state.wallCols = c; this._state.wallRows = r;
        if (DDOM.wallCols) DDOM.wallCols.value = c != null ? String(c) : '';
        if (DDOM.wallRows) DDOM.wallRows.value = r != null ? String(r) : '';
        this._computeWallTotals(); this._computeTotalFeedsGrid(); this.emit();
      },

      _computeWallTotals() {
        const { widthMM, heightMM, wallCols, wallRows } = this._state;
        const w = (Number.isFinite(widthMM) && Number.isFinite(wallCols) && wallCols > 0) ? widthMM * wallCols : null;
        const h = (Number.isFinite(heightMM) && Number.isFinite(wallRows) && wallRows > 0) ? heightMM * wallRows : null;

        this._state.wallTotalWMM = Number.isFinite(w) ? w : null;
        this._state.wallTotalHMM = Number.isFinite(h) ? h : null;

        if (DDOM.wallBoxMM) {
          DDOM.wallBoxMM.textContent = (Number.isFinite(w) && Number.isFinite(h))
            ? `${Math.round(w)} mm × ${Math.round(h)} mm` : '—';
        }
      },

      computePhysical() {
        const d = Number(DDOM.diagIn?.value);
        if (Number.isFinite(d) && d > 0) {
          const width = d * 22.14, height = d * 12.47; // 16:9 mm/inch
          if (DDOM.widthMM) DDOM.widthMM.textContent = Math.round(width);
          if (DDOM.heightMM) DDOM.heightMM.textContent = Math.round(height);
          if (DDOM.screenSizeBox) DDOM.screenSizeBox.textContent = `${Math.round(width)} mm × ${Math.round(height)} mm`;
          this._state.widthMM = width; this._state.heightMM = height; this._state.diagIn = d;
        } else {
          if (DDOM.widthMM) DDOM.widthMM.textContent = '—';
          if (DDOM.heightMM) DDOM.heightMM.textContent = '—';
          if (DDOM.screenSizeBox) DDOM.screenSizeBox.textContent = '—';
          this._state.widthMM = this._state.heightMM = this._state.diagIn = null;
        }
        this.computePixelPitch(); this._computeFeedSize(); this._computeWallTotals(); this._computeTotalFeedsGrid(); this.emit();
      },

      computePixelPitch() {
        const { widthMM, heightMM, resW, resH } = this._state;
        let fromW = null, fromH = null, shown = null;
        if (Number.isFinite(widthMM) && Number.isFinite(resW) && resW > 0) fromW = widthMM / resW;
        if (Number.isFinite(heightMM) && Number.isFinite(resH) && resH > 0) fromH = heightMM / resH;
        shown = (fromW != null && fromH != null) ? (fromW + fromH) / 2 : (fromW ?? fromH);
        if (DDOM.ppMM) DDOM.ppMM.textContent = Number.isFinite(shown) ? shown.toFixed(3) : '—';
      },

      updateFromWidth() {
        if (this._syncing) return; this._syncing = true;
        const w = Number(DDOM.resW?.value);
        if (Number.isFinite(w) && w > 0) { const h = Math.round(w * 9 / 16); DDOM.resH.value = String(h); this._state.resW = w; this._state.resH = h; }
        else { DDOM.resH.value = ''; this._state.resW = this._state.resH = null; }
        this.computePixelPitch(); this.emit(); this._syncing = false;
      },

      updateFromHeight() {
        if (this._syncing) return; this._syncing = true;
        const h = Number(DDOM.resH?.value);
        if (Number.isFinite(h) && h > 0) { const w = Math.round(h * 16 / 9); DDOM.resW.value = String(w); this._state.resW = w; this._state.resH = h; }
        else { DDOM.resW.value = ''; this._state.resW = this._state.resH = null; }
        this.computePixelPitch(); this.emit(); this._syncing = false;
      },

      _setGrid(n) {
        this._syncingGrid = true;
        const v = this._parseInt1(n);
        this._state.cols = v; this._state.rows = v;
        if (DDOM.cols) DDOM.cols.value = v != null ? String(v) : '';
        if (DDOM.rows) DDOM.rows.value = v != null ? String(v) : '';
        this._computeFeedSize(); this._computeTotalFeedsGrid();
        this._syncingGrid = false; this.emit();
      },
      updateCols() { if (!this._syncingGrid) this._setGrid(DDOM.cols?.value); },
      updateRows() { if (!this._syncingGrid) this._setGrid(DDOM.rows?.value); },

      syncType() { this._state.type = DDOM.type?.value || 'LCD'; },

      _seedCameraStateFromInputs() {
        const total = Math.trunc(Number(document.getElementById('total_cams')?.value));
        const critical = Math.trunc(Number(document.getElementById('critical_cams')?.value));
        const cpm = Math.trunc(Number(document.getElementById('cycles_per_min')?.value));
        if (Number.isFinite(total) && Number.isFinite(critical) && Number.isFinite(cpm) && cpm > 0 && total >= 0 && critical >= 0) {
          const regular = Math.max(0, total - critical);
          const cycledPerScene = Math.ceil(regular / cpm);
          this._state.fixedCams = critical; this._state.rotatingNeeded = cycledPerScene;
        }
      },

      emit() { window.dispatchEvent(new CustomEvent('display:update', { detail: { ...this._state } })); },

      init() {
        ['input', 'change'].forEach(ev => [DDOM.type, DDOM.diagIn].forEach(el => el?.addEventListener(ev, () => { this.syncType(); this.computePhysical(); })));
        ['input', 'change'].forEach(ev => DDOM.resW?.addEventListener(ev, () => this.updateFromWidth()));
        ['input', 'change'].forEach(ev => DDOM.resH?.addEventListener(ev, () => this.updateFromHeight()));
        ['input', 'change'].forEach(ev => DDOM.cols?.addEventListener(ev, () => this.updateCols()));
        ['input', 'change'].forEach(ev => DDOM.rows?.addEventListener(ev, () => this.updateRows()));
        ['input', 'change'].forEach(ev => DDOM.wallCols?.addEventListener(ev, () => { this._setWall(DDOM.wallCols.value, DDOM.wallRows?.value ?? 1); }));
        ['input', 'change'].forEach(ev => DDOM.wallRows?.addEventListener(ev, () => { this._setWall(DDOM.wallCols?.value ?? 1, DDOM.wallRows.value); }));

        window.addEventListener('cameraCycling:update', (e) => {
          const d = e?.detail || {};
          this._state.fixedCams = Number.isFinite(d.critical) ? d.critical : null;
          this._state.rotatingNeeded = Number.isFinite(d.cycledPerScene) ? d.cycledPerScene : null;
          this.emit();
        });

        window.addEventListener('feeds:assignments', (e) => {
          const d = e?.detail || {};
          const total = Number(d.total) || 0, crit = Number(d.critical) || 0, rot = Number(d.rotating) || 0;
          const free = Math.max(0, total - crit - rot);
          if (DDOM.fixedSpots) DDOM.fixedSpots.textContent = this._fmtInt(crit);
          if (DDOM.rotatingSpots) DDOM.rotatingSpots.textContent = this._fmtInt(rot);
          if (DDOM.freeSpots) DDOM.freeSpots.textContent = this._fmtInt(free);
          if (DDOM.freeRatio) DDOM.freeRatio.textContent = this._fmtPct(total > 0 ? free / total : null, 0);
        });

        this.computePhysical(); this.syncType(); this.computePixelPitch();
        if (!this._state.cols && !this._state.rows) this._setGrid(1);
        this._seedCameraStateFromInputs();
        this._computeTotalFeedsGrid();
        this.emit();
      }
    };

    // ---------- Section 3: Video Wall Visualization ----------
    (function () {
      const SVG_ID = 'wall_viz', NS = 'http://www.w3.org/2000/svg';
      const svg = document.getElementById(SVG_ID);
      const tools = {
        wrap: document.getElementById('feed_tools'),
        C: document.getElementById('tool_C'), R: document.getElementById('tool_R'),
        F: document.getElementById('tool_F')
      };
      if (!svg) return;

      // Layout paddings
      const padTop = 12, padRight = 24, padLeft = 12, padBottom = 28;
      const headerTop = 28, headerLeft = 34;

      const fallbackTile = { w: 100, h: 56.25 };
      let currentTool = 'C';
      let totalCols = 0, totalRows = 0, assign = [];
      let dragging = false;

      const idx = (c, r) => r * totalCols + c;
      const el = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
      const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
      const colorFor = (v) => v === 'C' ? '#e53935' : (v === 'R' ? '#1e88e5' : (v === 'F' ? '#43a047' : '#e0e0e0'));
      const labelFor = (v) => v === 'C' ? 'C' : (v === 'R' ? 'R' : (v === 'F' ? 'F' : ''));

      function setTool(t) {
        currentTool = t;[tools.C, tools.R, tools.F].forEach(b => b && b.classList.remove('active'));
        (t === 'C' ? tools.C : (t === 'R' ? tools.R : tools.F))?.classList.add('active');
      }

      function ensureAssignSize(cols, rows) {
        if (cols !== totalCols || rows !== totalRows) {
          totalCols = cols; totalRows = rows; assign = new Array(cols * rows).fill('F');
        }
      }

      function emitAssignmentCounts() {
        const critical = assign.reduce((a, v) => a + (v === 'C' ? 1 : 0), 0);
        const rotating = assign.reduce((a, v) => a + (v === 'R' ? 1 : 0), 0);
        const total = assign.length;
        const free = Math.max(0, total - critical - rotating);
        window.dispatchEvent(new CustomEvent('feeds:assignments', { detail: { critical, rotating, free, total } }));
      }

      function colLetters(n) {
        let s = ''; n = Number(n);
        while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
        return s;
      }

      function screenFontUserUnits(targetPx) {
        const vb = svg.viewBox.baseVal;
        if (!vb || vb.width === 0 || vb.height === 0) return 12;
        const sx = svg.clientWidth / vb.width;
        const sy = svg.clientHeight / vb.height;
        const s = Math.min(sx, sy);
        return targetPx / Math.max(s, 0.001);
      }

      function paintAtIndex(k, rectEl, textEl) {
        assign[k] = currentTool;
        rectEl.setAttribute('fill', colorFor(assign[k]));
        if (textEl) textEl.textContent = labelFor(assign[k]);
      }

      function draw(detail) {
        clear(svg);

        let widthMM = detail?.widthMM, heightMM = detail?.heightMM;
        const wallCols = detail?.wallCols, wallRows = detail?.wallRows;
        const cols = detail?.cols, rows = detail?.rows;

        const haveWall = Number.isFinite(wallCols) && wallCols >= 1 && Number.isFinite(wallRows) && wallRows >= 1;
        const haveFeeds = Number.isFinite(cols) && cols >= 1 && Number.isFinite(rows) && rows >= 1;

        if (!haveWall || !haveFeeds) {
          const msg = !haveWall ? 'Enter wall columns/rows to visualize.'
            : 'Enter per-display feed grid (cols/rows).';
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', 16); t.setAttribute('y', 28); t.setAttribute('font-size', 14); t.setAttribute('fill', '#666');
          t.textContent = msg; svg.appendChild(t); return;
        }
        if (!(Number.isFinite(widthMM) && widthMM > 0 && Number.isFinite(heightMM) && heightMM > 0)) {
          widthMM = fallbackTile.w; heightMM = fallbackTile.h;
        }

        const totalWmm = widthMM * wallCols, totalHmm = heightMM * wallRows;
        const feedW = widthMM / cols, feedH = heightMM / rows;
        const feedCols = wallCols * cols, feedRows = wallRows * rows;
        ensureAssignSize(feedCols, feedRows);

        const padTop = 12, padRight = 24, padLeft = 12, padBottom = 28, headerTop = 28, headerLeft = 34;
        const vbW = padLeft + headerLeft + totalWmm + padRight;
        const vbH = padTop + headerTop + totalHmm + padBottom;
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

        const hdrFont = screenFontUserUnits(12);
        const feedFont = Math.max(8, Math.min(feedW, feedH) * 0.28);

        // Outer wall
        const rect0 = document.createElementNS(NS, 'rect');
        rect0.setAttribute('x', padLeft + headerLeft);
        rect0.setAttribute('y', padTop + headerTop);
        rect0.setAttribute('width', totalWmm);
        rect0.setAttribute('height', totalHmm);
        rect0.setAttribute('fill', 'none'); rect0.setAttribute('stroke', '#222');
        rect0.setAttribute('stroke-width', '2'); rect0.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(rect0);

        // Display grid
        for (let c = 1; c < wallCols; c++) {
          const x = padLeft + headerLeft + c * widthMM;
          const l = document.createElementNS(NS, 'line');
          l.setAttribute('x1', x); l.setAttribute('y1', padTop + headerTop);
          l.setAttribute('x2', x); l.setAttribute('y2', padTop + headerTop + totalHmm);
          l.setAttribute('stroke', '#666'); l.setAttribute('stroke-width', '1.5'); l.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(l);
        }
        for (let r = 1; r < wallRows; r++) {
          const y = padTop + headerTop + r * heightMM;
          const l = document.createElementNS(NS, 'line');
          l.setAttribute('x1', padLeft + headerLeft); l.setAttribute('y1', y);
          l.setAttribute('x2', padLeft + headerLeft + totalWmm); l.setAttribute('y2', y);
          l.setAttribute('stroke', '#666'); l.setAttribute('stroke-width', '1.5'); l.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(l);
        }

        // Feeds
        const g = document.createElementNS(NS, 'g'); svg.appendChild(g);

        svg.addEventListener('pointerdown', (e) => { dragging = true; e.preventDefault(); });
        window.addEventListener('pointerup', () => { if (dragging) { dragging = false; emitAssignmentCounts(); } });

        for (let rr = 0; rr < feedRows; rr++) {
          for (let cc = 0; cc < feedCols; cc++) {
            const x = padLeft + headerLeft + cc * feedW;
            const y = padTop + headerTop + rr * feedH;
            const k = rr * feedCols + cc;
            const v = assign[k];

            const rct = document.createElementNS(NS, 'rect');
            rct.setAttribute('x', x); rct.setAttribute('y', y);
            rct.setAttribute('width', feedW); rct.setAttribute('height', feedH);
            rct.setAttribute('fill', colorFor(v));
            rct.setAttribute('stroke', '#f5f5f5'); rct.setAttribute('stroke-width', '0.8');
            rct.setAttribute('vector-effect', 'non-scaling-stroke'); rct.style.cursor = 'pointer';

            const tx = document.createElementNS(NS, 'text');
            tx.setAttribute('x', x + feedW / 2); tx.setAttribute('y', y + feedH / 2 + feedFont * 0.35);
            tx.setAttribute('font-size', feedFont); tx.setAttribute('font-family', 'Arial, sans-serif');
            tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('fill', '#fff'); tx.style.pointerEvents = 'none';
            tx.textContent = labelFor(v);

            rct.addEventListener('pointerdown', (e) => { e.preventDefault(); assign[k] = currentTool; rct.setAttribute('fill', colorFor(assign[k])); tx.textContent = labelFor(assign[k]); emitAssignmentCounts(); });
            rct.addEventListener('pointerenter', () => { if (!dragging) return; assign[k] = currentTool; rct.setAttribute('fill', colorFor(assign[k])); tx.textContent = labelFor(assign[k]); });

            g.appendChild(rct); g.appendChild(tx);
          }
        }

        // Column headers (fixed Y)
        for (let c = 0; c < feedCols; c++) {
          const cx = padLeft + headerLeft + (c + 0.5) * feedW;
          const ht = document.createElementNS(NS, 'text');
          ht.setAttribute('x', cx); ht.setAttribute('y', padTop + headerTop - 10);
          ht.setAttribute('font-size', hdrFont); ht.setAttribute('font-family', 'Arial, sans-serif');
          ht.setAttribute('text-anchor', 'middle'); ht.setAttribute('fill', '#333');
          ht.textContent = colLetters(c);
          ht.style.cursor = 'pointer';
          ht.addEventListener('click', () => {
            for (let r = 0; r < feedRows; r++) { assign[r * feedCols + c] = currentTool; }
            draw(detail);
          });
          svg.appendChild(ht);
        }

        // Row headers (fixed X)
        for (let r = 0; r < feedRows; r++) {
          const cy = padTop + headerTop + (r + 0.5) * feedH + hdrFont * 0.35;
          const ht = document.createElementNS(NS, 'text');
          ht.setAttribute('x', padLeft + headerLeft - 10); ht.setAttribute('y', cy);
          ht.setAttribute('font-size', hdrFont); ht.setAttribute('font-family', 'Arial, sans-serif');
          ht.setAttribute('text-anchor', 'end'); ht.setAttribute('fill', '#333');
          ht.textContent = String(r + 1);
          ht.style.cursor = 'pointer';
          ht.addEventListener('click', () => {
            for (let c = 0; c < feedCols; c++) { assign[r * feedCols + c] = currentTool; }
            draw(detail);
          });
          svg.appendChild(ht);
        }

        // Per-display frames
        for (let r = 0; r < wallRows; r++) {
          for (let c = 0; c < wallCols; c++) {
            const x = padLeft + headerLeft + c * widthMM;
            const y = padTop + headerTop + r * heightMM;
            const frame = document.createElementNS(NS, 'rect');
            frame.setAttribute('x', x); frame.setAttribute('y', y);
            frame.setAttribute('width', widthMM); frame.setAttribute('height', heightMM);
            frame.setAttribute('fill', 'none'); frame.setAttribute('stroke', '#444');
            frame.setAttribute('stroke-width', '1.2'); frame.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(frame);
          }
        }

        const totalFeedsBox = document.getElementById('total_feeds');
        if (totalFeedsBox) totalFeedsBox.textContent = String(feedCols * feedRows);
        emitAssignmentCounts();
      }

      if (tools.wrap) {
        tools.C?.addEventListener('click', () => setTool('C'));
        tools.R?.addEventListener('click', () => setTool('R'));
        tools.F?.addEventListener('click', () => setTool('F'));
        setTool('C');
      }

      window.addEventListener('display:update', (e) => draw(e.detail));
    })();

    // ---------- Section 4: Ergonomics ----------
    const ERGO = {
      els: {
        minVD: document.getElementById('min_view_dist_m'),
        maxVD: document.getElementById('max_view_dist_m'),
      },
      computeFromState(state) {
        if (!state) return;
        const { widthMM, heightMM, resW, resH, wallRows } = state;

        let pitch = null;
        const pw = (Number.isFinite(widthMM) && Number.isFinite(resW) && resW > 0) ? (widthMM / resW) : null;
        const ph = (Number.isFinite(heightMM) && Number.isFinite(resH) && resH > 0) ? (heightMM / resH) : null;
        pitch = (pw != null && ph != null) ? (pw + ph) / 2 : (pw ?? ph);
        if (this.els.minVD) this.els.minVD.textContent = Number.isFinite(pitch) ? `${(pitch * 3.438).toFixed(2)} m` : '—';

        const wallHeightMM = (Number.isFinite(heightMM) && Number.isFinite(wallRows) && wallRows > 0) ? heightMM * wallRows : null;
        if (this.els.maxVD) this.els.maxVD.textContent = Number.isFinite(wallHeightMM) ? `${((wallHeightMM / 1000) * 6).toFixed(2)} m` : '—';
      },
      init() {
        window.addEventListener('display:update', (e) => this.computeFromState(e.detail));
        if (window.DISP && DISP._state) this.computeFromState(DISP._state);
      }
    };

    // ---------- Section 5: Workstation Ergonomics ----------
    const WSE = {
      els: {
        desk: document.getElementById('desk_height_mm'),
        num: document.getElementById('ws_num_screens'),
        sizeIn: document.getElementById('ws_screen_size_in'),
        eye: document.getElementById('eye_level_mm'),
        outScrH: document.getElementById('ws_screen_height_mm'),
        outConsole: document.getElementById('console_height_mm'),
      },
      _n(x) { const n = Number(x); return Number.isFinite(n) ? n : null; },
      _screenHeightMMFromInches(inches) { const v = this._n(inches); return (v !== null && v > 0) ? v * 12.47 : null; },
      compute() {
        const deskMM = this._n(this.els.desk?.value);
        const sizeIn = this._n(this.els.sizeIn?.value);
        const scrH = this._screenHeightMMFromInches(sizeIn);
        if (this.els.outScrH) this.els.outScrH.textContent = (scrH !== null) ? Math.round(scrH) : '—';
        if (this.els.outConsole) {
          if (deskMM !== null && scrH !== null) this.els.outConsole.textContent = String(Math.round(deskMM + scrH + 150));
          else this.els.outConsole.textContent = '—';
        }
      },
      init() {
        [this.els.desk, this.els.num, this.els.sizeIn, this.els.eye].forEach(el => ['input', 'change'].forEach(ev => el?.addEventListener(ev, () => this.compute())));
        window.addEventListener('display:update', () => this.compute());
        this.compute();
      }
    };

    // ---------- Section 6: Control Room Layout (Plan) ----------
    const CR = {
      els: {
        w: document.getElementById('cr_desk_width_mm'),
        d: document.getElementById('cr_desk_depth_mm'),
        rows: document.getElementById('cr_rows'),
        perRow: document.getElementById('cr_ws_per_row'),
        gap: document.getElementById('cr_gap_between_ws_mm'),
        aisle: document.getElementById('cr_aisle_mm'),

        // Separate clearances (preferred)
        sideClr: document.getElementById('cr_side_clear_mm'),
        backClr: document.getElementById('cr_back_clear_mm'),

        // Legacy combined clearance (fallback)
        clr: document.getElementById('cr_room_clear_mm'),

        // Distance from desk bottom edge to operator (center)
        opDist: document.getElementById('cr_op_offset_mm'),

        vwGap: document.getElementById('cr_vw_gap_mm'),
        outSize: document.getElementById('cr_room_size_box'),
        svg: document.getElementById('cr_plan_svg'),
      },

      // cache latest display state from Section 2
      _disp: null,

      // Visual size of operator (circle radius, mm)
      _OP_R: 100,

      _n(x) { const n = Number(x); return Number.isFinite(n) ? n : null; },

      // Robust: accept <svg> or any descendant (<g>) and resolve the owner SVG
      _fixedPxFont(svgLike, px = 11) {
        const svg = svgLike?.ownerSVGElement || svgLike;
        const vb = svg?.viewBox?.baseVal;
        if (!vb || vb.width === 0 || vb.height === 0) return 12;
        const sx = svg.clientWidth / vb.width;
        const sy = svg.clientHeight / vb.height;
        const s = Math.min(sx, sy);
        return px / Math.max(s, 0.001);
      },

      _mmLabel(v) { return `${Math.round(v)} mm`; },
      _drawEmpty(msg) {
        const svg = this.els.svg; if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', '16'); t.setAttribute('y', '28');
        t.setAttribute('fill', '#666'); t.setAttribute('font-size', '14');
        t.textContent = msg;
        svg.appendChild(t);
      },
      _dimStyle(el) {
        el.setAttribute('stroke', '#9c27b0');
        el.setAttribute('stroke-width', '1.2');
        el.setAttribute('fill', 'none');
        el.setAttribute('vector-effect', 'non-scaling-stroke');
      },
      _drawDimH(svg, x1, x2, y, label, fontSize) {
        const tick = 6, ah = 5;
        const ext1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ext1.setAttribute('x1', x1); ext1.setAttribute('y1', y - tick);
        ext1.setAttribute('x2', x1); ext1.setAttribute('y2', y + tick);
        this._dimStyle(ext1); svg.appendChild(ext1);

        const ext2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ext2.setAttribute('x1', x2); ext2.setAttribute('y1', y - tick);
        ext2.setAttribute('x2', x2); ext2.setAttribute('y2', y + tick);
        this._dimStyle(ext2); svg.appendChild(ext2);

        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', x1); ln.setAttribute('y1', y);
        ln.setAttribute('x2', x2); ln.setAttribute('y2', y);
        this._dimStyle(ln); svg.appendChild(ln);

        const leftTri = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        leftTri.setAttribute('points', [[x1, y], [x1 + ah, y - ah], [x1 + ah, y + ah]].map(p => p.join(',')).join(' '));
        this._dimStyle(leftTri); svg.appendChild(leftTri);

        const rightTri = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        rightTri.setAttribute('points', [[x2, y], [x2 - ah, y - ah], [x2 - ah, y + ah]].map(p => p.join(',')).join(' '));
        this._dimStyle(rightTri); svg.appendChild(rightTri);

        const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', (x1 + x2) / 2); tx.setAttribute('y', y - 4);
        tx.setAttribute('font-size', fontSize);
        tx.setAttribute('font-family', 'Arial, sans-serif');
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('fill', '#6a1b9a');
        tx.textContent = label; svg.appendChild(tx);
      },
      _drawDimV(svg, y1, y2, x, label, fontSize) {
        const tick = 6, ah = 5;
        const ext1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ext1.setAttribute('x1', x - tick); ext1.setAttribute('y1', y1);
        ext1.setAttribute('x2', x + tick); ext1.setAttribute('y2', y1);
        this._dimStyle(ext1); svg.appendChild(ext1);

        const ext2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ext2.setAttribute('x1', x - tick); ext2.setAttribute('y1', y2);
        ext2.setAttribute('x2', x + tick); ext2.setAttribute('y2', y2);
        this._dimStyle(ext2); svg.appendChild(ext2);

        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', x); ln.setAttribute('y1', y1);
        ln.setAttribute('x2', x); ln.setAttribute('y2', y2);
        this._dimStyle(ln); svg.appendChild(ln);

        const topTri = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        topTri.setAttribute('points', [[x, y1], [x - ah, y1 + ah], [x + ah, y1 + ah]].map(p => p.join(',')).join(' '));
        this._dimStyle(topTri); svg.appendChild(topTri);

        const botTri = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        botTri.setAttribute('points', [[x, y2], [x - ah, y2 - ah], [x + ah, y2 - ah]].map(p => p.join(',')).join(' '));
        this._dimStyle(botTri); svg.appendChild(botTri);

        const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', x - 6); tx.setAttribute('y', (y1 + y2) / 2 + fontSize * 0.35);
        tx.setAttribute('font-size', fontSize);
        tx.setAttribute('font-family', 'Arial, sans-serif');
        tx.setAttribute('text-anchor', 'end');
        tx.setAttribute('fill', '#6a1b9a');
        tx.textContent = label; svg.appendChild(tx);
      },

      // --- angle helpers & HFOV drawing ---
      _deg(r) { return r * 180 / Math.PI; },
      _angleBetween(o, a, b) {
        const ax = a.x - o.x, ay = a.y - o.y, bx = b.x - o.x, by = b.y - o.y;
        const dot = ax * bx + ay * by, det = ax * by - ay * bx;
        let ang = Math.abs(Math.atan2(det, dot));
        if (!Number.isFinite(ang)) ang = 0;
        return ang; // radians
      },
      _drawHFOV(root, cx, cy, wallX, wallW, wallMidY) {
        const svgEl = root.ownerSVGElement || root;
        const NS = 'http://www.w3.org/2000/svg';
        const COL = '#1b5e20';
        const fs = this._fixedPxFont(svgEl, 14); // Font Size
        const PUSH = 120;

        const L = { x: wallX, y: wallMidY }, R = { x: wallX + wallW, y: wallMidY };
        const apex = { x: cx, y: cy };

        const mkLine = (x1, y1, x2, y2) => {
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
          ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
          ln.setAttribute('stroke', COL);
          ln.setAttribute('stroke-width', '1.0');
          ln.setAttribute('stroke-dasharray', '6 4');
          ln.setAttribute('vector-effect', 'non-scaling-stroke');
          ln.setAttribute('stroke-linecap', 'round');
          return ln;
        };
        root.appendChild(mkLine(cx, cy, L.x, L.y));
        root.appendChild(mkLine(cx, cy, R.x, R.y));

        const ang = this._angleBetween(apex, L, R);
        const degTxt = (ang * 180 / Math.PI).toFixed(1) + '°';

        const unit = (px, py) => { const n = Math.hypot(px, py) || 1; return { x: px / n, y: py / n }; };
        const vL = unit(L.x - cx, L.y - cy), vR = unit(R.x - cx, R.y - cy);
        let bis = { x: vL.x + vR.x, y: vL.y + vR.y };
        const mag = Math.hypot(bis.x, bis.y);
        if (mag < 1e-3) { bis = unit(vL.y, -vL.x); } else { bis.x /= mag; bis.y /= mag; }

        const r = Math.max(160, this._OP_R + 30) + PUSH;
        const tx = cx + bis.x * r;
        const ty = cy + bis.y * r - fs * 0.4;

        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', tx); t.setAttribute('y', ty);
        t.setAttribute('font-size', fs);
        t.setAttribute('font-family', 'Arial, sans-serif');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', COL);
        t.style.userSelect = 'none';
        t.style.pointerEvents = 'none';
        t.textContent = `${degTxt}`;
        root.appendChild(t);
      },

      compute() {
        const W = this._n(this.els.w?.value);
        const D = this._n(this.els.d?.value);
        const R = this._n(this.els.rows?.value) ?? 1;
        const N = this._n(this.els.perRow?.value);
        const G = this._n(this.els.gap?.value) ?? 0;
        const A = this._n(this.els.aisle?.value) ?? 0;

        // Separate clearances (fallback to legacy combined)
        const sideInput = this._n(this.els.sideClr?.value);
        const backInput = this._n(this.els.backClr?.value);
        const legacy = this._n(this.els.clr?.value);
        const sideC = (sideInput != null ? sideInput : (legacy ?? 0));
        const backC = (backInput != null ? backInput : (legacy ?? 0));

        const OPD = this._n(this.els.opDist?.value) ?? 0;  // operator center offset
        const VWG = this._n(this.els.vwGap?.value) ?? 0;

        if (!(W > 0 && D > 0 && N > 0) || !(R === 1 || R === 2)) {
          this._drawEmpty('Enter desk dimensions and counts to draw the plan.');
          if (this.els.outSize) this.els.outSize.textContent = '—';
          return;
        }

        // Row width = N*W + (N-1)*G
        const rowWidth = N * W + (N - 1) * G;

        // Video wall width from cached state
        const ds = this._disp || {};
        const wallTotalFromState = Number.isFinite(ds.wallTotalWMM) ? ds.wallTotalWMM : null;
        const wallTotalFromParts = (Number.isFinite(ds.widthMM) && Number.isFinite(ds.wallCols) && ds.wallCols > 0)
          ? (ds.widthMM * ds.wallCols) : null;
        const vwWidth = Number.isFinite(wallTotalFromState) ? wallTotalFromState
          : (Number.isFinite(wallTotalFromParts) ? wallTotalFromParts : 0);

        // Enforce ≥200 mm side margin if wall exists
        const minSideIfWall = (vwWidth > 0) ? 200 : 0;
        const sideMargin = Math.max(sideC, minSideIfWall);

        // Room width must fit the wall and the row
        const roomW = Math.max(vwWidth + 2 * sideMargin, rowWidth + 2 * sideC);

        // Room depth = wall thickness + VW->desk gap + rows + back clearance
        const WALL_T = 100;
        const rowsDepth = (R === 1) ? D : (D + A + D);
        const roomH = WALL_T + VWG + rowsDepth + backC;

        if (this.els.outSize) {
          const mW = (roomW / 1000).toFixed(2), mH = (roomH / 1000).toFixed(2);
          this.els.outSize.textContent = `${Math.round(roomW)} mm × ${Math.round(roomH)} mm  •  ${mW} m × ${mH} m`;
        }

        // Share room width with elevation so both use the same X-span
        SYNC.roomW = roomW;

        this._drawPlan({
          W, D, R, N, G, A,
          WALL_T, VWG, roomW, roomH, rowWidth,
          vwWidth, sideMargin, sideC, backC, OPD
        });
      },

      _drawPlan({ W, D, R, N, G, A, WALL_T, VWG, roomW, roomH, rowWidth, vwWidth, sideMargin, sideC, backC, OPD }) {
        const svg = this.els.svg; if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // --- unified sizing ---
        const pad = SYNC.pad;
        const SCALE = SYNC.scale;
        this._OP_R = SYNC.opR;

        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.setAttribute('viewBox', `0 0 ${roomW + 2 * pad} ${roomH + 2 * pad}`);

        const NS = 'http://www.w3.org/2000/svg';

        // Draw into a scaled group so the whole diagram is slightly larger
        const root = document.createElementNS(NS, 'g');
        root.setAttribute('transform', `translate(${pad},${pad}) scale(${SCALE}) translate(${-pad},${-pad})`);
        svg.appendChild(root);

        const font = this._fixedPxFont(svg, SYNC.fontPx);

        // Room outline
        const room = document.createElementNS(NS, 'rect');
        room.setAttribute('x', pad); room.setAttribute('y', pad);
        room.setAttribute('width', roomW); room.setAttribute('height', roomH);
        room.setAttribute('fill', 'none'); room.setAttribute('stroke', '#333');
        room.setAttribute('stroke-width', '2'); room.setAttribute('vector-effect', 'non-scaling-stroke');
        root.appendChild(room);

        // Content area
        const contentW = roomW - 2 * sideMargin;
        const leftX = pad + sideMargin;

        // Video wall band (centered)
        const wallHasSize = vwWidth > 0;
        const wallDrawWidth = wallHasSize ? vwWidth : Math.min(1200, contentW);
        const wallX = leftX + (contentW - wallDrawWidth) / 2;
        const wallY = pad;

        const wallRect = document.createElementNS(NS, 'rect');
        wallRect.setAttribute('x', wallX);
        wallRect.setAttribute('y', wallY);
        wallRect.setAttribute('width', wallDrawWidth);
        wallRect.setAttribute('height', WALL_T);
        wallRect.setAttribute('fill', wallHasSize ? '#212121' : 'none');
        wallRect.setAttribute('stroke', wallHasSize ? '#000' : '#9e9e9e');
        wallRect.setAttribute('stroke-dasharray', wallHasSize ? 'none' : '8 6');
        wallRect.setAttribute('stroke-width', '1.2');
        wallRect.setAttribute('vector-effect', 'non-scaling-stroke');
        root.appendChild(wallRect);

        const wt = document.createElementNS(NS, 'text');
        wt.setAttribute('x', wallX + wallDrawWidth / 2);
        wt.setAttribute('y', wallY + WALL_T / 2 + font * 0.35);
        wt.setAttribute('font-size', font);
        wt.setAttribute('font-family', 'Arial, sans-serif');
        wt.setAttribute('text-anchor', 'middle');
        wt.setAttribute('fill', wallHasSize ? '#fafafa' : '#666');
        wt.textContent = wallHasSize ? 'Video Wall' : 'Set screen size & wall columns';
        root.appendChild(wt);

        // Row y positions
        const row1Y = pad + WALL_T + VWG;
        const row2Y = row1Y + D + A;

        // Center rows in content area
        const rowStartX = leftX + (contentW - rowWidth) / 2;

        // Aisle band
        if (R === 2 && A > 0) {
          const aisleY = row1Y + D;
          const band = document.createElementNS(NS, 'rect');
          band.setAttribute('x', rowStartX);
          band.setAttribute('y', aisleY);
          band.setAttribute('width', rowWidth);
          band.setAttribute('height', A);
          band.setAttribute('fill', '#e3f2fd');
          band.setAttribute('stroke', 'none');
          root.appendChild(band);

          const at = document.createElementNS(NS, 'text');
          at.setAttribute('x', rowStartX + rowWidth / 2);
          at.setAttribute('y', aisleY + A / 2 + font * 0.35);
          at.setAttribute('font-size', font);
          at.setAttribute('font-family', 'Arial, sans-serif');
          at.setAttribute('text-anchor', 'middle');
          at.setAttribute('fill', '#1976d2');
          at.textContent = 'Aisle';
          root.appendChild(at);
        }

        // Desks + Operators
        const operatorCenters = [];
        for (let r = 0; r < R; r++) {
          const baseY = (r === 0) ? row1Y : row2Y;
          for (let i = 0; i < N; i++) {
            const x = rowStartX + i * (W + G);

            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', x); rect.setAttribute('y', baseY);
            rect.setAttribute('width', W); rect.setAttribute('height', D);
            rect.setAttribute('rx', 6);
            rect.setAttribute('fill', '#9e9e9e');
            rect.setAttribute('stroke', '#666');
            rect.setAttribute('stroke-width', '1');
            rect.setAttribute('vector-effect', 'non-scaling-stroke');
            root.appendChild(rect);

            const tx = document.createElementNS(NS, 'text');
            tx.setAttribute('x', x + W / 2); tx.setAttribute('y', baseY + D / 2 + font * 0.35);
            tx.setAttribute('font-size', font);
            tx.setAttribute('font-family', 'Arial, sans-serif');
            tx.setAttribute('text-anchor', 'middle');
            tx.setAttribute('fill', '#fff');
            tx.textContent = `R${r + 1}-S${i + 1}`;
            root.appendChild(tx);

            const cx = x + W / 2;
            const cy = baseY + D + OPD;
            const op = document.createElementNS(NS, 'circle');
            op.setAttribute('cx', cx);
            op.setAttribute('cy', cy);
            op.setAttribute('r', this._OP_R);
            op.setAttribute('fill', '#ff7043');
            op.setAttribute('stroke', '#e65100');
            op.setAttribute('stroke-width', '1.2');
            op.setAttribute('vector-effect', 'non-scaling-stroke');
            root.appendChild(op);

            operatorCenters.push({ cx, cy });
          }
        }

        // HFOV rays & labels
        if (vwWidth > 0) {
          const wallMidY = wallY + WALL_T / 2;
          for (const p of operatorCenters) {
            this._drawHFOV(root, p.cx, p.cy, wallX, wallDrawWidth, wallMidY);
          }
        }

        // ----- Vertical dimensions (aligned column) -----
        const xDim = pad + roomW - 18;
        if (VWG > 0) this._drawDimV(root, wallY + WALL_T, row1Y, xDim, this._mmLabel(VWG), font);
        if (D > 0) this._drawDimV(root, row1Y, row1Y + D, xDim, this._mmLabel(D), font);
        if (R === 2 && A > 0) this._drawDimV(root, row1Y + D, row2Y, xDim, this._mmLabel(A), font);
        if (R === 2 && D > 0) this._drawDimV(root, row2Y, row2Y + D, xDim, this._mmLabel(D), font);

        // Back clearance (remaining depth)
        const usedDepth = WALL_T + VWG + D + (R === 2 ? (A + D) : 0);
        const backStart = pad + usedDepth;
        const backEnd = pad + roomH;
        const backClear = backEnd - backStart;
        if (backClear > 0) this._drawDimV(root, backStart, backEnd, xDim, this._mmLabel(backClear), font);

        // ===== Bottom horizontal dimension chain (inside the room) =====
        // (No top wall-clearance dimensions anymore.)
        //   Sequence: left wall clearance → W → G → W → ... → right wall clearance
        const chainY = pad + roomH - 60; // safely inside the room

        // helpers for a single segment
        const dimStyle = (el) => {
          el.setAttribute('stroke', '#9c27b0');
          el.setAttribute('stroke-width', '1.2');
          el.setAttribute('fill', 'none');
          el.setAttribute('vector-effect', 'non-scaling-stroke');
        };
        const drawSeg = (x1, x2, y, label) => {
          const tick = 6, ah = 5;
          // extension ticks
          const ext1 = document.createElementNS(NS, 'line');
          ext1.setAttribute('x1', x1); ext1.setAttribute('y1', y - tick); ext1.setAttribute('x2', x1); ext1.setAttribute('y2', y + tick); dimStyle(ext1); root.appendChild(ext1);
          const ext2 = document.createElementNS(NS, 'line');
          ext2.setAttribute('x1', x2); ext2.setAttribute('y1', y - tick); ext2.setAttribute('x2', x2); ext2.setAttribute('y2', y + tick); dimStyle(ext2); root.appendChild(ext2);
          // dim line
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', x1); ln.setAttribute('y1', y); ln.setAttribute('x2', x2); ln.setAttribute('y2', y); dimStyle(ln); root.appendChild(ln);
          // arrows
          const ltri = document.createElementNS(NS, 'polyline');
          ltri.setAttribute('points', [[x1, y], [x1 + ah, y - ah], [x1 + ah, y + ah]].map(p => p.join(',')).join(' ')); dimStyle(ltri); root.appendChild(ltri);
          const rtri = document.createElementNS(NS, 'polyline');
          rtri.setAttribute('points', [[x2, y], [x2 - ah, y - ah], [x2 - ah, y + ah]].map(p => p.join(',')).join(' ')); dimStyle(rtri); root.appendChild(rtri);
          // label ABOVE the line to avoid clipping
          const tx = document.createElementNS(NS, 'text');
          tx.setAttribute('x', (x1 + x2) / 2); tx.setAttribute('y', y - 6);
          tx.setAttribute('font-size', font); tx.setAttribute('font-family', 'Arial, sans-serif');
          tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('fill', '#6a1b9a'); tx.textContent = label; root.appendChild(tx);
        };

        // compute boundaries for chain
        const roomLeft = pad;
        const roomRight = pad + roomW;
        const leftClear = rowStartX - roomLeft;                              // wall → first desk
        const rightClear = roomRight - (rowStartX + rowWidth);               // last desk → wall

        // left wall clearance segment
        drawSeg(roomLeft, rowStartX, chainY, `${Math.round(leftClear)} mm`);

        // each desk + (gap) ... in a chain
        for (let i = 0; i < N; i++) {
          const deskX1 = rowStartX + i * (W + G);
          const deskX2 = deskX1 + W;
          drawSeg(deskX1, deskX2, chainY, `${Math.round(W)} mm`);
          if (i < N - 1 && G > 0) {
            const gapX1 = deskX2;
            const gapX2 = gapX1 + G;
            drawSeg(gapX1, gapX2, chainY, `${Math.round(G)} mm`);
          }
        }

        // right wall clearance segment
        drawSeg(rowStartX + rowWidth, roomRight, chainY, `Wall ${Math.round(rightClear)} mm`);
      },

      init() {
        const inputs = [
          this.els.w, this.els.d, this.els.rows, this.els.perRow,
          this.els.gap, this.els.aisle, this.els.sideClr, this.els.backClr,
          this.els.clr, this.els.vwGap, this.els.opDist
        ];
        inputs.forEach(el => ['input', 'change'].forEach(ev => el?.addEventListener(ev, () => this.compute())));

        // cache the latest display state so plan uses current wall width
        window.addEventListener('display:update', (e) => {
          this._disp = e?.detail || null;
          this.compute();
        });

        this.compute();
      }
    };

// ---------- Section 7: Control Room Elevation (Side View) ----------
const ELEV = {
  els: {
    ceiling: document.getElementById('cr_ceiling_mm'),
    vwFloor: document.getElementById('cr_vw_floor_clear_mm'),
    // reuse existing geometry
    rows: document.getElementById('cr_rows'),
    d: document.getElementById('cr_desk_depth_mm'),
    aisle: document.getElementById('cr_aisle_mm'),
    backClr: document.getElementById('cr_back_clear_mm'),   // preferred
    legacyClr: document.getElementById('cr_room_clear_mm'), // fallback
    vwGap: document.getElementById('cr_vw_gap_mm'),
    deskH: document.getElementById('desk_height_mm'),
    screenIn: document.getElementById('ws_screen_size_in'),
    // Operator placement / eye level
    opDist: document.getElementById('cr_op_offset_mm'),
    eyeLvl: document.getElementById('eye_level_mm'),
    svg: document.getElementById('cr_elev_svg'),
  },

  // latest display state (from Section 2)
  _disp: null,

  // Chair stylized dims (mm)
  _CHAIR: {
    seatH: 500, seatDepth: 460, seatThk: 60,
    backH: 470, backLeanDeg: -10, // negative means lean back (toward +x)
    postH: 420, baseR: 150, baseThk: 12, casterR: 16, spokeL: 120, spokeThk: 6
  },

  // Human proportions for side profile (mm)
  _HUMAN: {
    headR: 95, neckH: 40,
    torsoH: 360, torsoOffX: -6,
    thighL: 300, calfL: 380, footL: 200
  },

  _n(x){ const n = Number(x); return Number.isFinite(n) ? n : null; },
  _screenH(inch){ const v = this._n(inch); return (v && v > 0) ? v * 12.47 : null; }, // 16:9 height mm/in

  _fxFont(svgLike, px=11){
    const svg = svgLike?.ownerSVGElement || svgLike;
    const vb = svg?.viewBox?.baseVal; if(!vb || vb.width===0||vb.height===0) return 12;
    const s = Math.min(svg.clientWidth/vb.width, svg.clientHeight/vb.height);
    return px / Math.max(s, 0.001);
  },

  _angleBetween(o,a,b){
    const ax=a.x-o.x, ay=a.y-o.y, bx=b.x-o.x, by=b.y-o.y;
    const dot=ax*bx+ay*by, det=ax*by-ay*bx;
    let ang=Math.abs(Math.atan2(det,dot)); if(!Number.isFinite(ang)) ang=0; return ang;
  },

  _drawVFOV(root,hx,hy,xWall,yTop,yBot){
    const svgEl = root.ownerSVGElement || root;
    const NS='http://www.w3.org/2000/svg', COL='#1b5e20', fs=this._fxFont(svgEl,14);
    const mk=(x1,y1,x2,y2)=>{const ln=document.createElementNS(NS,'line');
      ln.setAttribute('x1',x1); ln.setAttribute('y1',y1);
      ln.setAttribute('x2',x2); ln.setAttribute('y2',y2);
      ln.setAttribute('stroke',COL); ln.setAttribute('stroke-width','1.0');
      ln.setAttribute('stroke-dasharray','6 4'); ln.setAttribute('vector-effect','non-scaling-stroke');
      ln.setAttribute('stroke-linecap','round'); return ln;};
    root.appendChild(mk(hx,hy,xWall,yTop));
    root.appendChild(mk(hx,hy,xWall,yBot));
    const ang=this._angleBetween({x:hx,y:hy},{x:xWall,y:yTop},{x:xWall,y:yBot});
    const t=document.createElementNS(NS,'text');
    t.setAttribute('x',hx + Math.max(120, Math.min(200, Math.abs(hx-xWall)*0.45)));
    t.setAttribute('y',hy - 6);
    t.setAttribute('font-size',fs);
    t.setAttribute('font-family','Arial, sans-serif');
    t.setAttribute('text-anchor','start');
    t.setAttribute('fill',COL);
    t.style.userSelect='none'; t.style.pointerEvents='none';
    t.textContent=(ang*180/Math.PI).toFixed(1)+'°';
    root.appendChild(t);
  },

  compute(){
    if(!this.els.svg) return;

    const R=this._n(this.els.rows?.value)??1;
    const D=this._n(this.els.d?.value)??0;
    const A=this._n(this.els.aisle?.value)??0;
    const VWG=this._n(this.els.vwGap?.value)??0;
    const backC=(this._n(this.els.backClr?.value)??this._n(this.els.legacyClr?.value)??0);

    const ceilH=this._n(this.els.ceiling?.value)??3000;
    const vwFloor=this._n(this.els.vwFloor?.value)??0;

    const deskH=this._n(this.els.deskH?.value)??0;
    const scrH=this._screenH(this.els.screenIn?.value);
    const screensH=Number.isFinite(scrH)?(scrH+150):null;

    const OPD=this._n(this.els.opDist?.value)??0;
    const eyeLevel=this._n(this.els.eyeLvl?.value)??null;

    const ds=this._disp||{};
    const wallH = Number.isFinite(ds.wallTotalHMM) ? ds.wallTotalHMM
               : (Number.isFinite(ds.heightMM)&&Number.isFinite(ds.wallRows)&&ds.wallRows>0 ? ds.heightMM*ds.wallRows : null);

    const WALL_T=100;
    const depth=WALL_T+VWG+D+(R===2?(A+D):0)+backC;

    this._draw({R,D,A,VWG,backC,WALL_T,depth,ceilH,vwFloor,deskH,screensH,wallH,OPD,eyeLevel});
  },

  _draw({R,D,A,VWG,backC,WALL_T,depth,ceilH,vwFloor,deskH,screensH,wallH,OPD,eyeLevel}){
    const svg=this.els.svg; while(svg.firstChild) svg.removeChild(svg.firstChild);
    const pad=SYNC.pad;
    const baseW=(typeof SYNC.roomW==='number'&&SYNC.roomW>0)?SYNC.roomW:depth;
    const xInset=Math.max(0,(baseW-depth)/2);
    const NS='http://www.w3.org/2000/svg';
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.setAttribute('shape-rendering','crispEdges');
    svg.setAttribute('viewBox',`0 0 ${baseW+2*pad} ${ceilH+2*pad}`);

    const root=document.createElementNS(NS,'g');
    root.setAttribute('transform',`translate(${pad},${pad})`);
    svg.appendChild(root);

    const font=this._fxFont(svg,SYNC.fontPx);
    const clampY=(y)=>Math.max(pad, Math.min(pad+ceilH,y));
    const yFromFloor=(h)=>clampY(pad+(ceilH-h));
    const x0=pad+xInset;
    const xLeft=x0, xRight=x0+depth;

    // Floor/Ceiling
    const floorY=yFromFloor(0), ceilY=yFromFloor(ceilH);
    const floor=document.createElementNS(NS,'line');
    floor.setAttribute('x1',xLeft); floor.setAttribute('x2',xRight);
    floor.setAttribute('y1',floorY); floor.setAttribute('y2',floorY);
    floor.setAttribute('stroke','#333'); floor.setAttribute('stroke-width','2');
    floor.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(floor);
    const ceil=document.createElementNS(NS,'line');
    ceil.setAttribute('x1',xLeft); ceil.setAttribute('x2',xRight);
    ceil.setAttribute('y1',ceilY); ceil.setAttribute('y2',ceilY);
    ceil.setAttribute('stroke','#999'); ceil.setAttribute('stroke-dasharray','6 6');
    ceil.setAttribute('stroke-width','1.2'); ceil.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(ceil);

    // Front wall
    const wall=document.createElementNS(NS,'rect');
    wall.setAttribute('x',x0); wall.setAttribute('y',yFromFloor(ceilH));
    wall.setAttribute('width',WALL_T); wall.setAttribute('height',ceilH);
    wall.setAttribute('fill','#eee'); wall.setAttribute('stroke','#bbb');
    wall.setAttribute('stroke-width','1'); wall.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(wall);

    // Video wall
    let yTopVW=null, yBotVW=null;
    if(Number.isFinite(wallH) && wallH>0){
      const vh=Math.min(wallH, Math.max(0, ceilH-vwFloor));
      yTopVW=yFromFloor(vwFloor+vh); yBotVW=yFromFloor(vwFloor);

      const vwRect=document.createElementNS(NS,'rect');
      vwRect.setAttribute('x',x0+4); vwRect.setAttribute('y',yTopVW);
      vwRect.setAttribute('width',WALL_T-8); vwRect.setAttribute('height',vh);
      vwRect.setAttribute('fill','#212121'); vwRect.setAttribute('stroke','#000');
      vwRect.setAttribute('stroke-width','1.2'); vwRect.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(vwRect);

      const cxVW=x0+WALL_T/2, cyVW=yFromFloor(vwFloor+vh/2);
      const vwt=document.createElementNS(NS,'text');
      vwt.setAttribute('x',cxVW); vwt.setAttribute('y',cyVW);
      vwt.setAttribute('font-size',font); vwt.setAttribute('font-family','Arial, sans-serif');
      vwt.setAttribute('text-anchor','middle'); vwt.setAttribute('fill','#fafafa');
      vwt.setAttribute('transform',`rotate(-90 ${cxVW} ${cyVW})`);
      vwt.textContent='Video Wall'; root.appendChild(vwt);

      // VW vertical dims (right side)
      const dimX=x0+WALL_T+60, tick=6, ah=5;
      const dimStyle=(el)=>{ el.setAttribute('stroke','#9c27b0'); el.setAttribute('stroke-width','1.2');
        el.setAttribute('fill','none'); el.setAttribute('vector-effect','non-scaling-stroke'); };
      const drawVDim=(y1,y2,label)=>{
        const e1=document.createElementNS(NS,'line'); e1.setAttribute('x1',dimX-tick); e1.setAttribute('y1',y1);
        e1.setAttribute('x2',dimX+tick); e1.setAttribute('y2',y1); dimStyle(e1); root.appendChild(e1);
        const e2=document.createElementNS(NS,'line'); e2.setAttribute('x1',dimX-tick); e2.setAttribute('y1',y2);
        e2.setAttribute('x2',dimX+tick); e2.setAttribute('y2',y2); dimStyle(e2); root.appendChild(e2);
        const ln=document.createElementNS(NS,'line'); ln.setAttribute('x1',dimX); ln.setAttribute('y1',y1);
        ln.setAttribute('x2',dimX); ln.setAttribute('y2',y2); dimStyle(ln); root.appendChild(ln);
        const t1=document.createElementNS(NS,'polyline');
        t1.setAttribute('points',[[dimX,y1],[dimX-ah,y1+ah],[dimX+ah,y1+ah]].map(p=>p.join(',')).join(' ')); dimStyle(t1); root.appendChild(t1);
        const t2=document.createElementNS(NS,'polyline');
        t2.setAttribute('points',[[dimX,y2],[dimX-ah,y2-ah],[dimX+ah,y2-ah]].map(p=>p.join(',')).join(' ')); dimStyle(t2); root.appendChild(t2);
        const tx=document.createElementNS(NS,'text'); tx.setAttribute('x',dimX-8);
        tx.setAttribute('y',(y1+y2)/2+font*0.35); tx.setAttribute('font-size',font);
        tx.setAttribute('font-family','Arial, sans-serif'); tx.setAttribute('text-anchor','end');
        tx.setAttribute('fill','#6a1b9a'); tx.textContent=label; root.appendChild(tx);
      };
      drawVDim(yBotVW, floorY, `Floor→VW bottom ${Math.round(vwFloor)} mm`);
      drawVDim(yTopVW, yBotVW, `VW height ${Math.round(vh)} mm`);
      const topToCeil=Math.max(0, ceilH - (vwFloor+vh));
      drawVDim(ceilY, yTopVW, `VW top→Ceiling ${Math.round(topToCeil)} mm`);
    }

    // Row 1 base X
    const row1X = x0 + WALL_T + VWG;

    // Row 1 desk + screens
    if(D>0 && deskH>0){
      const d1=document.createElementNS(NS,'rect');
      d1.setAttribute('x',row1X); d1.setAttribute('y',yFromFloor(deskH));
      d1.setAttribute('width',D); d1.setAttribute('height',Math.min(deskH,ceilH));
      d1.setAttribute('fill','#9e9e9e'); d1.setAttribute('stroke','#666');
      d1.setAttribute('stroke-width','1'); d1.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(d1);

      if(Number.isFinite(screensH) && screensH>0){
        const sw=Math.min(110, Math.max(0,D));
        const sh=Math.min(screensH, Math.max(0, ceilH-deskH));
        if(sw>0 && sh>0){
          const scr=document.createElementNS(NS,'rect');
          scr.setAttribute('x',row1X); scr.setAttribute('y',yFromFloor(deskH+sh));
          scr.setAttribute('width',sw); scr.setAttribute('height',sh);
          scr.setAttribute('fill','#3949ab'); scr.setAttribute('stroke','#1a237e');
          scr.setAttribute('stroke-width','1.2'); scr.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(scr);
        }
      }
    }

    // Row 2 (if any)
    if(R===2 && D>0 && deskH>0){
      const row2X=row1X + D + A;
      const d2=document.createElementNS(NS,'rect');
      d2.setAttribute('x',row2X); d2.setAttribute('y',yFromFloor(deskH));
      d2.setAttribute('width',D); d2.setAttribute('height',Math.min(deskH,ceilH));
      d2.setAttribute('fill','#9e9e9e'); d2.setAttribute('stroke','#666');
      d2.setAttribute('stroke-width','1'); d2.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(d2);
    }

    // Eye level line
    if(Number.isFinite(eyeLevel) && eyeLevel>0){
      const ey=yFromFloor(Math.min(eyeLevel,ceilH));
      const line=document.createElementNS(NS,'line');
      line.setAttribute('x1',xLeft+4); line.setAttribute('x2',xRight-4);
      line.setAttribute('y1',ey); line.setAttribute('y2',ey);
      line.setAttribute('stroke','#ef6c00'); line.setAttribute('stroke-dasharray','8 6');
      line.setAttribute('stroke-width','1.4'); line.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(line);

      const et=document.createElementNS(NS,'text');
      et.setAttribute('x',xLeft+8); et.setAttribute('y',ey-4);
      et.setAttribute('font-size',font); et.setAttribute('font-family','Arial, sans-serif');
      et.setAttribute('text-anchor','start'); et.setAttribute('fill','#ef6c00');
      et.textContent=`Eye level ≈ ${Math.round(eyeLevel)} mm`; root.appendChild(et);
    }

    // Operator(s)
    const drawOperator = (deskFrontX) => {
      const NS='http://www.w3.org/2000/svg', C=this._CHAIR, H=this._HUMAN;
      const deskBackX=deskFrontX + D;
      const targetCx=deskBackX + Math.max(0, OPD||0);
      const roomXmin=xLeft + WALL_T + 2, roomXmax=xRight - 2;
      const cx=Math.max(roomXmin + C.seatDepth/2, Math.min(roomXmax - C.seatDepth/2, targetCx));

      // --- Chair: seat ---
      const seatTop=C.seatH, seatY=yFromFloor(seatTop), seatX=cx - C.seatDepth/2;
      const seat=document.createElementNS(NS,'rect');
      seat.setAttribute('x',seatX); seat.setAttribute('y',seatY);
      seat.setAttribute('width',C.seatDepth); seat.setAttribute('height',C.seatThk);
      seat.setAttribute('rx',12); seat.setAttribute('fill','#616161');
      seat.setAttribute('stroke','#424242'); seat.setAttribute('stroke-width','1.2');
      seat.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(seat);

      // --- Central post + round base ---
      const post=document.createElementNS(NS,'rect');
      post.setAttribute('x',cx-8); post.setAttribute('y',yFromFloor(seatTop - C.seatThk) - C.postH);
      post.setAttribute('width',16); post.setAttribute('height',C.postH);
      post.setAttribute('fill','#555'); post.setAttribute('stroke','#3a3a3a');
      post.setAttribute('stroke-width','1'); post.setAttribute('vector-effect','non-scaling-stroke');
      root.appendChild(post);

      const baseY=yFromFloor(seatTop - C.seatThk) - 6;
      const base=document.createElementNS(NS,'ellipse');
      base.setAttribute('cx',cx); base.setAttribute('cy',baseY);
      base.setAttribute('rx',C.baseR); base.setAttribute('ry',C.baseThk);
      base.setAttribute('fill','#4a4a4a'); base.setAttribute('stroke','#2e2e2e');
      base.setAttribute('stroke-width','1.2'); base.setAttribute('vector-effect','non-scaling-stroke');
      root.appendChild(base);

      // --- 5 short spokes + casters (legs) ---
      const spokesDeg = [-70, -20, 0, 20, 70]; // balanced; short so they don't look spidery
      spokesDeg.forEach(deg => {
        const rad = (Math.PI/180)*deg;
        const x2 = cx + Math.cos(rad)*C.spokeL;
        const y2 = baseY + Math.sin(rad)*C.spokeL*0.15; // tiny vertical skew for depth
        const leg=document.createElementNS(NS,'line');
        leg.setAttribute('x1',cx); leg.setAttribute('y1',baseY);
        leg.setAttribute('x2',x2); leg.setAttribute('y2',y2);
        leg.setAttribute('stroke','#3f3f3f'); leg.setAttribute('stroke-width',C.spokeThk);
        leg.setAttribute('stroke-linecap','round'); leg.setAttribute('vector-effect','non-scaling-stroke');
        root.appendChild(leg);

        const caster=document.createElementNS(NS,'circle');
        caster.setAttribute('cx',x2); caster.setAttribute('cy',y2 + C.casterR);
        caster.setAttribute('r',C.casterR);
        caster.setAttribute('fill','#3a3a3a'); root.appendChild(caster);
      });

      // --- Backrest at the **rear edge** of seat, leaning back ---
      const lean=(Math.PI/180)*C.backLeanDeg; // negative => back
      const backTop=seatTop + C.backH;
      const backBottomX = seatX + C.seatDepth - 6;  // hug the back edge of the seat
      const backTopX    = backBottomX - Math.sin(lean)*C.backH;
      const backW = 28; // visual thickness
      const back=document.createElementNS(NS,'path');
      back.setAttribute('d',[
        `M ${backBottomX-backW/2} ${yFromFloor(seatTop)}`,
        `L ${backBottomX+backW/2} ${yFromFloor(seatTop)}`,
        `L ${backTopX+backW/2} ${yFromFloor(backTop)}`,
        `L ${backTopX-backW/2} ${yFromFloor(backTop)}`,
        'Z'
      ].join(' '));
      back.setAttribute('fill','#7a7a7a'); back.setAttribute('stroke','#4f4f4f');
      back.setAttribute('stroke-width','1.2'); back.setAttribute('vector-effect','non-scaling-stroke');
      root.appendChild(back);

      // --- Human silhouette (filled, seated, facing desk) ---
      const Hfill = '#2b2b2b';

      const headR = H.headR;
      let headCenterH = Number.isFinite(eyeLevel) && eyeLevel > 0
        ? Math.max(headR, Math.min(ceilH - headR, eyeLevel))
        : Math.min(ceilH - headR, seatTop + headR * 2);

      const shoulderH = headCenterH - headR - 32;
      const hipH      = seatTop + 22;
      const torsoX    = cx + H.torsoOffX;

      const elbowX = torsoX - 85,  elbowH = shoulderH - 55;
      const handX  = Math.max(x0 + WALL_T + 6, deskFrontX + 8);
      const handH  = Math.min(deskH - 25, shoulderH - 70);

      const hipX   = cx + 36;
      const kneeX  = hipX - 0.92 * H.thighL;
      const kneeH  = hipH  - 0.18 * H.thighL;
      const ankleX = kneeX - 12;
      const ankleH = Math.max(0, kneeH - H.calfL);
      const toeX   = ankleX - H.footL;

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('fill', Hfill);
      g.setAttribute('stroke', 'none');
      root.appendChild(g);

      // Head
      const head = document.createElementNS(NS, 'circle');
      head.setAttribute('cx', torsoX);
      head.setAttribute('cy', yFromFloor(headCenterH));
      head.setAttribute('r', headR);
      g.appendChild(head);

      // Torso capsule
      (()=>{
        const xL = torsoX - 78, xR = torsoX + 68;
        const yTop = yFromFloor(shoulderH);
        const yBot = yFromFloor(hipH);
        const r = 30;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', [
          `M ${xL + r} ${yTop}`,
          `H ${xR - r}`,
          `Q ${xR} ${yTop} ${xR} ${yTop + r}`,
          `V ${yBot - r}`,
          `Q ${xR} ${yBot} ${xR - r} ${yBot}`,
          `H ${xL + r}`,
          `Q ${xL} ${yBot} ${xL} ${yBot - r}`,
          `V ${yTop + r}`,
          `Q ${xL} ${yTop} ${xL + r} ${yTop}`,
          'Z'
        ].join(' '));
        g.appendChild(p);
      })();

      // Arm (compact polygon to desk)
      (()=>{
        const pts = [
          [torsoX - 10,        yFromFloor(shoulderH + 14)],
          [elbowX,             yFromFloor(elbowH + 6)],
          [handX,              yFromFloor(handH + 2)],
          [handX,              yFromFloor(handH - 20)],
          [elbowX + 24,        yFromFloor(elbowH - 18)],
          [torsoX + 12,        yFromFloor(shoulderH)]
        ];
        const arm = document.createElementNS(NS, 'polygon');
        arm.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        g.appendChild(arm);
      })();

      // Thigh
      (()=>{
        const t = 44;
        const pts = [
          [hipX,               yFromFloor(hipH + 8)],
          [kneeX,              yFromFloor(kneeH + 6)],
          [kneeX,              yFromFloor(kneeH - t)],
          [hipX + 26,          yFromFloor(hipH - t)]
        ];
        const thigh = document.createElementNS(NS, 'polygon');
        thigh.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        g.appendChild(thigh);
      })();

      // Calf
      (()=>{
        const t = 34;
        const pts = [
          [kneeX - 6,          yFromFloor(kneeH + 4)],
          [ankleX,             yFromFloor(ankleH + 2)],
          [ankleX - 10,        yFromFloor(ankleH - t)],
          [kneeX + 10,         yFromFloor(kneeH - t)]
        ];
        const calf = document.createElementNS(NS, 'polygon');
        calf.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        g.appendChild(calf);
      })();

      // Foot
      (()=>{
        const h = yFromFloor(ankleH);
        const pts = [
          [ankleX + 2,    h],
          [toeX,          h],
          [toeX + 16,     h + 12],
          [ankleX + 2,    h + 12]
        ];
        const foot = document.createElementNS(NS, 'polygon');
        foot.setAttribute('points', pts.map(p => p.join(',')).join(' '));
        g.appendChild(foot);
      })();

      // VFOV from head center
      if(Number.isFinite(wallH) && wallH>0){
        const vh=Math.min(wallH, Math.max(0, ceilH - vwFloor));
        const yTop=yFromFloor(vwFloor + vh), yBot=yFromFloor(vwFloor);
        const xWall=x0 + WALL_T/2;
        this._drawVFOV(root, cx, yFromFloor(headCenterH), xWall, yTop, yBot);
      }
    };

    // Draw operator(s)
    drawOperator(row1X);
    if(R===2) drawOperator(row1X + D + A);

    // Depth labels
    const addSeg=(x1,x2,t)=>{
      const y = yFromFloor(ceilH) + 40;
      const ln=document.createElementNS(NS,'line');
      ln.setAttribute('x1',x1); ln.setAttribute('x2',x2);
      ln.setAttribute('y1',y); ln.setAttribute('y2',y);
      ln.setAttribute('stroke','#9c27b0'); ln.setAttribute('stroke-width','1.2');
      ln.setAttribute('vector-effect','non-scaling-stroke'); root.appendChild(ln);
      const tx=document.createElementNS(NS,'text');
      tx.setAttribute('x',(x1+x2)/2); tx.setAttribute('y',y+font*1.2);
      tx.setAttribute('font-size',font); tx.setAttribute('font-family','Arial, sans-serif');
      tx.setAttribute('text-anchor','middle'); tx.setAttribute('fill','#6a1b9a'); tx.textContent=t; root.appendChild(tx);
    };
    addSeg(x0+WALL_T, x0+WALL_T+VWG, `VWG ${VWG} mm`);
    addSeg(x0+WALL_T+VWG, x0+WALL_T+VWG+D, `Desk ${D} mm`);
    if(R===2 && A>0){
      addSeg(x0+WALL_T+VWG+D, x0+WALL_T+VWG+D+A, `Aisle ${A} mm`);
      addSeg(x0+WALL_T+VWG+D+A, x0+WALL_T+VWG+D+A+D, `Desk ${D} mm`);
      addSeg(x0+WALL_T+VWG+D+A+D, x0+WALL_T+VWG+D+A+D+backC, `Back ${backC} mm`);
    } else {
      addSeg(x0+WALL_T+VWG+D, x0+WALL_T+VWG+D+backC, `Back ${backC} mm`);
    }

    // Ceiling label
    const tx1=document.createElementNS(NS,'text');
    tx1.setAttribute('x',xRight-6); tx1.setAttribute('y',yFromFloor(ceilH)-4);
    tx1.setAttribute('font-size',font); tx1.setAttribute('font-family','Arial, sans-serif');
    tx1.setAttribute('text-anchor','end'); tx1.setAttribute('fill','#666');
    tx1.textContent=`Ceiling ${Math.round(ceilH)} mm`; root.appendChild(tx1);
  },

  init(){
    const inputs=[
      this.els.ceiling, this.els.vwFloor, this.els.rows, this.els.d, this.els.aisle,
      this.els.backClr, this.els.legacyClr, this.els.vwGap, this.els.deskH,
      this.els.screenIn, this.els.opDist, this.els.eyeLvl
    ];
    inputs.forEach(el=>['input','change'].forEach(ev=>el?.addEventListener(ev,()=>this.compute())));
    window.addEventListener('display:update',(e)=>{ this._disp=e?.detail||null; this.compute(); });
    this.compute();
  }
};

// Boot
MOD.init();
DISP.init();
ERGO.init();
WSE.init();
CR.init();
ELEV.init();

