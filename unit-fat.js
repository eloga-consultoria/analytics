/* ELOGA Analytics — unidade no faturamento: lida pelo CNPJ / código do prestador do arquivo da operadora */
(function () {
  'use strict';
  const dig = s => String(s || '').replace(/\D/g, '');
  const CNPJ = /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/;
  const codes = u => String(u.prest || '').split(/[,;\s]+/).map(x => dig(x).replace(/^0+/, '')).filter(Boolean);

  function detect() {
    const out = { cnpj: '', prest: '' }; const meta = (SIMP.meta || []).flat().map(String).join(' | ');
    let m = meta.match(CNPJ); if (m) out.cnpj = dig(m[0]);
    let q = meta.match(/(?:c[oó]d(?:igo)?\.?\s*(?:do\s*)?(?:prestador|contratado|na\s*operadora)|prestador|contratado)[^\d|]{0,40}(\d{3,})/i); if (q) out.prest = q[1];
    const H = SIMP.headers || [];
    const hc = H.find(h => /cnpj/i.test(h)); if (hc && !out.cnpj) { const v = (SIMP.rows.find(r => dig(r[hc]).length >= 14) || {})[hc]; if (v) out.cnpj = dig(v).slice(0, 14); }
    const hp = H.find(h => /(c[oó]d.*(prestador|contratado))|^prestador$|cod.*operadora/i.test(h)); if (hp && !out.prest) { const v = (SIMP.rows.find(r => dig(r[hp]).length >= 3) || {})[hp]; if (v) out.prest = dig(v); }
    return out;
  }
  function match(d) {
    const units = S.cad.units || [];
    return units.find(u => d.cnpj && dig(u.cnpj) === d.cnpj) || units.find(u => d.prest && codes(u).includes(d.prest.replace(/^0+/, ''))) || null;
  }

  const _bf = window.batchForm;
  window.batchForm = function () {
    _bf(); if (!SIMP) return; const det = detect(); SIMP.cnpj = det.cnpj; SIMP.prest = det.prest; const u = match(det); SIMP.unit = u ? u.name : '';
    const row = workBox().querySelector('.row.end'); if (!row) return;
    const lido = (det.cnpj || det.prest) ? `Lido no arquivo: ${det.cnpj ? 'CNPJ ' + esc(det.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')) : ''}${det.cnpj && det.prest ? ' · ' : ''}${det.prest ? 'prestador ' + esc(det.prest) : ''}.` : 'O arquivo não traz CNPJ nem código do prestador reconhecíveis.';
    if (!AgUn.has()) { if (det.cnpj || det.prest) row.insertAdjacentHTML('beforebegin', `<div class="notice">${lido} Cadastre as unidades do cliente (Cadastros → Unidades) com CNPJ/prestador para analisar o faturamento por unidade.</div>`); return; }
    const warn = u ? '' : ((det.cnpj || det.prest) ? ' <b>Não encontrei unidade com esse CNPJ/prestador</b>: selecione a unidade; vou memorizar a associação.' : ' Selecione a unidade, se for de uma só.');
    row.insertAdjacentHTML('beforebegin', `<div class="notice ${u ? 'good' : 'warn'}"><div class="field" style="max-width:340px"><label>Unidade do lote</label><select id="bUnit"><option value="">— sem unidade —</option>${AgUn.list().map(n => `<option ${u && u.name === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><small>${lido}${u ? ` Reconhecida: <b>${esc(u.name)}</b>.` : ''}${warn}</small></div>`);
  };
  const _cb = window.commitBatch;
  window.commitBatch = function () {
    const sel = document.getElementById('bUnit'); if (sel) SIMP.unit = sel.value;
    if (SIMP.unit) { const u = (S.cad.units || []).find(x => x.name === SIMP.unit); if (u) {
      if (SIMP.cnpj && !dig(u.cnpj)) u.cnpj = SIMP.cnpj;
      if (SIMP.prest && !codes(u).includes(SIMP.prest.replace(/^0+/, ''))) u.prest = [u.prest, SIMP.prest].filter(Boolean).join(', '); } }
    return _cb();
  };

  /* ---- cadastro: CNPJ e prestador de cada unidade ---- */
  const _cu = window.cadUnidades;
  window.cadUnidades = function () {
    _cu(); const un = S.cad.units || []; if (!un.length) return;
    const body = document.getElementById('cadBody'); if (!body) return;
    body.insertAdjacentHTML('beforeend', `<div class="card"><h3>Identificação das unidades nas operadoras</h3><p class="muted">Os arquivos de faturamento e de demonstrativo trazem o CNPJ e/ou o código do prestador. Informe aqui para que cada lote importado vá automaticamente para a unidade certa. Vários códigos: separe por vírgula.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Unidade</th><th>CNPJ</th><th>Código(s) do prestador</th></tr></thead><tbody>${un.map((u, i) => `<tr><td>${esc(u.name)}</td><td><input class="cin" value="${esc(u.cnpj || '')}" placeholder="00.000.000/0000-00" onchange="AgUn.set(${i},'cnpj',this.value)"></td><td><input class="cin" value="${esc(u.prest || '')}" placeholder="ex.: 75839814" onchange="AgUn.set(${i},'prest',this.value)"></td></tr>`).join('')}</tbody></table></div></div>`);
  };

  /* ---- faturamento por unidade (Ciclo de receita) ---- */
  function unitTable() {
    if (!AgUn.has()) return '';
    const R = rcmData(); const ms = new Set(windowMonths()); const rows = {};
    R.batches.filter(b => !R.dupe(b) && ms.has((b.ci || '').slice(0, 7))).forEach(b => { const k = b.unit || '(sem unidade)'; const o = (rows[k] = rows[k] || { lotes: 0, apres: 0, glos: 0, paid: 0, esperado: 0 }); o.lotes++; o.apres += b.apres || 0; o.glos += b.glos || 0; o.paid += b.paid || 0; o.esperado += b.expected || 0; });
    const list = Object.entries(rows); if (!list.length) return '';
    const semUn = rows['(sem unidade)'];
    const sem = semUn ? R.batches.filter(b => !b.unit && !R.dupe(b) && ms.has((b.ci || '').slice(0, 7))) : [];
    const setHtml = sem.length ? `<details style="margin-top:8px"><summary><b>Atribuir unidade aos ${sem.length} lote(s) sem unidade</b></summary><table class="tbl sm"><thead><tr><th>Operadora</th><th>Competência</th><th>Arquivo</th><th>Unidade</th></tr></thead><tbody>${sem.map(b => `<tr><td>${esc(b.payer)}</td><td>${esc((b.ci || '').slice(0, 7))}</td><td>${esc(b.file || '')}</td><td><select onchange="UnitFat.setUnit('${b.id}',this.value)"><option value="">—</option>${AgUn.list().map(n => `<option>${esc(n)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></details>` : '';
    return `<div class="card"><div class="chead"><h3>Faturamento por unidade</h3></div><div class="tscroll"><table class="tbl sm"><thead><tr><th>Unidade</th><th>Lotes</th><th>Apresentado</th><th>Glosado</th><th>% glosa</th><th>Recebido</th><th>A receber</th></tr></thead><tbody>
      ${list.sort((a, b) => b[1].apres - a[1].apres).map(([n, o]) => `<tr><td>${esc(n)}</td><td class="num">${o.lotes}</td><td class="num">${fmtMoney(o.apres)}</td><td class="num">${fmtMoney(o.glos)}</td><td class="num">${fmtPct(div(o.glos, o.apres))}</td><td class="num">${fmtMoney(o.paid)}</td><td class="num">${fmtMoney(Math.max(0, o.esperado - o.paid))}</td></tr>`).join('')}</tbody></table></div>
      <div class="howto"><b>Como ler:</b> lotes do período por unidade, identificada pelo CNPJ/código do prestador do arquivo. Faturamento e demonstrativo da mesma operadora e competência não são somados duas vezes.${semUn ? ' <b>Há lotes sem unidade</b>: cadastre o CNPJ/prestador em Cadastros → Unidades e reimporte, ou escolha a unidade ao importar.' : ''}</div>${setHtml}</div>`;
  }
  function setUnit(id, v) { const b = S.fat.concat(S.dem).find(x => x.id === id); if (!b) return; b.unit = v; resetAll(); show('ciclo'); }
  const _rc = window.renderCiclo;
  window.renderCiclo = function () { const r = _rc.apply(this, arguments); try { const t = unitTable(); if (t) { const pg = document.getElementById('pg_ciclo'); const k = pg.querySelector('.kpis'); (k || pg.querySelector('.phead')).insertAdjacentHTML('afterend', t); } } catch (e) { console.error(e); } return r; };
  RENDER.ciclo = window.renderCiclo;
  window.UnitFat = { detect, match, unitTable, setUnit };
})();
