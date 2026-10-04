(function () {
  'use strict';
  var demo = document.querySelector('.desktop-demo');
  if (!demo) return;
  var monitors = demo.querySelector('.preview-monitors');
  var names = ['editor', 'build', 'logs', 'shell'];
  for (var monitor = 0; monitor < 2; monitor++) {
    var screen = document.createElement('div');
    screen.className = 'preview-screen';
    screen.hidden = monitor === 1;
    screen.innerHTML = '<div class="desktop-bar"><span>◉ Omnix</span><span>12:34 · ♫ · Wi-Fi</span></div><div class="workspace-stage"></div><div class="desktop-dock">▣ &nbsp; ◉ &nbsp; ▤ &nbsp; ⚙</div><div class="workspace-switcher" aria-label="Monitor ' + (monitor + 1) + ' workspaces"></div>';
    var stage = screen.querySelector('.workspace-stage');
    for (var group = 0; group < 2; group++) {
      var layer = document.createElement('button');
      layer.type = 'button';
      layer.className = 'terminal-group ' + (group === 0 ? 'front' : 'back');
      layer.setAttribute('aria-label', 'Bring terminal group ' + (group + 1) + ' forward on monitor ' + (monitor + 1));
      layer.setAttribute('aria-pressed', String(group === 0));
      var title = document.createElement('span');
      title.className = 'group-title';
      title.textContent = 'kitty / tmux · group ' + (group + 1);
      layer.appendChild(title);
      var panes = document.createElement('span');
      panes.className = 'terminal-panes';
      names.forEach(function (name, index) {
        var pane = document.createElement('span');
        pane.innerHTML = '<b>' + name + '</b><br><span class="prompt">~/omnix $</span><br>' + ['nvim flake.nix', 'nix build', 'journalctl -f', 'tmux attach'][index] + '<br><span class="terminal-output">' + ['{ inputs = { … }; }', '✓ configuration built', 'system ready', '▌'][index] + '</span>';
        panes.appendChild(pane);
      });
      layer.appendChild(panes);
      layer.addEventListener('click', function () {
        Array.from(this.parentElement.children).forEach(function (item) {
          var active = item === this;
          item.classList.toggle('front', active);
          item.classList.toggle('back', !active);
          item.setAttribute('aria-pressed', String(active));
        }, this);
      });
      stage.appendChild(layer);
    }
    var switcher = screen.querySelector('.workspace-switcher');
    for (var workspace = 1; workspace <= 4; workspace++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = workspace;
      button.setAttribute('aria-label', 'Workspace ' + workspace + ' on monitor ' + (monitor + 1));
      button.setAttribute('aria-pressed', String(workspace === 1));
      button.addEventListener('click', function () {
        Array.from(this.parentElement.children).forEach(function (item) { item.setAttribute('aria-pressed', String(item === this)); }, this);
        this.closest('.preview-screen').querySelectorAll('.group-title').forEach(function (title, index) { title.textContent = 'kitty / tmux · workspace ' + this.textContent + ' · group ' + (index + 1); }, this);
      });
      switcher.appendChild(button);
    }
    monitors.appendChild(screen);
  }
  function updateDesktop() {
    var tiled = demo.dataset.desktop === 'omarchy';
    demo.querySelector('[data-depth]').hidden = tiled;
    demo.querySelectorAll('.terminal-group').forEach(function (group, index) {
      group.hidden = tiled && index % 2 === 1;
      group.disabled = tiled;
      if (tiled) {
        group.removeAttribute('aria-pressed');
        group.setAttribute('aria-label', 'Tiled kitty / tmux terminal panes');
      } else {
        group.setAttribute('aria-pressed', String(group.classList.contains('front')));
        group.setAttribute('aria-label', 'Bring terminal group ' + (index % 2 + 1) + ' forward on monitor ' + (Math.floor(index / 2) + 1));
      }
    });
    document.querySelector('.preview-description').textContent = tiled
      ? 'Hyprland tiles windows on a single plane. Explore workspaces across one or two monitors.'
      : 'Explore multiple monitors and layered terminal groups. Select a group to bring it forward.';
  }
  updateDesktop();
  document.querySelectorAll('[data-desktop]').forEach(function (button) {
    if (button.tagName !== 'BUTTON') return;
    button.addEventListener('click', function () {
      demo.dataset.desktop = this.dataset.desktop;
      updateDesktop();
      document.querySelectorAll('.desktop-choices button').forEach(function (item) { item.setAttribute('aria-pressed', String(item === this)); }, this);
      demo.querySelector('.preview-caption').textContent = this.dataset.desktop === 'omarchy' ? 'Hyprland - Omarchy · interactive illustration' : 'KDE Plasma - Atrium · interactive illustration';
    });
  });
  demo.querySelector('[data-monitors]').addEventListener('click', function () {
    var active = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(active));
    monitors.children[1].hidden = !active;
    monitors.classList.toggle('dual', active);
  });
  demo.querySelector('[data-depth]').addEventListener('click', function () {
    var active = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(active));
    demo.classList.toggle('flat', !active);
  });
})();
