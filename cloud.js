/* ELOGA Analytics — camada de nuvem (Supabase) + login com e-mail, senha e autenticador (TOTP).
   A chave abaixo é a chave PÚBLICA (publishable). A proteção dos dados é feita no banco (RLS + MFA aal2). */
(function () {
  const URL_ = 'https://mmrooomaosghzsrcccis.supabase.co';
  const KEY_ = 'sb_publishable_B0qGajsP2tsS6dr5xR713Q_raw6mwyo';
  const sb = window.supabase.createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'eloga-auth' } });

  const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + s.length; };
  const isBlank = c => !(c.meta && (c.meta.company || c.meta.tradeName)) && !(c.agenda || []).length && !Object.keys(c.monthly || {}).length;
  const nameOf = c => (c.meta && (c.meta.tradeName || c.meta.company)) || 'Cliente sem nome';

  const Cloud = {
    sb, user: null, empty: false,
    known: {},          // "clientId|module" -> hash do que está na nuvem
    knownClients: new Set(),
    lastSeen: '',       // maior updated_at conhecido
    pushing: false, pending: false, timer: null,

    /* ---------- Entrada ---------- */
    async boot() {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.currentLevel === 'aal2') { this.user = session.user; this.hideGate(); return; }
      }
      await this.gate(session);
      this.hideGate();
    },
    async logout() { await sb.auth.signOut(); location.reload(); },

    /* ---------- Tela de entrada ---------- */
    el() {
      let g = document.getElementById('cloudGate');
      if (!g) {
        g = document.createElement('div'); g.id = 'cloudGate';
        g.innerHTML = '<style>#cloudGate{position:fixed;inset:0;z-index:99999;background:#0f2f3a;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}#cloudGate .cg{background:#fff;border-radius:14px;max-width:400px;width:100%;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}#cloudGate h2{margin:0 0 4px;font-size:20px;color:#0f2f3a}#cloudGate p{margin:6px 0 14px;font-size:13.5px;color:#4b5b61;line-height:1.5}#cloudGate label{display:block;font-size:12px;font-weight:600;color:#33474f;margin:12px 0 4px}#cloudGate input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #c5d1d5;border-radius:8px;font-size:15px}#cloudGate button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:8px;background:#0f6b7a;color:#fff;font-size:15px;font-weight:600;cursor:pointer}#cloudGate button.lk{background:none;color:#0f6b7a;font-size:13px;font-weight:500;margin-top:8px;padding:6px}#cloudGate .er{color:#b3261e;font-size:13px;margin-top:10px;min-height:16px}#cloudGate .qr{text-align:center;margin:8px 0}#cloudGate .qr img{width:190px;height:190px}#cloudGate code{display:block;word-break:break-all;background:#eef2f3;padding:8px;border-radius:6px;font-size:12px;margin-top:6px}#cloudGate .tt{font-size:11px;letter-spacing:.12em;color:#0f6b7a;font-weight:700;margin-bottom:10px}</style><div class="cg" id="cgBody"></div>';
        document.body.appendChild(g);
      }
      g.style.display = 'flex'; return document.getElementById('cgBody');
    },
    hideGate() { const g = document.getElementById('cloudGate'); if (g) g.style.display = 'none'; },
    async gate(session) {
      for (;;) {
        try {
          if (!session) session = await this.askLogin();
          const { data: f } = await sb.auth.mfa.listFactors();
          const ok = (f && f.totp || []).find(x => x.status === 'verified');
          if (ok) await this.askCode(ok.id); else await this.enroll(f);
          const { data: s } = await sb.auth.getSession(); this.user = s.session.user; return;
        } catch (e) { session = (await sb.auth.getSession()).data.session; }
      }
    },
    askLogin() {
      return new Promise(res => {
        const b = this.el(); let signup = false;
        const draw = (err) => {
          b.innerHTML = `<div class="tt">ELOGA ANALYTICS</div><h2>${signup ? 'Primeiro acesso' : 'Entrar'}</h2><p>${signup ? 'Crie a conta de administradora. Só o primeiro cadastro recebe acesso.' : 'Acesso restrito à gestão ELOGA.'}</p><label>E-mail</label><input id="cgE" type="email" autocomplete="username"><label>Senha</label><input id="cgP" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}"><div class="er" id="cgR">${err || ''}</div><button id="cgB">${signup ? 'Criar conta' : 'Entrar'}</button><button class="lk" id="cgT">${signup ? 'Já tenho conta' : 'Primeiro acesso (criar conta)'}</button>`;
          b.querySelector('#cgT').onclick = () => { signup = !signup; draw(); };
          const go = async () => {
            const email = b.querySelector('#cgE').value.trim(), pw = b.querySelector('#cgP').value, r = b.querySelector('#cgR');
            if (!email || pw.length < 8) { r.textContent = 'Informe o e-mail e uma senha com no mínimo 8 caracteres.'; return; }
            r.textContent = 'Aguarde...';
            if (signup) {
              const { data, error } = await sb.auth.signUp({ email, password: pw });
              if (error) { r.textContent = error.message; return; }
              if (!data.session) { r.textContent = 'Conta criada. Confirme pelo e-mail recebido e depois entre.'; signup = false; setTimeout(() => draw('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.'), 50); return; }
              return res(data.session);
            }
            const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
            if (error) { r.textContent = error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message; return; }
            res(data.session);
          };
          b.querySelector('#cgB').onclick = go;
          b.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
        };
        draw();
      });
    },
    askCode(factorId) {
      return new Promise((res, rej) => {
        const b = this.el();
        b.innerHTML = `<div class="tt">ELOGA ANALYTICS</div><h2>Código do autenticador</h2><p>Abra o aplicativo autenticador no celular e digite o código de 6 dígitos.</p><label>Código</label><input id="cgC" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><div class="er" id="cgR"></div><button id="cgB">Confirmar</button><button class="lk" id="cgX">Sair</button>`;
        b.querySelector('#cgX').onclick = async () => { await sb.auth.signOut(); rej(new Error('sair')); };
        const go = async () => {
          const code = b.querySelector('#cgC').value.trim(), r = b.querySelector('#cgR'); r.textContent = 'Verificando...';
          const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
          if (error) { r.textContent = 'Código inválido ou expirado. Tente o próximo código.'; return; }
          res();
        };
        b.querySelector('#cgB').onclick = go; b.querySelector('#cgC').onkeydown = e => { if (e.key === 'Enter') go(); }; b.querySelector('#cgC').focus();
      });
    },
    async enroll(f) {
      for (const x of (f && f.all || [])) if (x.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: x.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ELOGA ' + Date.now() });
      if (error) throw error;
      const b = this.el();
      return new Promise((res) => {
        b.innerHTML = `<div class="tt">ELOGA ANALYTICS</div><h2>Ativar autenticador</h2><p>1) No celular, abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy) e escaneie o QR code.<br>2) Digite o código de 6 dígitos que aparecer.</p><div class="qr"><img alt="QR code" src="${data.totp.qr_code}"></div><p><b>Guarde esta chave secreta</b> em local seguro: ela recupera o acesso se você perder o celular.<code>${data.totp.secret}</code></p><label>Código</label><input id="cgC" inputmode="numeric" maxlength="6"><div class="er" id="cgR"></div><button id="cgB">Ativar e entrar</button>`;
        const go = async () => {
          const code = b.querySelector('#cgC').value.trim(), r = b.querySelector('#cgR'); r.textContent = 'Verificando...';
          const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code });
          if (e2) { r.textContent = 'Código inválido. Confira o horário do celular e tente de novo.'; return; }
          res();
        };
        b.querySelector('#cgB').onclick = go; b.querySelector('#cgC').onkeydown = e => { if (e.key === 'Enter') go(); };
      });
    },

    /* ---------- Leitura ---------- */
    async load() {
      const [cl, cm, em] = await Promise.all([
        sb.from('clients').select('id,updated_at'),
        sb.from('client_modules').select('client_id,module,data,updated_at'),
        sb.from('eloga_modules').select('module,data,updated_at')
      ]);
      for (const r of [cl, cm, em]) if (r.error) throw r.error;
      const parts = {};
      for (const r of cm.data) { (parts[r.client_id] = parts[r.client_id] || {})[r.module] = r.data; this.known[r.client_id + '|' + r.module] = hash(JSON.stringify(r.data)); this.bump(r.updated_at); }
      const clients = {};
      for (const c of cl.data) {
        const p = parts[c.id]; this.knownClients.add(c.id); this.bump(c.updated_at);
        if (!p || !p.core) continue;
        clients[c.id] = Object.assign({}, p.core, { agenda: p.agenda || [], detail: p.detail || { attend: [], denials: [] } });
      }
      const mods = {}; for (const r of em.data) { mods[r.module] = r.data; this.known['eloga|' + r.module] = hash(JSON.stringify(r.data)); this.bump(r.updated_at); }
      this.empty = !Object.keys(clients).length && !mods.eloga && !mods.settings;
      if (this.empty) return null;
      let current = null; try { current = localStorage.getItem('eloga_current'); } catch (e) {}
      return { clients, current, settings: mods.settings || {}, eloga: mods.eloga || {} };
    },
    bump(t) { if (t && t > this.lastSeen) this.lastSeen = t; },

    /* ---------- Gravação ---------- */
    schedule(DB, now) { this.dbRef = DB; this.badge('Salvando...', ''); clearTimeout(this.timer); if (now) this.push(); else this.timer = setTimeout(() => this.push(), 1200); },
    badge(t, cls) { const b = document.getElementById('saveBadge'); if (b) { b.textContent = t; b.className = 'savebadge ' + (cls || ''); } },
    async push() {
      if (this.pushing) { this.pending = true; return; }
      this.pushing = true;
      try {
        const DB = this.dbRef; if (!DB) return;
        try { localStorage.setItem('eloga_current', DB.current || ''); } catch (e) {}
        const now = new Date().toISOString(), jobs = [];
        const add = (table, row, key, json) => { const h = hash(json); if (this.known[key] !== h) jobs.push({ table, row, key, h }); };
        const ids = new Set();
        for (const c of Object.values(DB.clients)) {
          if (isBlank(c)) continue; ids.add(c.id);
          const { agenda, detail, ...core } = c;
          if (!this.knownClients.has(c.id)) jobs.push({ table: 'clients', row: { id: c.id, name: nameOf(c), updated_at: now }, key: 'c|' + c.id, h: '' });
          for (const [m, d] of [['core', core], ['agenda', agenda || []], ['detail', detail || {}]]) add('client_modules', { client_id: c.id, module: m, data: d, updated_at: now }, c.id + '|' + m, JSON.stringify(d));
        }
        for (const [m, d] of [['settings', DB.settings || {}], ['eloga', DB.eloga || {}]]) add('eloga_modules', { module: m, data: d, updated_at: now }, 'eloga|' + m, JSON.stringify(d));
        // clientes de clientes (nome) atualizados junto do core
        for (const j of jobs) if (j.table === 'client_modules' && j.row.module === 'core') { const c = DB.clients[j.row.client_id]; await this.up('clients', { id: c.id, name: nameOf(c), updated_at: now }); this.knownClients.add(c.id); }
        for (const j of jobs) {
          if (j.table === 'clients') { await this.up('clients', j.row); this.knownClients.add(j.row.id); continue; }
          await this.up(j.table, j.row); this.known[j.key] = j.h;
        }
        if (ids.size) for (const id of [...this.knownClients]) if (!ids.has(id) && !Object.values(DB.clients).some(c => c.id === id && isBlank(c))) {
          const { error } = await sb.from('clients').delete().eq('id', id); if (error) throw error; this.knownClients.delete(id);
          for (const k of Object.keys(this.known)) if (k.startsWith(id + '|')) delete this.known[k];
        }
        this.bump(now); this.badge('Salvo na nuvem', 'ok');
      } catch (e) {
        console.warn('nuvem', e); this.badge('Não salvo: verifique a conexão', 'err');
        if (e && (e.code === 'PGRST301' || /JWT|row-level/i.test(e.message || ''))) this.badge('Sessão expirou: entre novamente', 'err');
      } finally { this.pushing = false; if (this.pending) { this.pending = false; this.push(); } }
    },
    async up(table, row) {
      const conflict = table === 'clients' ? 'id' : table === 'client_modules' ? 'client_id,module' : 'module';
      const { error } = await sb.from(table).upsert(row, { onConflict: conflict }); if (error) throw error;
    },

    /* ---------- Alterações em outro aparelho ---------- */
    async watch() {
      const check = async () => {
        if (document.hidden || this.pushing) return;
        const q = await Promise.all([sb.from('client_modules').select('updated_at').order('updated_at', { ascending: false }).limit(1), sb.from('eloga_modules').select('updated_at').order('updated_at', { ascending: false }).limit(1)]);
        const t = q.map(r => (r.data && r.data[0] && r.data[0].updated_at) || '').sort().pop();
        if (t && t > this.lastSeen && !document.getElementById('cgNew')) {
          const d = document.createElement('div'); d.id = 'cgNew';
          d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#0f2f3a;color:#fff;padding:12px 16px;border-radius:10px;z-index:9999;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.3)';
          d.innerHTML = 'Há alterações mais recentes salvas em outro aparelho. <button style="margin-left:10px;padding:6px 12px;border:0;border-radius:6px;background:#2fb6c4;color:#04252c;font-weight:700;cursor:pointer">Atualizar</button>';
          d.querySelector('button').onclick = () => location.reload(); document.body.appendChild(d);
        }
      };
      document.addEventListener('visibilitychange', check); setInterval(check, 60000);
    }
  };
  window.Cloud = Cloud;
})();
