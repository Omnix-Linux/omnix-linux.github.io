// Hyprland - Omarchy desktop illustration: Waybar, dwindle tiling, the Walker launcher and
// Omarchy's built-in themes. Colors come from Omarchy's MIT-licensed themes/*/colors.toml.
// Runs after desktop-preview.js, which builds the .preview-screen elements.
(function () {
  'use strict';
  var demo = document.querySelector('.desktop-demo');
  if (!demo) return;
  var screens = Array.prototype.slice.call(demo.querySelectorAll('.preview-screen'));
  if (!screens.length) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // [name, mode, background, dark_background, lighter_background, selection, muted, foreground,
  //  bright_foreground, dark_foreground, accent, red, yellow, green, cyan, blue, magenta]
  var THEMES = [["Tokyo Night","dark","#1a1b26","#13141c","#24283b","#292e42","#414868","#a9b1d6","#c0caf5","#565f89","#7aa2f7","#f7768e","#e0af68","#9ece6a","#449dab","#7aa2f7","#ad8ee6"],["Catppuccin","dark","#1e1e2e","#161622","#313244","#45475a","#585b70","#cdd6f4","#cdd6f4","#6c7086","#89b4fa","#f38ba8","#f9e2af","#a6e3a1","#94e2d5","#89b4fa","#f5c2e7"],["Everforest","dark","#2d353b","#21272c","#343f44","#3d484d","#475258","#d3c6aa","#d3c6aa","#4f585e","#7fbbb3","#e67e80","#dbbc7f","#a7c080","#83c092","#7fbbb3","#d699b6"],["Gruvbox","dark","#282828","#1e1e1e","#3c3836","#504945","#665c54","#d4be98","#d4be98","#7c6f64","#7daea3","#ea6962","#d8a657","#a9b665","#89b482","#7daea3","#d3869b"],["Kanagawa","dark","#1f1f28","#17171e","#223249","#363646","#54546D","#dcd7ba","#dcd7ba","#727169","#dcd7ba","#c34043","#c0a36e","#76946a","#6a9589","#7e9cd8","#957fb8"],["Nord","dark","#2e3440","#222730","#3b4252","#434c5e","#4c566a","#d8dee9","#d8dee9","#667080","#81a1c1","#bf616a","#ebcb8b","#a3be8c","#88c0d0","#81a1c1","#b48ead"],["Rosé Pine","light","#faf4ed","#ede7e1","#f2e9e1","#dfdad9","#cecacd","#575279","#575279","#9893a5","#56949f","#b4637a","#ea9d34","#286983","#d7827e","#56949f","#907aa9"],["Matte Black","dark","#121212","#0d0d0d","#1e1e1e","#2a2a2a","#333333","#bebebe","#bebebe","#555555","#e68e0d","#D35F5F","#b91c1c","#FFC107","#bebebe","#e68e0d","#D35F5F"],["Osaka Jade","dark","#111c18","#0c1512","#23372B","#32473B","#53685B","#C1C497","#F7E8B2","#81B8A8","#509475","#FF5345","#459451","#549e6a","#2DD5B7","#509475","#D2689C"],["Ristretto","dark","#2c2525","#211b1b","#3d2f2a","#403e41","#72696a","#e6d9db","#e6d9db","#72696a","#f38d70","#fd6883","#f9cc6c","#adda78","#85dacc","#f38d70","#a8a9eb"],["Catppuccin Latte","light","#eff1f5","#e3e4e8","#dce0e8","#ccd0da","#acb0be","#4c4f69","#4c4f69","#9ca0b0","#1e66f5","#d20f39","#df8e1d","#40a02b","#179299","#1e66f5","#ea76cb"]];
  var VARS = ['bg', 'bg-dark', 'bg-light', 'sel', 'muted', 'fg', 'fg-bright', 'fg-dim', 'accent', 'red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
  var themeIndex = 0;

  var APPS = {
    nvim: { title: 'nvim flake.nix', label: 'Neovim' },
    btop: { title: 'btop', label: 'btop' },
    fetch: { title: 'terminal', label: 'Terminal' },
    ls: { title: 'terminal', label: 'Terminal' },
    term: { title: 'terminal', label: 'Terminal' },
    files: { title: 'Files', label: 'Files' },
    web: { title: 'Chromium', label: 'Chromium' }
  };
  var LAUNCHER = [
    { kind: 'term', name: 'Terminal', hint: 'Super + Enter' },
    { kind: 'nvim', name: 'Neovim', hint: 'Editor' },
    { kind: 'web', name: 'Chromium', hint: 'Web browser' },
    { kind: 'files', name: 'Files', hint: 'File manager' },
    { kind: 'btop', name: 'btop', hint: 'Activity monitor' },
    { kind: 'fetch', name: 'fastfetch', hint: 'System information' },
    { kind: 'themes', name: 'Themes', hint: 'Super + Ctrl + Shift + Space' }
  ];
  var MAX_WINDOWS = 5;

  function esc(text) { return String(text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function span(cls, text) { return '<span class="' + cls + '">' + esc(text) + '</span>'; }
  function prompt(dir, cmd) { return '<div>' + span('o-green', 'omnix') + ' ' + span('o-blue', dir) + ' ' + span('o-magenta', '❯') + ' ' + esc(cmd || '') + '</div>'; }

  var CODE = [
    ['c', '# Your machine: one flake you own'],
    ['', '{'],
    ['', '  inputs = {'],
    ['k', '    nixpkgs.url', '=', 's', '"github:NixOS/nixpkgs/nixos-unstable";'],
    ['k', '    omnix.url', '=', 's', '"github:Omnix-Linux/Omnix";'],
    ['c', '    # Hyprland - Omarchy (stable)'],
    ['k', '    flavor.url', '=', 's', '"github:Omnix-Linux/…";'],
    ['', '  };'],
    ['k', '  outputs', '=', '', '{ nixpkgs, omnix, flavor, ... }: {'],
    ['k', '    nixosConfigurations.omnix', '=', '', 'nixpkgs.lib.nixosSystem {'],
    ['', '      modules = ['],
    ['f', '        omnix.nixosModules.default'],
    ['f', '        flavor.nixosModules.default'],
    ['f', '        ./hardware-configuration.nix'],
    ['', '      ];'],
    ['', '    };'],
    ['', '  };'],
    ['', '}']
  ];
  function renderCode() {
    return CODE.map(function (line, i) {
      var body;
      if (line[0] === 'c') body = span('o-dim', line[1]);
      else if (line[0] === 'k') body = span('o-fg', line[1]) + ' ' + span('o-magenta', line[2]) + ' ' + span(line[3] === 's' ? 'o-green' : 'o-fg', line[4]);
      else if (line[0] === 'f') body = span('o-cyan', line[1]);
      else body = span('o-fg', line[1]);
      return '<div' + (i === 11 ? ' class="o-cursorline"' : '') + '>' + span('o-ln', String(i + 1).padStart(2, ' ')) + ' ' + body + '</div>';
    }).join('');
  }

  var RENDER = {
    nvim: function () {
      var tree = ['  omnix', '  ├ hosts/', '  ├ modules/', '  ├ themes/', '  ├ flake.lock', '  ▸ flake.nix', '  └ README.md'];
      return '<div class="o-nvim"><div class="o-tree">' + span('o-accent', 'Neo-tree') + tree.map(function (t, i) { return '<div' + (i === 5 ? ' class="o-sel"' : '') + '>' + esc(t) + '</div>'; }).join('') +
        '</div><div class="o-code">' + renderCode() + '</div></div>' +
        '<div class="o-status">' + span('o-mode', ' NORMAL ') + ' ' + span('o-fg-dim', ' main  flake.nix') + '<span class="o-grow"></span>' + span('o-fg-dim', 'nix  12:9 ') + '</div>';
    },
    btop: function () {
      var bars = '';
      for (var i = 0; i < 28; i++) bars += '<i style="--h:' + (18 + ((i * 37) % 70)) + '%;--d:' + ((i * 173) % 1200) + 'ms"></i>';
      var procs = [['1287', 'Hyprland', '4.1'], ['1302', 'waybar', '0.8'], ['2210', 'nvim', '0.6'], ['2398', 'chromium', '3.4'], ['2455', 'btop', '0.3']];
      return '<div class="o-btop"><div class="o-box o-cpu"><b>cpu</b><div class="o-graph">' + bars + '</div><div class="o-load">' + span('o-fg-dim', 'Load avg: 0.42 0.51 0.48') + '</div></div>' +
        '<div class="o-box"><b>mem</b>' + ['Used', 'Cache', 'Free'].map(function (k, i) { return '<div class="o-meter">' + esc(k) + '<span style="--v:' + [38, 21, 41][i] + '%"></span></div>'; }).join('') + '</div>' +
        '<div class="o-box"><b>proc</b>' + procs.map(function (p) { return '<div class="o-proc">' + span('o-fg-dim', p[0]) + ' ' + esc(p[1]) + ' ' + span('o-green', p[2]) + '</div>'; }).join('') + '</div></div>';
    },
    fetch: function () {
      var info = [['OS', 'Omnix (NixOS 26.05) x86_64'], ['Kernel', 'Linux 6.18'], ['WM', 'Hyprland'], ['Theme', '<span class="o-theme-name">' + esc(THEMES[themeIndex][0]) + '</span>'], ['Shell', 'bash 5.3'], ['Packages', '1843 (nix-system)'], ['Memory', '12.4 GiB / 62.1 GiB']];
      return prompt('~', 'fastfetch') + '<div class="o-fetch">' + info.map(function (r) { return '<div>' + span('o-accent', r[0]) + ' ' + (r[0] === 'Theme' ? r[1] : esc(r[1])) + '</div>'; }).join('') +
        '<div class="o-swatches"><i class="o-bg-red"></i><i class="o-bg-yellow"></i><i class="o-bg-green"></i><i class="o-bg-cyan"></i><i class="o-bg-blue"></i><i class="o-bg-magenta"></i></div></div>' + prompt('~', '');
    },
    ls: function () {
      var rows = [['drwxr-xr-x', 'hosts/'], ['drwxr-xr-x', 'modules/'], ['drwxr-xr-x', 'themes/'], ['.rw-r--r--', 'flake.lock'], ['.rw-r--r--', 'flake.nix'], ['.rw-r--r--', 'README.md']];
      return prompt('~/omnix', 'eza -l') + rows.map(function (r) { return '<div>' + span('o-fg-dim', r[0]) + ' ' + span(r[1].slice(-1) === '/' ? 'o-blue' : 'o-fg', r[1]) + '</div>'; }).join('') + prompt('~/omnix', 'sudo nixos-rebuild switch') + '<div>' + span('o-green', '✓') + ' activated generation 15</div>' + prompt('~/omnix', '');
    },
    term: function () { return prompt('~', ''); },
    files: function () {
      var places = ['Home', 'Recent', 'Starred', 'Trash'];
      var dirs = ['Desktop', 'Documents', 'Downloads', 'Music', 'Pictures', 'Videos'];
      return '<div class="o-files"><div class="o-places">' + places.map(function (p, i) { return '<div' + (i === 0 ? ' class="o-sel"' : '') + '>' + esc(p) + '</div>'; }).join('') + '</div><div class="o-grid">' +
        dirs.map(function (d) { return '<div><i></i>' + esc(d) + '</div>'; }).join('') + '</div></div>';
    },
    web: function () {
      return '<div class="o-web"><div class="o-url">' + span('o-fg-dim', '⟵ ⟶ ⟳') + ' <span class="o-addr">omnix-linux.com</span></div><div class="o-page"><span class="o-ring"></span><span class="o-word">mnix</span><small>Omnix runs Omarchy on NixOS</small></div></div>';
    }
  };

  // Hyprland's dwindle layout: each new window halves the remaining space along its longer side.
  function dwindle(width, height, count, outer, inner) {
    var rect = { x: outer, y: outer, w: width - outer * 2, h: height - outer * 2 };
    var out = [];
    for (var i = 0; i < count; i++) {
      if (i === count - 1) { out.push(rect); break; }
      if (rect.w >= rect.h) {
        var w = (rect.w - inner) / 2;
        out.push({ x: rect.x, y: rect.y, w: w, h: rect.h });
        rect = { x: rect.x + w + inner, y: rect.y, w: w, h: rect.h };
      } else {
        var h = (rect.h - inner) / 2;
        out.push({ x: rect.x, y: rect.y, w: rect.w, h: h });
        rect = { x: rect.x, y: rect.y + h + inner, w: rect.w, h: h };
      }
    }
    return out;
  }

  var ICONS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4l6 6-3 3V3l3 3-6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 6a9.5 9.5 0 0 1 13 0M4 8.8a6 6 0 0 1 8 0M6.4 11.4a2.5 2.5 0 0 1 3.2 0" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2zM11.5 5.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4.5" width="12" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="3" y="6" width="7" height="4" fill="currentColor"/><path d="M14.5 7v2" stroke="currentColor" stroke-width="1.3"/></svg>';

  // Omarchy's icon (icon.txt in omacom/omarchy), as 27 × 13 cells of a 2:1 character grid.
  var LOGO = '<svg viewBox="0 0 27 13" preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" d="M0 0h27v1h-27zM0 1h2v1h-2zM13 1h2v1h-2zM25 1h2v1h-2zM0 2h2v1h-2zM4 2h11v1h-11zM19 2h4v1h-4zM25 2h2v1h-2zM0 3h2v1h-2zM4 3h2v1h-2zM21 3h2v1h-2zM25 3h2v1h-2zM0 4h2v1h-2zM4 4h2v1h-2zM21 4h2v1h-2zM25 4h2v1h-2zM0 5h2v1h-2zM4 5h2v1h-2zM21 5h2v1h-2zM25 5h2v1h-2zM0 6h6v1h-6zM21 6h2v1h-2zM25 6h2v1h-2zM0 7h2v1h-2zM4 7h2v1h-2zM21 7h2v1h-2zM25 7h2v1h-2zM0 8h2v1h-2zM4 8h2v1h-2zM21 8h2v1h-2zM25 8h2v1h-2zM0 9h2v1h-2zM4 9h2v1h-2zM21 9h2v1h-2zM25 9h2v1h-2zM0 10h2v1h-2zM4 10h19v1h-19zM25 10h2v1h-2zM0 11h2v1h-2zM13 11h2v1h-2zM25 11h2v1h-2zM0 12h15v1h-15zM17 12h10v1h-10z"/></svg>';
  var nextId = 1;
  var desks = [];
  var activeDesk = null;
  var STARTING = [
    { 1: ['nvim', 'btop', 'ls', 'files'], 2: ['web', 'fetch'], 3: [], 4: [], 5: [] },
    { 1: ['btop', 'fetch'], 2: ['web'], 3: [], 4: [], 5: [] }
  ];

  screens.forEach(function (screen, monitor) {
    var desk = document.createElement('div');
    desk.className = 'oma-desk';
    desk.tabIndex = 0;
    desk.setAttribute('role', 'application');
    desk.setAttribute('aria-roledescription', 'Hyprland - Omarchy desktop illustration');
    desk.setAttribute('aria-label', 'Monitor ' + (monitor + 1) + '. Keys: Enter opens a terminal, W closes the focused window, Space opens the launcher, 1 to 5 switch workspaces, arrows move focus, T changes the theme.');
    desk.innerHTML = '<div class="oma-bar"><div class="oma-left"><button type="button" class="oma-logo" aria-label="Open the launcher">' + LOGO + '</button><div class="oma-ws" role="group" aria-label="Workspaces"></div></div><div class="oma-clock"></div><div class="oma-tray">' + ICONS + '</div></div>' +
      '<div class="oma-stage"></div><div class="oma-empty" hidden>Empty workspace<br><kbd>Super</kbd> + <kbd>Enter</kbd> opens a terminal</div>' +
      '<div class="oma-launcher" hidden><input type="text" aria-label="Search applications" placeholder="Search…" autocomplete="off" spellcheck="false"><ul role="listbox" aria-label="Applications"></ul></div>' +
      '<div class="oma-picker" hidden><b>Themes</b><ul role="listbox" aria-label="Themes"></ul></div>' +
      '<div class="oma-toast" role="status" aria-live="polite"></div>';
    screen.appendChild(desk);

    var state = { monitor: monitor, el: desk, stage: desk.querySelector('.oma-stage'), ws: 1, spaces: {}, focus: {} };
    Object.keys(STARTING[monitor] || STARTING[0]).forEach(function (n) {
      state.spaces[n] = (STARTING[monitor] || STARTING[0])[n].map(function (kind) { return { id: nextId++, kind: kind }; });
      state.focus[n] = 0;
    });
    desks.push(state);

    desk.querySelector('.oma-logo').addEventListener('click', function () { setActive(state); openLauncher(state); });
    var wsGroup = desk.querySelector('.oma-ws');
    for (var n = 1; n <= 5; n++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = n;
      b.dataset.ws = n;
      b.setAttribute('aria-label', 'Workspace ' + n);
      b.addEventListener('click', function () { setActive(state); switchWorkspace(state, +this.dataset.ws); });
      wsGroup.appendChild(b);
    }

    desk.addEventListener('pointerdown', function () { setActive(state); });
    desk.addEventListener('focusin', function () { setActive(state); });
    desk.addEventListener('keydown', function (event) { onKey(state, event); });

    var input = desk.querySelector('.oma-launcher input');
    input.addEventListener('input', function () { fillLauncher(state); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation();
        var first = desk.querySelector('.oma-launcher li button');
        if (first) first.click();
      } else if (event.key === 'Escape') { event.stopPropagation(); closeOverlays(state, true); }
      else event.stopPropagation();
    });
    if ('ResizeObserver' in window) new ResizeObserver(function () { layout(state, false); }).observe(state.stage);
    render(state, false);
  });
  activeDesk = desks[0];

  function setActive(state) { activeDesk = state; }
  function windows(state) { return state.spaces[state.ws]; }

  function render(state, animateId) {
    var list = windows(state);
    var stage = state.stage;
    var keep = {};
    list.forEach(function (win) { keep[win.id] = true; });
    Array.prototype.slice.call(stage.children).forEach(function (el) { if (!keep[el.dataset.id] && !el.classList.contains('closing')) el.remove(); });
    list.forEach(function (win, index) {
      var el = stage.querySelector('[data-id="' + win.id + '"]');
      if (!el) {
        el = document.createElement('div');
        el.className = 'oma-win oma-' + win.kind;
        el.dataset.id = win.id;
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', APPS[win.kind].label + ' window');
        el.innerHTML = '<div class="oma-body">' + RENDER[win.kind]() + '</div>';
        el.addEventListener('pointerdown', function () {
          state.focus[state.ws] = windows(state).findIndex(function (w) { return String(w.id) === el.dataset.id; });
          updateFocus(state);
        });
        if (animateId === win.id && !reduceMotion) el.classList.add('opening');
        stage.appendChild(el);
      }
    });
    state.el.querySelector('.oma-empty').hidden = list.length > 0;
    state.el.querySelectorAll('.oma-ws button').forEach(function (b) {
      var n = +b.dataset.ws;
      b.classList.toggle('on', n === state.ws);
      b.classList.toggle('used', state.spaces[n].length > 0);
      b.setAttribute('aria-pressed', String(n === state.ws));
    });
    layout(state, true);
    updateFocus(state);
  }

  function layout(state) {
    var list = windows(state);
    var stage = state.stage;
    var width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    var small = width < 360;
    var rects = dwindle(width, height, list.length, small ? 4 : 6, small ? 3 : 5);
    list.forEach(function (win, index) {
      var el = stage.querySelector('[data-id="' + win.id + '"]');
      if (!el) return;
      var r = rects[index];
      el.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)';
      el.style.width = r.w + 'px';
      el.style.height = r.h + 'px';
    });
  }

  function updateFocus(state) {
    var list = windows(state);
    if (state.focus[state.ws] >= list.length) state.focus[state.ws] = list.length - 1;
    if (state.focus[state.ws] < 0) state.focus[state.ws] = 0;
    state.stage.querySelectorAll('.oma-win').forEach(function (el) {
      var on = list[state.focus[state.ws]] && String(list[state.focus[state.ws]].id) === el.dataset.id;
      el.classList.toggle('focused', !!on);
    });
  }

  function toast(state, text) {
    var t = state.el.querySelector('.oma-toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  function open(state, kind) {
    closeOverlays(state, false);
    if (kind === 'themes') { openPicker(state); return; }
    var list = windows(state);
    if (list.length >= MAX_WINDOWS) { toast(state, 'This preview tiles up to ' + MAX_WINDOWS + ' windows'); return; }
    var win = { id: nextId++, kind: kind };
    var at = Math.min(list.length, state.focus[state.ws] + 1);
    list.splice(at, 0, win);
    state.focus[state.ws] = at;
    render(state, win.id);
  }

  function closeFocused(state) {
    var list = windows(state);
    if (!list.length) return;
    var index = state.focus[state.ws];
    var el = state.stage.querySelector('[data-id="' + list[index].id + '"]');
    list.splice(index, 1);
    state.focus[state.ws] = Math.max(0, index - 1);
    if (el && !reduceMotion) {
      el.classList.add('closing');
      el.dataset.id = 'closing';
      setTimeout(function () { el.remove(); }, 180);
    }
    render(state, false);
  }

  function switchWorkspace(state, n) {
    if (n === state.ws) return;
    closeOverlays(state, false);
    var dir = n > state.ws ? 1 : -1;
    state.stage.replaceChildren();
    state.ws = n;
    state.stage.style.setProperty('--slide', dir * 24 + 'px');
    if (!reduceMotion) { state.stage.classList.remove('sliding'); void state.stage.offsetWidth; state.stage.classList.add('sliding'); }
    render(state, false);
  }

  function moveFocus(state, step) {
    var list = windows(state);
    if (!list.length) return;
    state.focus[state.ws] = (state.focus[state.ws] + step + list.length) % list.length;
    updateFocus(state);
  }

  function fillLauncher(state) {
    var q = state.el.querySelector('.oma-launcher input').value.trim().toLowerCase();
    var ul = state.el.querySelector('.oma-launcher ul');
    ul.replaceChildren();
    LAUNCHER.filter(function (a) { return !q || a.name.toLowerCase().indexOf(q) !== -1 || a.hint.toLowerCase().indexOf(q) !== -1; }).forEach(function (app, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      if (i === 0) li.setAttribute('aria-selected', 'true');
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span>' + esc(app.name) + '</span><small>' + esc(app.hint) + '</small>';
      b.addEventListener('click', function () { open(state, app.kind); state.el.focus(); });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }
  function openLauncher(state) {
    closeOverlays(state, false);
    var launcher = state.el.querySelector('.oma-launcher');
    launcher.hidden = false;
    var input = launcher.querySelector('input');
    input.value = '';
    fillLauncher(state);
    input.focus();
  }
  function openPicker(state) {
    closeOverlays(state, false);
    var picker = state.el.querySelector('.oma-picker');
    var ul = picker.querySelector('ul');
    ul.replaceChildren();
    THEMES.forEach(function (theme, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === themeIndex));
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<i style="background:' + theme[2] + ';border-color:' + theme[10] + '"></i><i style="background:' + theme[10] + '"></i><i style="background:' + theme[16] + '"></i><span>' + esc(theme[0]) + '</span>';
      b.addEventListener('click', function () { applyTheme(i, state); closeOverlays(state, true); });
      li.appendChild(b);
      ul.appendChild(li);
    });
    picker.hidden = false;
    var current = ul.children[themeIndex] && ul.children[themeIndex].querySelector('button');
    if (current) current.focus();
  }
  function closeOverlays(state, refocus) {
    state.el.querySelector('.oma-launcher').hidden = true;
    state.el.querySelector('.oma-picker').hidden = true;
    if (refocus) state.el.focus({ preventScroll: true });
  }

  function applyTheme(index, fromState) {
    themeIndex = (index + THEMES.length) % THEMES.length;
    var theme = THEMES[themeIndex];
    VARS.forEach(function (name, i) { demo.style.setProperty('--o-' + name, theme[i + 2]); });
    demo.dataset.omaMode = theme[1];
    demo.querySelectorAll('.o-theme-name').forEach(function (el) { el.textContent = theme[0]; });
    var button = demo.querySelector('[data-oma-theme]');
    if (button) button.textContent = 'Theme: ' + theme[0];
    if (fromState) toast(fromState, 'Theme: ' + theme[0]);
  }

  function onKey(state, event) {
    if (event.target.tagName === 'INPUT') return;
    var key = event.key;
    var pickerOpen = !state.el.querySelector('.oma-picker').hidden;
    if (key === 'Escape') { closeOverlays(state, true); return; }
    if (pickerOpen) {
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        var items = Array.prototype.slice.call(state.el.querySelectorAll('.oma-picker button'));
        var at = items.indexOf(document.activeElement);
        var next = items[(at + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
        if (next) next.focus();
        event.preventDefault();
      }
      return;
    }
    if (event.target !== state.el) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    var handled = true;
    if (key === 'Enter') open(state, 'term');
    else if (key === 'w' || key === 'W' || key === 'Delete' || key === 'Backspace') closeFocused(state);
    else if (key === ' ') openLauncher(state);
    else if (key === 't' || key === 'T') applyTheme(themeIndex + 1, state);
    else if (/^[1-5]$/.test(key)) switchWorkspace(state, +key);
    else if (key === 'ArrowRight' || key === 'ArrowDown') moveFocus(state, 1);
    else if (key === 'ArrowLeft' || key === 'ArrowUp') moveFocus(state, -1);
    else handled = false;
    if (handled) event.preventDefault();
  }

  // Waybar clock, e.g. "Saturday 17:20".
  function tick() {
    var now = new Date();
    var text = now.toLocaleDateString('en-US', { weekday: 'long' }) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    demo.querySelectorAll('.oma-clock').forEach(function (el) { el.textContent = text; });
  }
  tick();
  setInterval(tick, 30000);

  // Shortcut bar under the monitors. Super is usually taken by the visitor's own OS, so each
  // shortcut is also a button, and plain keys work while a desktop has focus.
  var keys = document.createElement('div');
  keys.className = 'oma-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Hyprland - Omarchy shortcuts');
  [['Enter', 'Terminal', function (s) { open(s, 'term'); }],
   ['Space', 'Launcher', function (s) { openLauncher(s); }],
   ['W', 'Close', function (s) { closeFocused(s); }],
   ['1–5', 'Workspace', function (s) { switchWorkspace(s, s.ws % 5 + 1); }],
   ['Ctrl + Shift + Space', 'Themes', function (s) { openPicker(s); }]].forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<kbd>Super</kbd> + <kbd>' + esc(k[0]) + '</kbd> <span>' + esc(k[1]) + '</span>';
    b.addEventListener('click', function () {
      var s = activeDesk && !activeDesk.el.closest('.preview-screen').hidden ? activeDesk : desks[0];
      k[2](s);
      if (k[1] !== 'Launcher' && k[1] !== 'Themes') s.el.focus({ preventScroll: true });
    });
    keys.appendChild(b);
  });
  var hint = document.createElement('p');
  hint.className = 'oma-hint';
  hint.textContent = 'Click a desktop to use your keyboard: Enter, W, Space, 1–5, arrows, and T to cycle themes.';
  demo.querySelector('.preview-monitors').after(keys, hint);

  applyTheme(0, null);
})();
