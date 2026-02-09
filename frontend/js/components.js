/* ═══════════════════════════════════════════════════════════════
   components.js – React components (no JSX, uses React.createElement)
   KIJ Volleyball Tournament
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  var h = React.createElement;
  var useState   = React.useState;
  var useEffect  = React.useEffect;
  var useRef     = React.useRef;
  var useCallback = React.useCallback;

  // ── Tiny helpers ───────────────────────────────────────────────

  function cls(/* ...args */) {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
  }

  function Toast(props) {
    // props: { message, type }  type = "success" | "error"
    if (!props.message) return null;
    return h('div', { className: props.type === 'error' ? 'error-toast' : 'success-toast' }, props.message);
  }

  // ── StatusBadge ────────────────────────────────────────────────

  function StatusBadge(props) {
    // props: { admin, authenticated }
    var label, variant;
    if (props.admin && props.authenticated) {
      label = '🔑 Administrator Portal';
      variant = 'admin';
    } else if (props.admin && !props.authenticated) {
      label = '🔐 Login Required';
      variant = 'login';
    } else {
      label = '👤 Player Portal';
      variant = 'player';
    }
    return h('div', { className: cls('status-badge', variant) }, label);
  }

  // ── Navigation ─────────────────────────────────────────────────

  function NavBar(props) {
    // props: { page, admin, authenticated, onNav, onAdminToggle }
    var pages = [
      { key: 'home',  label: 'HOME' },
      { key: 'teams', label: 'TEAMS' },
      { key: 'games', label: 'GAMES' },
      { key: 'live',  label: 'LIVE' },
    ];

    var adminLabel = 'ADMIN';
    if (props.admin && props.authenticated) adminLabel = 'LOGOUT';
    else if (props.admin && !props.authenticated) adminLabel = 'LOGIN';

    return h('nav', { className: 'nav-bar' },
      pages.map(function (p) {
        return h('button', {
          key: p.key,
          className: cls('nav-btn', props.page === p.key && 'active'),
          onClick: function () { props.onNav(p.key); }
        }, p.label);
      }),
      h('button', {
        className: cls('nav-btn', props.admin && props.authenticated && 'admin-active'),
        onClick: props.onAdminToggle,
      }, adminLabel)
    );
  }

  

  // ── Home Page ──────────────────────────────────────────────────

  function HomePage(props) {
    return h('div', { className: 'hero' },
      h('h1', { className: 'hero-title' }, 'KIJ Volleyball Tournament'),
      h('div', { style: { marginTop: '2rem' } },
        h('div', { className: 'hero-cta-label' }, 'Ready to Play?'),
        h('button', {
          className: 'btn btn-primary',
          style: { marginTop: '0.5rem', padding: '0.85rem 2.5rem', fontSize: '1.05rem' },
          onClick: function () { props.onNav('games'); }
        }, '🏐 Score a Game')
      )
    );
  }

  // ── Admin Login ────────────────────────────────────────────────

  function AdminLoginPage(props) {
    var _u = useState('');
    var _p = useState('');
    var _e = useState('');
    var username = _u[0], setUsername = _u[1];
    var password = _p[0], setPassword = _p[1];
    var error    = _e[0], setError    = _e[1];

    function submit(e) {
      e.preventDefault();
      setError('');
      Api.login(username, password).then(function () {
        props.onLogin();
      }).catch(function (err) {
        setError(err.message || 'Invalid credentials');
      });
    }

    return h('div', { style: { maxWidth: 400, margin: '4rem auto' } },
      h('div', { className: 'card' },
        h('h2', { className: 'text-center' }, '🔑 Admin Login'),
        h('form', { onSubmit: submit },
          h('div', { className: 'form-group' },
            h('label', null, 'Username'),
            h('input', {
              className: 'form-control',
              value: username,
              onChange: function (e) { setUsername(e.target.value); },
              placeholder: 'Enter admin username'
            })
          ),
          h('div', { className: 'form-group' },
            h('label', null, 'Password'),
            h('input', {
              className: 'form-control',
              type: 'password',
              value: password,
              onChange: function (e) { setPassword(e.target.value); },
              placeholder: 'Enter password'
            })
          ),
          error && h('div', { style: { color: 'var(--red-admin)', fontSize: '0.88rem', marginBottom: '0.75rem' } }, '❌ ' + error),
          h('button', { className: 'btn btn-secondary btn-block', type: 'submit' }, '🚀 Login')
        )
      )
    );
  }

  // ── Teams Page ─────────────────────────────────────────────────

  function TeamsPage(props) {
    // props: { teams, admin, authenticated, onTeamsChanged, showToast }
    var _n  = useState('');
    var _po = useState('A');
    var _confirm = useState(false);
    var teamName = _n[0], setTeamName = _n[1];
    var pool     = _po[0], setPool     = _po[1];
    var confirmReset = _confirm[0], setConfirmReset = _confirm[1];

    function registerTeam(e) {
      e.preventDefault();
      if (!teamName.trim()) return;
      Api.createTeam({ team_name: teamName.trim(), pool: pool }).then(function () {
        props.showToast('Team "' + teamName.trim() + '" registered!', 'success');
        setTeamName('');
        props.onTeamsChanged();
      }).catch(function (err) {
        props.showToast(err.message, 'error');
      });
    }

    function deleteTeam(name) {
      if (!confirm('Delete team "' + name + '"?')) return;
      Api.deleteTeam(name).then(function () {
        props.showToast('Team deleted', 'success');
        props.onTeamsChanged();
      }).catch(function (err) {
        props.showToast(err.message, 'error');
      });
    }

    function doReset() {
      Api.resetTournament().then(function () {
        props.showToast('Tournament reset!', 'success');
        setConfirmReset(false);
        props.onTeamsChanged();
      }).catch(function (err) {
        props.showToast(err.message, 'error');
      });
    }

    var isAdmin = props.admin && props.authenticated;

    // Group teams by pool
    var pools = { A: [], B: [], C: [] };
    Object.keys(props.teams).forEach(function (name) {
      var p = props.teams[name].pool || 'A';
      if (!pools[p]) pools[p] = [];
      pools[p].push(name);
    });

    return h('div', null,
      h('h1', null, 'Team Management'),

      // Admin-only: register + reset
      isAdmin && h('div', null,
        h('h2', null, '📋 Admin View – All Teams'),

        // Reset
        h('details', { className: 'card', style: { marginBottom: '1rem' } },
          h('summary', { style: { cursor: 'pointer', fontWeight: 600, color: 'var(--red-admin)' } }, '⚠️ Tournament Reset'),
          h('p', { className: 'mt-1', style: { fontSize: '0.9rem' } }, 'This will delete ALL teams and games. This cannot be undone!'),
          !confirmReset
            ? h('button', { className: 'btn btn-danger btn-sm mt-1', onClick: function () { setConfirmReset(true); } }, '🗑️ Reset Tournament')
            : h('div', { className: 'mt-1 flex-row' },
                h('button', { className: 'btn btn-danger btn-sm', onClick: doReset }, '✅ Yes, Reset'),
                h('button', { className: 'btn btn-sm', style: { background: '#ccc' }, onClick: function () { setConfirmReset(false); } }, '❌ Cancel')
              )
        ),

        // Register form
        h('div', { className: 'card' },
          h('h3', null, '🆕 Register New Team'),
          Object.keys(props.teams).length >= 15
            ? h('div', { className: 'info-box' }, 'Maximum of 15 teams reached!')
            : h('form', { onSubmit: registerTeam },
                h('div', { className: 'grid-2' },
                  h('div', { className: 'form-group' },
                    h('label', null, 'Team Name'),
                    h('input', {
                      className: 'form-control',
                      value: teamName,
                      onChange: function (e) { setTeamName(e.target.value); },
                      placeholder: 'Enter team name'
                    })
                  ),
                  h('div', { className: 'form-group' },
                    h('label', null, 'Pool'),
                    h('select', { className: 'form-control', value: pool, onChange: function (e) { setPool(e.target.value); } },
                      h('option', { value: 'A' }, 'Pool A'),
                      h('option', { value: 'B' }, 'Pool B'),
                      h('option', { value: 'C' }, 'Pool C')
                    )
                  )
                ),
                h('button', { className: 'btn btn-secondary mt-1', type: 'submit' }, 'Register Team')
              )
        )
      ),

      // Display teams by pool
      Object.keys(props.teams).length === 0
        ? h('div', { className: 'info-box mt-2' }, 'No teams have been registered yet.')
        : h('div', { className: 'mt-2' },
            h('h2', null, 'Registered Teams by Pool'),
            ['A', 'B', 'C'].map(function (p) {
              if (!pools[p] || pools[p].length === 0) return null;
              return h('div', { key: p, className: 'mb-2' },
                h('h3', null, '🏊 Pool ' + p),
                h('div', { className: 'grid-3' },
                  pools[p].map(function (name) {
                    return h('div', { key: name, className: 'team-card' },
                      h('div', { className: 'team-name' }, '🏐 ' + name),
                      h('div', { className: 'pool-label' }, 'Pool ' + p),
                      isAdmin && h('button', {
                        className: 'delete-btn',
                        title: 'Delete team',
                        onClick: function () { deleteTeam(name); }
                      }, '✕')
                    );
                  })
                )
              );
            })
          )
    );
  }

  // ── Games Page ─────────────────────────────────────────────────

  function GamesPage(props) {
    // props: { teams, games, onGamesChanged, showToast }
    var _tab = useState('score'); // "score" | "history"
    var tab = _tab[0], setTab = _tab[1];

    var teamNames = Object.keys(props.teams);

    if (teamNames.length < 2) {
      return h('div', null,
        h('h1', null, 'Game Scoring'),
        h('div', { className: 'info-box' }, 'You need at least 2 teams to create games.'),
        h('button', { className: 'btn btn-primary mt-1', onClick: function () { props.onNav('teams'); } }, 'Go to Teams')
      );
    }

    return h('div', null,
      h('h1', null, 'Game Scoring'),
      h('div', { className: 'flex-row mb-2' },
        h('button', { className: cls('btn btn-sm', tab === 'score' ? 'btn-primary' : 'btn-secondary'), onClick: function () { setTab('score'); } }, '🎮 Score Game'),
        h('button', { className: cls('btn btn-sm', tab === 'history' ? 'btn-primary' : 'btn-secondary'), onClick: function () { setTab('history'); } }, '📋 Game History')
      ),
      tab === 'score'
        ? h(ScoreGamePanel, { teams: props.teams, games: props.games, onGamesChanged: props.onGamesChanged, showToast: props.showToast })
        : h(GameHistoryPanel, { teams: props.teams, games: props.games })
    );
  }

  // ── Score Game Panel ───────────────────────────────────────────

  function ScoreGamePanel(props) {
    var teamNames = Object.keys(props.teams);

    var _t1 = useState(teamNames[0] || '');
    var _t2 = useState(teamNames[1] || '');
    var _gk = useState(null);
    var team1   = _t1[0], setTeam1   = _t1[1];
    var team2   = _t2[0], setTeam2   = _t2[1];
    var gameKey = _gk[0], setGameKey = _gk[1];

    // Filtered list for team2
    var team2Options = teamNames.filter(function (n) { return n !== team1; });

    // If team2 equals team1 after team1 changes, fix it
    useEffect(function () {
      if (team2 === team1 && team2Options.length > 0) setTeam2(team2Options[0]);
    }, [team1]);

    function startGame() {
      if (!team1 || !team2 || team1 === team2) return;
      Api.createGame(team1, team2).then(function (res) {
        setGameKey(res.game_key);
        props.onGamesChanged();
      }).catch(function (err) {
        props.showToast(err.message, 'error');
      });
    }

    function changeScore(setKey, team, delta) {
      Api.updateScore({ game_key: gameKey, set_key: setKey, team: team, delta: delta }).then(function () {
        props.onGamesChanged();
      });
    }

    function finish() {
      Api.completeGame(gameKey).then(function (res) {
        props.showToast('Game completed! Winner: ' + res.winner, 'success');
        setGameKey(null);
        props.onGamesChanged();
      });
    }

    // Active game from props
    var game = gameKey && props.games[gameKey];

    if (!gameKey) {
      // Team selection
      return h('div', null,
        h('h2', null, 'Live Game Scoring'),
        h('div', { className: 'grid-2 mb-2' },
          h('div', { className: 'form-group' },
            h('label', null, 'Team 1'),
            h('select', { className: 'form-control', value: team1, onChange: function (e) { setTeam1(e.target.value); } },
              teamNames.map(function (n) { return h('option', { key: n, value: n }, n); })
            )
          ),
          h('div', { className: 'form-group' },
            h('label', null, 'Team 2'),
            h('select', { className: 'form-control', value: team2, onChange: function (e) { setTeam2(e.target.value); } },
              team2Options.map(function (n) { return h('option', { key: n, value: n }, n); })
            )
          )
        ),
        h('button', { className: 'btn btn-primary', onClick: startGame }, '🏐 Start Game')
      );
    }

    if (!game) {
      return h('div', { className: 'info-box' }, 'Loading game...');
    }

    // Scoring UI
    return h('div', null,
      h('div', { className: 'match-header' },
        h('div', { className: 'vs-text' }, game.team1 + '  vs  ' + game.team2)
      ),

      [1, 2].map(function (setNum) {
        var sk = 'set' + setNum;
        var s = game.sets[sk];
        return h('div', { key: sk },
          h('h3', { className: 'text-center' }, 'Set ' + setNum),
          h('div', { className: 'scoring-row' },
            // Team 1
            h('div', null,
              h('div', { className: 'score-card' },
                h('div', { className: 'team-name' }, game.team1),
                h('div', { className: 'score-display' }, s.team1_score)
              ),
              h('div', { className: 'score-btn-row' },
                h('button', { className: 'btn btn-primary btn-sm', onClick: function () { changeScore(sk, 'team1', 1); } }, '➕ +1'),
                h('button', { className: 'btn btn-sm', style: { background: '#ccc' }, onClick: function () { changeScore(sk, 'team1', -1); } }, '➖ -1')
              )
            ),
            // VS
            h('div', { className: 'vs-text' }, 'VS'),
            // Team 2
            h('div', null,
              h('div', { className: 'score-card' },
                h('div', { className: 'team-name' }, game.team2),
                h('div', { className: 'score-display' }, s.team2_score)
              ),
              h('div', { className: 'score-btn-row' },
                h('button', { className: 'btn btn-primary btn-sm', onClick: function () { changeScore(sk, 'team2', 1); } }, '➕ +1'),
                h('button', { className: 'btn btn-sm', style: { background: '#ccc' }, onClick: function () { changeScore(sk, 'team2', -1); } }, '➖ -1')
              )
            )
          ),
          h('hr', { className: 'section-divider' })
        );
      }),

      h('div', { className: 'text-center mt-2' },
        h('button', { className: 'btn btn-primary', style: { padding: '0.85rem 2.5rem' }, onClick: finish }, '🏁 Complete Game')
      )
    );
  }

  // ── Game History Panel ─────────────────────────────────────────

  function GameHistoryPanel(props) {
    var _open = useState({});
    var openMap = _open[0], setOpenMap = _open[1];

    var completed = {};
    Object.keys(props.games).forEach(function (k) {
      if (props.games[k].completed) completed[k] = props.games[k];
    });

    if (Object.keys(completed).length === 0) {
      return h('div', { className: 'info-box' }, 'No completed games to display.');
    }

    // Group by pool
    var sections = { 'Pool A': [], 'Pool B': [], 'Pool C': [], 'Inter-Pool': [] };
    Object.keys(completed).forEach(function (k) {
      var g = completed[k];
      var p1 = (props.teams[g.team1] || {}).pool || 'A';
      var p2 = (props.teams[g.team2] || {}).pool || 'A';
      if (p1 === p2) sections['Pool ' + p1].push({ key: k, game: g, p1: p1, p2: p2 });
      else sections['Inter-Pool'].push({ key: k, game: g, p1: p1, p2: p2 });
    });

    function toggle(k) {
      setOpenMap(function (prev) {
        var next = Object.assign({}, prev);
        next[k] = !next[k];
        return next;
      });
    }

    return h('div', null,
      h('h2', null, 'Completed Games'),
      ['Pool A', 'Pool B', 'Pool C', 'Inter-Pool'].map(function (sec) {
        if (sections[sec].length === 0) return null;
        return h('div', { key: sec, className: 'mb-2' },
          h('h3', null, sec + ' Games'),
          sections[sec].map(function (item) {
            var g = item.game;
            var isOpen = !!openMap[item.key];
            var title = '🏐 ' + g.team1 + (sec === 'Inter-Pool' ? ' (Pool ' + item.p1 + ')' : '') +
                        ' vs ' + g.team2 + (sec === 'Inter-Pool' ? ' (Pool ' + item.p2 + ')' : '');
            return h('div', { key: item.key, className: cls('game-history-item', isOpen && 'open') },
              h('div', { className: 'game-history-header', onClick: function () { toggle(item.key); } },
                h('span', { className: 'title' }, title),
                h('span', { className: 'winner-badge' }, '🏆 ' + g.winner),
                h('span', { className: 'chevron' }, '▼')
              ),
              h('div', { className: 'game-history-body' },
                [1, 2].map(function (sn) {
                  var sk = 'set' + sn;
                  var s = g.sets[sk];
                  return h('div', { key: sk, className: 'set-line' },
                    'Set ' + sn + ': ' + g.team1 + ' ' + s.team1_score + ' – ' + g.team2 + ' ' + s.team2_score
                  );
                }),
                g.start_time && h('div', { className: 'meta' }, 'Started: ' + new Date(g.start_time).toLocaleString()),
                g.end_time && h('div', { className: 'meta' }, 'Completed: ' + new Date(g.end_time).toLocaleString()),
                h('div', { className: 'meta' }, g.team1 + ': Pool ' + item.p1 + '  |  ' + g.team2 + ': Pool ' + item.p2)
              )
            );
          }),
          h('hr', { className: 'section-divider' })
        );
      })
    );
  }

  // ── Live Scoreboard Page ───────────────────────────────────────

  function LivePage(props) {
    // props: { teams, games }
    var active = {};
    var completedExists = false;

    Object.keys(props.games).forEach(function (k) {
      if (!props.games[k].completed) active[k] = props.games[k];
      else completedExists = true;
    });

    // Standings
    var _standings = useState([]);
    var standings = _standings[0], setStandings = _standings[1];

    useEffect(function () {
      Api.getStandings().then(setStandings).catch(function () {});
    }, [props.games]);

    function refresh() {
      props.onRefresh();
    }

    return h('div', null,
      h('h1', null, h('span', { className: 'live-dot' }), ' LIVE TOURNAMENT SCOREBOARD'),
      h('p', { style: { color: 'var(--gray-sub)', fontSize: '0.9rem', marginBottom: '1rem' } },
        'Real-time updates via WebSocket — scores refresh automatically!'
      ),
      h('div', { className: 'text-center mb-2' },
        h('button', { className: 'btn btn-primary btn-sm', onClick: refresh }, '🔄 Refresh Scores')
      ),

      // Active games
      h('h2', null, '⚡ LIVE GAMES'),
      Object.keys(active).length === 0
        ? h('div', { className: 'info-box' }, 'No games currently in progress.')
        : renderLiveGames(active, props.teams),

      h('hr', { className: 'section-divider' }),

      // Standings
      h('h2', null, '🏆 TOURNAMENT STANDINGS'),
      standings.length === 0
        ? h('div', { className: 'info-box' }, 'No games completed yet — standings will appear after games are played.')
        : h('table', { className: 'standings-table' },
            h('thead', null,
              h('tr', null,
                ['#', 'Team', 'Pool', 'Games', 'Set W', 'Set L', 'Pt Diff'].map(function (col) {
                  return h('th', { key: col }, col);
                })
              )
            ),
            h('tbody', null,
              standings.map(function (s, i) {
                var diff = s.point_differential;
                var diffStr = diff > 0 ? '+' + diff : '' + diff;
                return h('tr', { key: s.team },
                  h('td', null, '#' + (i + 1)),
                  h('td', { style: { fontWeight: 600 } }, s.team),
                  h('td', null, s.pool),
                  h('td', null, s.games_played),
                  h('td', null, s.set_wins),
                  h('td', null, s.set_losses),
                  h('td', { style: { color: diff > 0 ? 'var(--green-leaf)' : diff < 0 ? 'var(--red-admin)' : 'inherit', fontWeight: 600 } }, diffStr)
                );
              })
            )
          )
    );
  }

  function renderLiveGames(active, teams) {
    // Group by pool
    var sections = { A: [], B: [], C: [], 'Inter-Pool': [] };
    Object.keys(active).forEach(function (k) {
      var g = active[k];
      var p1 = (teams[g.team1] || {}).pool || 'A';
      var p2 = (teams[g.team2] || {}).pool || 'A';
      if (p1 === p2) sections[p1].push({ key: k, game: g, p1: p1, p2: p2 });
      else sections['Inter-Pool'].push({ key: k, game: g, p1: p1, p2: p2 });
    });

    return h('div', null,
      ['A', 'B', 'C', 'Inter-Pool'].map(function (sec) {
        if (sections[sec].length === 0) return null;
        var heading = sec === 'Inter-Pool' ? '🔥 Inter-Pool Games — LIVE' : '🏊 Pool ' + sec + ' — LIVE';
        return h('div', { key: sec, className: 'mb-2' },
          h('h3', null, heading),
          sections[sec].map(function (item) {
            var g = item.game;
            return h('div', { key: item.key, className: 'live-game-card' },
              h('div', { className: 'scoring-row', style: { marginBottom: 0 } },
                h('div', { className: 'score-card' },
                  h('div', { className: 'team-name' }, g.team1),
                  sec === 'Inter-Pool' && h('div', { className: 'pool-label' }, 'Pool ' + item.p1)
                ),
                h('div', { className: 'vs-text' }, 'VS'),
                h('div', { className: 'score-card' },
                  h('div', { className: 'team-name' }, g.team2),
                  sec === 'Inter-Pool' && h('div', { className: 'pool-label' }, 'Pool ' + item.p2)
                )
              ),
              h('div', { className: 'set-scores', style: { display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.92rem', color: 'var(--gray-sub)' } },
                [1, 2].map(function (sn) {
                  var sk = 'set' + sn;
                  var s = g.sets[sk];
                  return h('span', { key: sk, style: { fontWeight: 500 } },
                    'Set ' + sn + ': ' + s.team1_score + ' – ' + s.team2_score
                  );
                })
              )
            );
          })
        );
      })
    );
  }

  // ── Expose ─────────────────────────────────────────────────────
  global.Components = {
    Toast: Toast,
    StatusBadge: StatusBadge,
    NavBar: NavBar,
    HomePage: HomePage,
    AdminLoginPage: AdminLoginPage,
    TeamsPage: TeamsPage,
    GamesPage: GamesPage,
    LivePage: LivePage,
  };

})(window);
