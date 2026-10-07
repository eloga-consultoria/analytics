/* ELOGA Analytics — unidades do cliente (cadastro + apoio à análise separada por unidade) */
(function () {
  'use strict';
  const U = () => { S.cad.units = S.cad.units || []; return S.cad.units; };
  const AgUn = {
    has() { return !!(typeof S !== 'undefined' && S && S.cad && (S.cad.units || []).length); },
    list() { return (S.cad.units || []).map(u => u.name); },
    // devolve a unidade de um registro: coluna do arquivo, senão a unidade do profissional
    mk() { const pu = {}; (S.cad.profs || []).forEach(p => { if (p.unit) pu[p.name] = p.unit; }); return r => r.u || pu[r.prof] || ''; },
    th() { return AgUn.has() ? '<th>Unidade</th>' : ''; },
    td(i, p) { if (!AgUn.has()) return ''; return `<td><select class="cin" onchange="AgUn.setProfUnit(${i},this.value)"><option value="">—</option>${AgUn.list().map(n => `<option ${p.unit === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></td>`; },
    setProfUnit(i, v) { S.cad.profs[i].unit = v; resetAll(); renderCad(); },
    roomCap(ym, unit) {
      const u = U().find(x => x.name === unit); const rooms = u && toNum(u.rooms); if (!rooms) return null;
      const slot = toNum(S.cad.clinic.slot) || 50; let any = false;
      const n = monthDays(ym).reduce((s, dt) => { const r = clinicRanges(dt.getDay()); if (r) any = true; return s + slotsOf(r, slot); }, 0);
      return any ? n * rooms : null;
    },
    roomCapAll(ym, esp) { if (esp) return null; let any = false, t = 0; U().forEach(u => { const v = AgUn.roomCap(ym, u.name); if (isNum(v)) { any = true; t += v; } }); return any ? t : null; },
    add(name) { name = String(name || '').trim(); if (!name) return false; if (U().some(u => norm(u.name) === norm(name))) return false; U().push({ name, rooms: '', city: '' }); return true; },
    remove(i) { const n = U()[i].name; U().splice(i, 1); S.cad.profs.forEach(p => { if (p.unit === n) p.unit = ''; }); S.agf = Object.assign({}, S.agf, { unit: '' }); resetAll(); renderCad(); },
    rename(i, v) { v = v.trim(); if (!v) return renderCad(); const old = U()[i].name; U()[i].name = v; S.cad.profs.forEach(p => { if (p.unit === old) p.unit = v; }); S.agenda.forEach(r => { if (r.u === old) r.u = v; }); resetAll(); renderCad(); },
    set(i, k, v) { U()[i][k] = v; resetAll(); renderCad(); },
    addPrompt() { const el = document.getElementById('unNew'); if (AgUn.add(el.value)) { resetAll(); renderCad(); } else toast('Informe um nome de unidade novo.', 'bad'); }
  };

  /* ---------- Regras por status: fatura ao convênio / cobra do paciente / repassa ao profissional ---------- */
  const KIND_DEF = k => (k === 'realizado' || k === 'falta_cob');
  window.stFlags = function (r) {
    const key = stKey(r); const o = (S.cad.statusFlags || {})[key] || {}; const kind = kindOf(r); const d = KIND_DEF(kind);
    return { fat: o.fat === undefined ? d : !!o.fat, cobra: o.cobra === undefined ? d : !!o.cobra, rep: o.rep };
  };
  window.billable = function (r) { const f = stFlags(r); return !!(f.fat || f.cobra); };
  window.stFlagCell = function (key, f) {
    const kind = S.cad.statusMap[key] || defaultKind(key); const o = (S.cad.statusFlags || {})[key] || {};
    const v = o[f] === undefined ? KIND_DEF(kind) : !!o[f]; const custom = o[f] !== undefined;
    return `<select onchange='stSetFlag(${JSON.stringify(key).replace(/'/g, '&#39;')},"${f}",this.value)' style="${custom ? 'font-weight:700' : ''}"><option value="1" ${v ? 'selected' : ''}>Sim</option><option value="0" ${!v ? 'selected' : ''}>Não</option></select>`;
  };
  window.stSetFlag = function (key, f, v) { S.cad.statusFlags = S.cad.statusFlags || {}; (S.cad.statusFlags[key] = S.cad.statusFlags[key] || {})[f] = v === '1'; resetAll(); renderCad(); };
  window.AgUn = AgUn;
  window.cadUnidades = function () {
    const un = U(); const uo = AgUn.mk(); const cnt = {}; S.agenda.forEach(r => { const k = uo(r); cnt[k] = (cnt[k] || 0) + 1; });
    const semUn = cnt[''] || 0;
    $('cadBody').innerHTML = `<div class="card"><h3>Unidades do cliente</h3>
      ${notice('', 'Cadastre as unidades <b>só se o cliente tiver mais de uma</b>. Com unidades cadastradas, a agenda ganha o filtro e o quadro "Unidade", e a capacidade e a ocupação são calculadas separadamente por unidade. Cliente com unidade única não precisa preencher nada aqui.')}
      <div class="tscroll"><table class="tbl"><thead><tr><th>Unidade</th><th>Cidade / bairro</th><th>Nº de salas</th><th>Profissionais</th><th>Agendamentos</th><th></th></tr></thead><tbody>
      ${un.map((u, i) => `<tr><td><input class="cin" value="${esc(u.name)}" onchange="AgUn.rename(${i},this.value)"></td><td><input class="cin" value="${esc(u.city || '')}" onchange="AgUn.set(${i},'city',this.value)"></td>
        <td><input class="cin xs num" value="${esc(u.rooms || '')}" onchange="AgUn.set(${i},'rooms',toNum(this.value)||'')"></td><td class="num">${S.cad.profs.filter(p => p.unit === u.name).length}</td><td class="num">${fmtNum(cnt[u.name] || 0)}</td>
        <td><button class="lnk" onclick="if(confirm('Remover a unidade ${esc(u.name).replace(/'/g, '')}? Os profissionais ficam sem unidade.'))AgUn.remove(${i})">remover</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhuma unidade cadastrada.</td></tr>'}
      </tbody></table></div>
      <div class="row" style="margin-top:10px"><input id="unNew" class="cin" placeholder="Nome da nova unidade" style="max-width:260px" onkeydown="if(event.key==='Enter')AgUn.addPrompt()"><button class="btn sm" onclick="AgUn.addPrompt()">+ Unidade</button></div>
      ${un.length && semUn ? notice('warn', `<b>${fmtNum(semUn)} agendamentos sem unidade.</b> Atribua a unidade de cada profissional em <a href="#" onclick="CADTAB='profs';renderCad();return false">Profissionais e grade</a>, ou importe a agenda com a coluna "Unidade".`) : ''}
      <div class="howto"><b>Como a unidade é definida em cada agendamento:</b> 1) pela coluna "Unidade" do arquivo da agenda, quando existir; 2) senão, pela unidade cadastrada para o profissional. A capacidade das salas de cada unidade usa o horário de funcionamento da clínica e o nº de salas informado aqui.</div></div>`;
  };
})();
