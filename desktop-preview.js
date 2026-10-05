(function () {
  'use strict';
  var demo = document.querySelector('.desktop-demo');
  if (!demo) return;
  var monitors = demo.querySelector('.preview-monitors');
  var dockApps = [{"name": "Settings", "icon": "assets/desktop-icons/preferences-system.svg"}, {"name": "Dolphin", "icon": "assets/desktop-icons/org.kde.dolphin.svg"}, {"name": "Brave", "icon": "assets/desktop-icons/brave-browser.png"}, {"name": "Telegram", "icon": "assets/desktop-icons/org.telegram.desktop.png"}, {"name": "Signal", "icon": "assets/desktop-icons/signal-desktop.png"}, {"name": "Slack", "icon": "assets/desktop-icons/slack.png"}, {"name": "Zoom", "icon": null}, {"name": "DBeaver", "icon": "assets/desktop-icons/dbeaver.png"}, {"name": "kitty", "icon": "assets/desktop-icons/kitty.svg"}, {"name": "Sublime Text", "icon": "assets/desktop-icons/sublime-text.png"}, {"name": "Photon Studio", "icon": null}, {"name": "Kdenlive", "icon": "assets/desktop-icons/kdenlive.svg"}, {"name": "HandBrake", "icon": "assets/desktop-icons/fr.handbrake.ghb.svg"}, {"name": "OBS Studio", "icon": "assets/desktop-icons/com.obsproject.Studio.svg"}, {"name": "Docker", "icon": "assets/desktop-icons/docker-tui.svg"}, {"name": "Podman Desktop", "icon": "assets/desktop-icons/podman-desktop.svg"}, {"name": "Docker VM", "icon": null}, {"name": "Boatswain", "icon": "assets/desktop-icons/com.feaneron.Boatswain.svg"}, {"name": "Hermes", "icon": "assets/desktop-icons/pyweb-view.hermes.png"}];
  var names = ['editor', 'build', 'logs', 'shell'];
  for (var monitor = 0; monitor < 2; monitor++) {
    let screen = document.createElement('div');
    screen.className = 'preview-screen';
    screen.hidden = monitor === 1;
    screen.innerHTML = '<div class="desktop-bar"><span>◉ Omnix</span><span>12:34 · ♫ · Wi-Fi</span></div><div class="workspace-stage"></div><div class="desktop-dock"><div class="dock-launchers"></div><button type="button" class="dock-overview" aria-label="Open multi-monitor workspace overview" aria-expanded="false"><img src="assets/desktop-icons/virtual-desktops.svg" alt=""></button><button type="button" class="dock-clock" aria-label="Open calendar" aria-expanded="false">12:34</button></div><div class="preview-calendar" hidden></div><div class="preview-overview" hidden></div><div class="app-preview-notice" role="status"></div><div class="workspace-switcher" aria-label="Monitor ' + (monitor + 1) + ' workspaces"></div>';
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
    var dock = screen.querySelector('.dock-launchers');
    dockApps.forEach(function (app) {
      var launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.title = app.name;
      launcher.setAttribute('aria-label', 'Preview ' + app.name);
      if (app.icon) {
        var icon = document.createElement('img');
        icon.src = app.icon;
        icon.alt = '';
        launcher.appendChild(icon);
      } else { launcher.textContent = app.name.slice(0, 2); }
      launcher.addEventListener('click', function () {
        screen.querySelector('.app-preview-notice').textContent = app.name + ' · launcher preview';
      });
      dock.appendChild(launcher);
    });
    screen.querySelector('.dock-clock').addEventListener('click', function () {
      var calendar = screen.querySelector('.preview-calendar');
      calendar.hidden = !calendar.hidden;
      this.setAttribute('aria-expanded', String(!calendar.hidden));
      if (!calendar.hidden) {
        var now = new Date();
        calendar.replaceChildren();
        var heading = document.createElement('strong');
        heading.textContent = now.toLocaleDateString(undefined, {month:'long', year:'numeric'});
        calendar.appendChild(heading);
        var grid = document.createElement('div');
        grid.className = 'calendar-grid';
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function (day) { var label = document.createElement('span'); label.textContent = day; grid.appendChild(label); });
        var first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
        var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (var date = 0; date < first + days; date++) {
          var cell = document.createElement('span');
          cell.textContent = date < first ? '' : date - first + 1;
          if (date - first + 1 === now.getDate()) cell.className = 'today';
          grid.appendChild(cell);
        }
        calendar.appendChild(grid);
      }
    });
    screen.querySelector('.dock-overview').addEventListener('click', function () {
      var overview = screen.querySelector('.preview-overview');
      overview.hidden = !overview.hidden;
      this.setAttribute('aria-expanded', String(!overview.hidden));
      if (overview.hidden) return;
      overview.replaceChildren();
      Array.from(monitors.children).forEach(function (target, monitorIndex) {
        var heading = document.createElement('strong');
        heading.textContent = 'Monitor ' + (monitorIndex + 1);
        overview.appendChild(heading);
        var grid = document.createElement('div');
        grid.className = 'overview-workspaces';
        target.querySelectorAll('.workspace-switcher button').forEach(function (workspace) {
          var card = document.createElement('button');
          card.type = 'button';
          card.textContent = 'Workspace ' + workspace.textContent;
          card.setAttribute('aria-label', 'Show workspace ' + workspace.textContent + ' on monitor ' + (monitorIndex + 1));
          card.setAttribute('aria-pressed', workspace.getAttribute('aria-pressed'));
          var thumbnail = document.createElement('span');
          thumbnail.className = 'overview-thumbnail';
          for (var tile = 0; tile < 4; tile++) thumbnail.appendChild(document.createElement('i'));
          card.appendChild(thumbnail);
          card.addEventListener('click', function () {
            workspace.click();
            demo.querySelector('[data-monitors]').setAttribute('aria-pressed', 'true');
            monitors.children[1].hidden = false;
            monitors.classList.add('dual');
            overview.hidden = true;
            screen.querySelector('.dock-overview').setAttribute('aria-expanded', 'false');
            workspace.focus();
          });
          grid.appendChild(card);
        });
        overview.appendChild(grid);
      });
    });
    screen.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var overview = screen.querySelector('.preview-overview');
      var calendar = screen.querySelector('.preview-calendar');
      if (overview.contains(document.activeElement)) screen.querySelector('.dock-overview').focus();
      else if (calendar.contains(document.activeElement)) screen.querySelector('.dock-clock').focus();
      screen.querySelectorAll('.preview-calendar,.preview-overview').forEach(function (popup) { popup.hidden = true; });
      screen.querySelectorAll('.dock-clock,.dock-overview').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
    });
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
      ? 'Hyprland tiles every window automatically. Open and close windows, switch workspaces and try Omarchy’s themes.'
      : 'Explore multiple monitors and layered terminal groups. Select a group to bring it forward.';
  }
  updateDesktop();
  document.querySelectorAll('[data-desktop]').forEach(function (button) {
    if (button.tagName !== 'BUTTON') return;
    button.addEventListener('click', function () {
      demo.dataset.desktop = this.dataset.desktop;
      updateDesktop();
      document.querySelectorAll('.desktop-choices button').forEach(function (item) { item.setAttribute('aria-pressed', String(item === this)); }, this);
      demo.querySelector('.preview-caption').textContent = this.dataset.desktop === 'omarchy' ? 'Hyprland - Omarchy · interactive illustration · colors from Omarchy’s themes' : 'KDE Plasma - Atrium · interactive illustration';
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
