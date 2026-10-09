/* ELOGA Analytics — gerenciador de importações: excluir arquivo, arquivo com mais de um tipo,
   importar dentro de cada aba e lista de pacientes ao clicar nos números. */
(function () {
  'use strict';
  const TYPE_N = { agenda: 'Agenda', tabela: 'Tabela de procedimentos', part: 'Controle do particular', fat: 'Faturamento enviado', dem: 'Demonstrativo de análise', receb: 'Recebimentos', recurso: 'Extrato de recurso', attend: 'Atendimentos', denials: 'Glosas', mensal: 'Planilha mensal', lanc: 'Lançamentos', aut: 'Autorizações', kit: 'Kit', mkt: 'Marketing', espera: 'Lista de espera' };
  const brd = d => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch (e) { return ''; } };

  /* ---------- 1. Arquivos importados ---------- */
  function table(types) {
    const list = (S.imports || []).filter(i => !types || types.includes(i.type));
    if (!list.length) return `<div class="card c12" style="grid-column:1/-1"><h3>Arquivos importados</h3><p class="muted">Nenhum arquivo importado ainda.</p></div>`;
    return `<div class="card c12" style="grid-column:1/-1"><h3>Arquivos importados</h3><p class="muted">Excluir um arquivo remove das análises os dados que vieram dele.</p>
      <div class="tscroll" style="width:100%"><table class="tbl sm" style="width:100%"><thead><tr><th>Data</th><th>Tipo</th><th>Arquivo</th><th>Registros</th><th>Observação</th><th></th></tr></thead><tbody>
      ${list.slice(0, 60).map(i => `<tr><td>${brd(i.date)}</td><td>${esc(TYPE_N[i.type] || i.type)}</td><td>${esc(i.file || '—')}</td><td class="num">${fmtNum(i.count || 0)}</td><td>${esc(i.note || '')}</td><td><button class="btn ghost sm" onclick="ImpMgr.del('${i.id || ''}','${S.imports.indexOf(i)}')">Excluir</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  function del(id, idx) {
    let imp = id ? S.imports.find(i => i.id === id) : null; if (!imp) imp = S.imports[+idx]; if (!imp) return;
    const t = imp.type; let removed = 0; const msg0 = `Excluir "${imp.file || TYPE_N[t] || t}" (${imp.count || 0} registros)?\nOs dados vinculados a este arquivo serão removidos das análises.`;
    const noAuto = ['mensal', 'lanc', 'kit', 'aut', 'mkt', 'recurso', 'espera'];
    if (noAuto.includes(t)) return toast('Este tipo de importação grava valores mesclados e não pode ser desfeito automaticamente. Ajuste os valores diretamente na tela correspondente.', 'bad');
    if (!confirm(msg0)) return;
    if (t === 'agenda') {
      const n0 = S.agenda.length; S.agenda = S.agenda.filter(r => r.s !== imp.id); removed = n0 - S.agenda.length;
      if (!removed) { const m = String(imp.note || '').match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2})\/(\d{2})\/(\d{4})/);
        if (m && confirm('Importação anterior sem marcação: remover toda a agenda do período ' + m[0] + '?')) { const a = `${m[3]}-${m[2]}-${m[1]}`, b = `${m[6]}-${m[5]}-${m[4]}`; S.agenda = S.agenda.filter(r => r.d < a || r.d > b); removed = n0 - S.agenda.length; } else if (!m) return toast('Importação antiga sem identificação: não foi possível separar os registros.', 'bad'); }
      _cut = null;
    } else if (t === 'tabela') { const n0 = S.cad.table.length; S.cad.table = S.cad.table.filter(x => x.s !== imp.id); removed = n0 - S.cad.table.length; if (!removed) return toast('Importação antiga sem identificação: não foi possível separar os registros.', 'bad'); }
    else if (t === 'part') { const n0 = S.part.length; S.part = S.part.filter(x => x.s !== imp.id); removed = n0 - S.part.length; if (!removed) return toast('Importação antiga sem identificação: não foi possível separar os registros.', 'bad'); }
    else if (t === 'fat' || t === 'dem') { const k = t === 'fat' ? 'fat' : 'dem'; const n0 = S[k].length; S[k] = S[k].filter(b => b.id !== imp.id); if (S[k].length === n0 && imp.file) S[k] = S[k].filter(b => b.file !== imp.file); removed = n0 - S[k].length; if (!removed) return toast('Lote não encontrado.', 'bad'); }
    else if (t === 'receb') { S.fat.concat(S.dem).forEach(b => { const n0 = (b.pays || []).length; b.pays = (b.pays || []).filter(p => p.s !== imp.id); removed += n0 - b.pays.length; }); if (!removed) return toast('Importação antiga sem identificação: remova os pagamentos na tela de lotes.', 'bad'); }
    else if (t === 'attend' || t === 'denials') { const n0 = (S.detail[t] || []).length; S.detail[t] = (S.detail[t] || []).filter(x => x.s !== imp.id); removed = n0 - S.detail[t].length; if (!removed) return toast('Importação antiga sem identificação: use "Apagar todos os registros deste tipo".', 'bad'); }
    else return toast('Este tipo não pode ser excluído automaticamente.', 'bad');
    S.imports = S.imports.filter(i => i !== imp);
    resetAll(); toast(`Arquivo excluído: ${removed.toLocaleString('pt-BR')} registro(s) removidos das análises.`, 'good'); show(PAGE);
  }

  function commitReceb() {
    const id = uid(); SIMP.out.forEach(x => x.b.pays.push({ d: x.d, v: x.v, obs: 'Importado', s: id }));
    logImport('receb', SIMP.out.length, 'Pagamentos vinculados', id); resetAll(); SIMP = null; show('fat'); toast('Pagamentos vinculados.', 'good');
  }

  /* ---------- 2. Arquivo com mais de um tipo (faturamento + demonstrativo) ---------- */
  function also(on) {
    const box = document.getElementById('alsoMap'); if (!box) return;
    if (!on) { SIMP.also = null; SIMP.map2 = null; box.innerHTML = ''; return; }
    const other = SIMP.kind === 'fat' ? 'dem' : 'fat'; SIMP.also = other; SIMP.map2 = autoMap(KINDS[other].fields, SIMP.headers);
    const opts = cur => `<option value="">— não tem —</option>` + SIMP.headers.map(h => `<option ${h === cur ? 'selected' : ''} value="${esc(h)}">${esc(h)}</option>`).join('');
    box.innerHTML = `<p class="muted">Indique em que coluna está cada informação de <b>${esc(KINDS[other].n)}</b> (as já reconhecidas vêm marcadas):</p>
      <div class="mapgrid">${KINDS[other].fields.map(f => `<div class="map ${SIMP.map2[f.k] ? 'hit' : ''}"><b>${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</b><select onchange="SIMP.map2['${f.k}']=this.value;this.parentElement.classList.toggle('hit',!!this.value)">${opts(SIMP.map2[f.k])}</select></div>`).join('')}</div>`;
  }
  const _batchForm = window.batchForm;
  window.batchForm = function () {
    _batchForm(); if (!SIMP) return;
    const row = workBox().querySelector('.row.end'); if (!row) return;
    const other = SIMP.kind === 'fat' ? 'demonstrativo de análise' : 'faturamento enviado';
    row.insertAdjacentHTML('beforebegin', `<div class="notice"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" onchange="ImpMgr.also(this.checked)"> <span>Este arquivo <b>também contém ${other}</b> (ex.: valor apresentado e glosa na mesma planilha)</span></label><div id="alsoMap"></div></div>`);
  };

  /* ---------- 3. Importar dentro de cada aba ---------- */
  const BARS = {
    agenda: [['Importar agenda', "smartImport('agenda')"], ['Importar lista de espera', 'AgAdv.importEspera()']],
    ciclo: [['Faturamento enviado', "smartImport('fat')"], ['Demonstrativo de análise', "smartImport('dem')"], ['Recebimentos', "smartImport('receb')"], ['Extrato de recurso', 'recImport()']],
    prod: [['Agenda', "smartImport('agenda')"], ['Planilha mensal', "show('importar');startImport('mensal')"]],
    rent: [['Agenda', "smartImport('agenda')"], ['Planilha mensal', "show('importar');startImport('mensal')"], ['Lançamentos', "show('importar');startImport('lanc')"]],
    caixa: [['Agenda', "smartImport('agenda')"], ['Controle do particular', "smartImport('part')"], ['Planilha mensal', "show('importar');startImport('mensal')"], ['Lançamentos', "show('importar');startImport('lanc')"]]
  };
  function bar(page) {
    const sec = document.getElementById('pg_' + page); if (!sec || !BARS[page]) return;
    sec.querySelectorAll('.impbar').forEach(e => e.remove());
    const tabs = (page === 'agenda' || page === 'prod') ? `<div class="subtabs" style="margin-bottom:10px"><button class="${page === 'agenda' ? 'active' : ''}" onclick="show('agenda')">Agenda e atendimentos</button><button class="${page === 'prod' ? 'active' : ''}" onclick="show('prod')">Produção e resultado financeiro</button></div>` : '';
    const html = `<div class="card impbar">${tabs}<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><b>Importar nesta aba:</b>${BARS[page].map(([l, f]) => `<button class="btn ghost sm" onclick="${f}">${l}</button>`).join('')}<a href="#" class="muted" onclick="show('importar');return false">Ver arquivos importados</a></div></div>`;
    const after = sec.querySelector('details.period') || sec.querySelector('.phead'); if (after) after.insertAdjacentHTML('afterend', html); else sec.insertAdjacentHTML('afterbegin', html);
  }
  const FN = { agenda: 'renderAgenda', ciclo: 'renderCiclo', prod: 'renderProd', rent: 'renderRent', caixa: 'renderCaixa' };
  Object.entries(FN).forEach(([page, name]) => {
    const orig = window[name]; if (typeof orig !== 'function') return;
    const w = function () { const r = orig.apply(this, arguments); try { bar(page); } catch (e) { console.error(e); } return r; };
    window[name] = w; RENDER[page] = page === 'agenda' ? (() => window.renderAgenda()) : w;
  });

  /* ---------- 4. Lista de pacientes ao clicar nos números ---------- */
  const css = document.createElement('style');
  css.textContent = '.impbar{padding:10px 14px}.drOv{position:fixed;inset:0;background:#011c2799;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}.drBox{background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px #0006}.drBox header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #dce4e7}.drBox header h3{margin:0;font-size:16px}.drBody{overflow:auto;padding:12px 18px 18px}';
  document.head.appendChild(css);

  function drill(key, m) {
    const F = agFilter(); const UO = AgUn.mk(); const RG = agRange();
    const dimOK = r => (!F.prof || r.prof === F.prof) && (!F.esp || r.esp === F.esp) && (!F.proc || r.proc === F.proc) && (!F.payer || r.payer === F.payer) && (!F.unit || UO(r) === F.unit);
    const base = S.agenda.filter(dimOK); let title = '', head = '', body = '', n = 0;
    if (key.startsWith('k:')) {
      const kd = key.slice(2); const rows = base.filter(r => kindOf(r) === kd && r.d.startsWith(m) && (!RG || (r.d >= RG[0] && r.d <= RG[1])));
      n = rows.length; title = `${(ST_KINDS.find(x => x[0] === kd) || [0, kd])[1]} · ${monthLabel(m)}`;
      head = '<tr><th>Data</th><th>Hora</th><th>Profissional</th><th>Paciente</th><th>Convênio</th><th>Status original</th></tr>';
      body = rows.slice(0, 500).map(r => `<tr><td>${toDate(r.d).toLocaleDateString('pt-BR')}</td><td>${esc(r.h || '')}</td><td>${esc(r.prof)}</td><td>${esc(String(r.p).slice(0, 10))}</td><td>${esc(r.payer || '')}</td><td>${esc(r.st || '')}</td></tr>`).join('');
      if (n > 500) body += `<tr><td colspan="6" class="muted">Mostrando 500 de ${fmtNum(n)}.</td></tr>`;
    } else {
      const pm = {}; const prev = addMonths(m, -1); const cutM = dataCut().slice(0, 7);
      const all = base.filter(r => kindOf(r) !== 'ignorar'); const firstM = all.reduce((a, r) => (!a || r.d.slice(0, 7) < a) ? r.d.slice(0, 7) : a, '');
      for (const r of all) { const k = kindOf(r), mm = r.d.slice(0, 7); const pt = (pm[r.p] = pm[r.p] || { m: new Set(), real: new Set(), sess: 0, falt: 0, last: '', profs: new Set() });
        if (k !== 'reagendado') pt.m.add(mm); if (k === 'realizado') pt.real.add(mm);
        const ref = key === 'evad' ? prev : m;
        if (mm === ref && k !== 'reagendado') { if (k === 'realizado') pt.sess++; if (k === 'falta' || k === 'falta_cob') pt.falt++; if (r.d > pt.last) pt.last = r.d; pt.profs.add(r.prof); } }
      const sel = Object.entries(pm).filter(([, pt]) => { const mm = [...pt.m].sort(); const first = mm[0];
        if (key === 'ativos') return pt.real.has(m);
        if (key === 'novos') return first === m && m !== firstM;
        if (key === 'evad') return m <= cutM && m !== firstM && pt.m.has(prev) && !pt.m.has(m);
        if (key === 'ret') return pt.m.has(m) && !pt.m.has(prev) && first < prev; return false; });
      n = sel.length; const nm = { ativos: 'Pacientes ativos', novos: 'Pacientes novos', ret: 'Pacientes que retornaram', evad: 'Pacientes evadidos' }[key];
      title = `${nm} · ${monthLabel(m)}`;
      const refL = key === 'evad' ? ` (${monthLabel(prev)})` : '';
      head = `<tr><th>Paciente</th><th>Sessões${refL}</th><th>Faltas${refL}</th><th>Última sessão${refL}</th><th>Profissionais</th></tr>`;
      body = sel.sort((a, b) => b[1].sess - a[1].sess).slice(0, 500).map(([p, pt]) => `<tr><td>${esc(String(p).slice(0, 10))}</td><td class="num">${pt.sess}</td><td class="num">${pt.falt}</td><td>${pt.last ? toDate(pt.last).toLocaleDateString('pt-BR') : '—'}</td><td>${esc([...pt.profs].join(', '))}</td></tr>`).join('');
    }
    close(); const ov = document.createElement('div'); ov.className = 'drOv'; ov.id = 'drOv'; ov.onclick = e => { if (e.target === ov) close(); };
    ov.innerHTML = `<div class="drBox"><header><h3>${esc(title)} · ${fmtNum(n)}</h3><button class="btn ghost sm" onclick="AgImp.closeDrill()">Fechar</button></header><div class="drBody">${n ? `<div class="tscroll"><table class="tbl sm"><thead>${head}</thead><tbody>${body}</tbody></table></div>` : '<p class="muted">Nenhum registro.</p>'}<p class="muted" style="margin-top:8px">Pacientes aparecem por código irreversível (LGPD).</p></div></div>`;
    document.body.appendChild(ov);
  }
  function close() { const o = document.getElementById('drOv'); if (o) o.remove(); }
  window.AgImp = Object.assign(window.AgImp || {}, { drill, closeDrill: close });
  window.ImpMgr = { table, del, commitReceb, also, bar };
})();
