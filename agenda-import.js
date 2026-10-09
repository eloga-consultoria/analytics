/* ELOGA Analytics — importação guiada da agenda e filtros de período (semana / datas)
   Depende das funções globais do index.html (SIMP, KINDS, autoStatus, ST_KINDS, S, norm, esc, notice...). */
(function () {
  'use strict';

  /* ---------- Descrição de cada campo e de cada classificação de status ---------- */
  const FIELD_HELP = {
    date: 'Dia do atendimento ou do agendamento. Define o mês, a semana e o dia da semana. Obrigatório.',
    time: 'Horário de início. Alimenta o mapa de horários, a reocupação de vagas e a ociosidade.',
    prof: 'Profissional dono da agenda. É a base de produtividade e de ocupação. Obrigatório.',
    profAt: 'Quando existe, é quem realmente atendeu (substitui o profissional da agenda).',
    esp: 'Especialidade (Psicologia, Fonoaudiologia, TO...). Usada nos cortes por especialidade e na fila de espera.',
    pid: 'Código do paciente no sistema da clínica. Vira um código irreversível (LGPD).',
    name: 'Só serve para identificar o mesmo paciente quando não há código. O nome não é gravado.',
    payer: 'Convênio ou "Particular". Define o preço da tabela e a receita estimada. Obrigatório, exceto em clínica de estética (sempre Particular).',
    proc: 'Procedimento realizado. Busca o valor na tabela de preços.',
    code: 'Código TUSS do procedimento. Ajuda a achar o preço quando o nome do procedimento varia.',
    status: 'Situação do agendamento no sistema da clínica (Atendido, Faltou, Cancelado...). Todas as taxas dependem dele. Obrigatório.',
    booked: 'Dia em que o horário foi marcado. Não entra nos indicadores (agendamentos recorrentes distorcem a antecedência); pode ficar em branco.'
  };
  const KIND_HELP = {
    realizado: 'Atendimento que aconteceu. Entra em comparecimento, produtividade e receita estimada.',
    falta: 'Paciente não veio e a sessão não é cobrada. Entra no absenteísmo e na receita em risco.',
    falta_cob: 'Paciente não veio, mas a clínica cobra a sessão. Entra no absenteísmo e na receita.',
    canc_pac: 'Paciente desmarcou. Entra em cancelamentos; a vaga pode ser reocupada.',
    canc_clin: 'A clínica cancelou. Entra em cancelamentos da clínica.',
    aus_prof: 'Profissional ausente. Entra em cancelamentos da clínica.',
    reagendado: 'Foi remarcado para outro horário. Não conta como agendamento do período para não duplicar.',
    sembaixa: 'Data já passou e ninguém registrou o que aconteceu. Aparece como pendência de registro.',
    agendado: 'Ainda vai acontecer. Fica fora das taxas até ser baixado.',
    ignorar: 'Bloqueio, teste ou duplicado. Não entra em nenhum indicador.'
  };
  if (!KINDS.agenda.fields.some(f => f.k === 'unit')) KINDS.agenda.fields.push({ k: 'unit', l: 'Unidade (se o cliente tiver mais de uma)', syn: ['unidade', 'filial', 'local', 'sede'] });
  FIELD_HELP.unit = 'Unidade onde o atendimento ocorreu. Permite analisar cada unidade separadamente. Se não houver, a unidade vem do cadastro do profissional.';
  const KOPT = () => ST_KINDS.map(([v, l]) => [v, l]);

  const ex = (v) => esc(String(v == null ? '' : v).slice(0, 38));

  /* ---------- 1. Montagem dos registros a partir do mapeamento ---------- */
  function build() {
    const recs = []; let bad = 0;
    for (const r of SIMP.rows) {
      const d = toDate(G(r, 'date')); const prof = String(G(r, 'profAt')).trim() || String(G(r, 'prof')).trim();
      if (!d || !prof) { bad++; continue; }
      const bk = toDate(G(r, 'booked'));
      recs.push({ d: isoLocal(d), h: String(G(r, 'time')).slice(0, 5), prof, esp: String(G(r, 'esp')).trim(), payer: String(G(r, 'payer')).trim() || defPayer() || 'Não informado',
        code: String(G(r, 'code')).replace(/\D/g, ''), proc: String(G(r, 'proc')).trim(), st: String(G(r, 'status')).trim(), bk: bk ? isoLocal(bk) : '', p: patKey(G(r, 'pid'), G(r, 'name')), n: nameKey(G(r, 'name')) });
      const u = String(G(r, 'unit')).trim(); if (u) recs[recs.length - 1].u = u;
    }
    SIMP.out = recs; SIMP.bad = bad;
    const dates = recs.map(r => r.d).sort(); SIMP.range = [dates[0], dates[dates.length - 1]];
  }
  // corte para decidir se "Agendado" é futuro ou passado: última data com status já baixado (arquivo novo + agenda existente)
  function cutOf(recs) { let c = ''; for (const r of recs.concat(S.agenda)) if (autoStatus(r.st) !== 'agendado' && r.d > c) c = r.d; return c || isoLocal(new Date()); }
  function keyOf(r, cut) { return autoStatus(r.st) === 'agendado' ? r.st + (r.d > cut ? ' ▸ data futura' : ' ▸ data já passada') : r.st; }
  function statusRows() {
    const cut = SIMP.cut = cutOf(SIMP.out); const cnt = {};
    SIMP.out.forEach(r => { const k = keyOf(r, cut); cnt[k] = (cnt[k] || 0) + 1; });
    SIMP.stmap = SIMP.stmap || {};
    Object.keys(cnt).forEach(k => { if (!SIMP.stmap[k]) SIMP.stmap[k] = S.cad.statusMap[k] || defaultKind(k); });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  }

  /* ---------- 2. Assistente: colunas + status ---------- */
  function previewAgenda() {
    build(); const sts = statusRows(); const F = KINDS.agenda.fields;
    const opts = sel => `<option value="">— não usar —</option>` + SIMP.headers.map(h => `<option ${sel === h ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const sample = SIMP.rows[0] || {};
    const faltas = sts.filter(([k]) => ['falta', 'falta_cob'].includes(SIMP.stmap[k])).reduce((s, [, n]) => s + n, 0);
    const miss = F.filter(f => f.req && !SIMP.map[f.k]);
    workBox().innerHTML = `<div class="card"><h3>Importar agenda${badge()}</h3>
      ${notice('good', `<b>${SIMP.out.length.toLocaleString('pt-BR')} agendamentos</b>${SIMP.out.length ? ` de ${toDate(SIMP.range[0]).toLocaleDateString('pt-BR')} a ${toDate(SIMP.range[1]).toLocaleDateString('pt-BR')} · ${new Set(SIMP.out.map(r => r.prof)).size} profissionais · ${new Set(SIMP.out.map(r => r.payer)).size} convênios · ${new Set(SIMP.out.map(r => r.p)).size} pacientes` : ''}.${SIMP.bad ? ` ${SIMP.bad} linha(s) sem data ou profissional serão ignoradas.` : ''}`)}
      ${miss.length ? notice('warn', 'Faltam colunas obrigatórias: <b>' + miss.map(f => esc(f.l)).join(', ') + '</b>. Indique abaixo.') : ''}
      <h4 style="margin:14px 0 6px">1. Colunas do arquivo</h4>
      <p class="muted">O painel reconheceu as colunas abaixo. Confira o <b>exemplo</b> de cada uma e corrija se algo estiver trocado. Campos com * são obrigatórios.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Campo do painel</th><th>Para que serve</th><th>Coluna do arquivo</th><th>Exemplo da 1ª linha</th></tr></thead><tbody>
      ${F.map(f => `<tr><td><b>${esc(f.l)}</b>${f.req ? ' <span class="req">*</span>' : ''}</td><td><small>${esc(FIELD_HELP[f.k] || '')}</small></td>
        <td><select onchange="AgImp.setMap('${f.k}',this.value)">${opts(SIMP.map[f.k])}</select></td><td><small>${SIMP.map[f.k] ? ex(sample[SIMP.map[f.k]]) : '—'}</small></td></tr>`).join('')}</tbody></table></div>
      <h4 style="margin:18px 0 6px">2. O que significa cada status</h4>
      <p class="muted">Cada sistema dá nomes próprios aos status. Diga o que cada um significa: <b>absenteísmo, faltas, receita em risco e comparecimento dependem desta escolha.</b> Hoje, ${faltas ? `<b>${faltas.toLocaleString('pt-BR')}</b> registros estão classificados como falta.` : '<b>nenhum registro está classificado como falta</b>: marque qual status é a falta do paciente.'}</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Status no arquivo</th><th>Registros</th><th>Significa</th><th>O que acontece nos indicadores</th></tr></thead><tbody>
      ${sts.map(([k, n]) => { const [base, nota] = k.split(' ▸ '); const cur = SIMP.stmap[k]; const isF = cur === 'falta' || cur === 'falta_cob';
        return `<tr${isF ? ' style="background:rgba(224,138,0,.10)"' : ''}><td><b>${esc(base || '(vazio)')}</b>${nota ? `<br><small>${esc(nota)} (referência: ${toDate(SIMP.cut).toLocaleDateString('pt-BR')}, última data com atendimento baixado)</small>` : ''}</td><td class="num">${n.toLocaleString('pt-BR')}</td>
        <td><select onchange='AgImp.setStatus(${JSON.stringify(k).replace(/'/g, '&#39;')},this.value)'>${KOPT().map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td><td><small>${esc(KIND_HELP[cur] || '')}</small></td></tr>`; }).join('')}</tbody></table></div>
      <div class="howto"><b>Dica:</b> o status "Agendado" aparece em duas linhas. Com <b>data futura</b> é agenda que ainda vai acontecer. Com <b>data já passada</b> normalmente é falta de baixa no sistema: você decide se é falta, sem baixa ou se deve ser ignorado.</div>
      <div class="row end">${cancelBtn()}<button class="btn pdf" ${miss.length || !SIMP.out.length ? 'disabled' : ''} onclick="commitAgenda()">Importar agenda</button></div></div>`;
    workBox().scrollIntoView({ behavior: 'smooth' });
  }

  function commitAgenda() {
    const [a, b] = SIMP.range; const stmap = SIMP.stmap, cut = SIMP.cut, out = SIMP.out; const impId = uid(); out.forEach(r => r.s = impId);
    S.agenda = S.agenda.filter(r => r.d < a || r.d > b).concat(out).sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : (x.h < y.h ? -1 : 1));
    syncPayers(out.map(r => r.payer)); _cut = null; syncProfs();
    [...new Set(out.map(r => r.u).filter(Boolean))].forEach(n => AgUn.add(n));
    // a classificação escolhida vale para os mesmos nomes de status na agenda inteira
    out.forEach(r => { const chosen = stmap[keyOf(r, cut)]; if (chosen) S.cad.statusMap[stKey(r)] = chosen; });
    new Set(S.agenda.map(stKey)).forEach(k => { if (!(k in S.cad.statusMap)) S.cad.statusMap[k] = defaultKind(k); });
    S.cad.statusOK = true;
    logImport('agenda', out.length, `Período ${toDate(a).toLocaleDateString('pt-BR')}–${toDate(b).toLocaleDateString('pt-BR')} · status classificados`, impId);
    resetAll(); toast(`${out.length.toLocaleString('pt-BR')} agendamentos importados e status classificados.`, 'good'); SIMP = null; show('agenda');
  }

  /* ---------- 3. Filtros de período na tela da agenda ---------- */
  const weekStart = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLocal(d); };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
  const br = iso => toDate(iso).toLocaleDateString('pt-BR').slice(0, 5);
  function weeks() { return [...new Set(S.agenda.map(r => weekStart(r.d)))].sort(); }
  function periodFields() {
    const f = agFilter(); const ws = weeks(); const cur = (f.from && f.to && weekStart(f.from) === f.from && addDays(f.from, 6) === f.to) ? f.from : '';
    const un = AgUn.has() ? `<div class="field"><label>Unidade</label><select onchange="AgImp.setUnit(this.value)"><option value="">Todas</option>${AgUn.list().map(n => `<option ${f.unit === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>` : '';
    return un + `<div class="field"><label>Semana (seg a dom)</label><select onchange="AgImp.setWeek(this.value)"><option value="">Todas</option>${ws.slice().reverse().map(w => `<option value="${w}" ${cur === w ? 'selected' : ''}>${br(w)} a ${br(addDays(w, 6))}</option>`).join('')}</select></div>
      <div class="field"><label>De</label><input type="date" value="${esc(f.from)}" onchange="AgImp.setRange('from',this.value)"></div>
      <div class="field"><label>Até</label><input type="date" value="${esc(f.to)}" onchange="AgImp.setRange('to',this.value)"></div>`;
  }
  function periodNote() {
    const f = agFilter(); const bar = `<div class="row end" style="margin:0 0 10px"><button class="btn ghost" onclick="AgExp.xlsx()">Exportar Excel (com gráficos)</button><button class="btn pdf" onclick="AgExp.pdf()">Exportar PDF (com gráficos)</button></div>`; if (!f.from && !f.to) return bar;
    return bar + notice('', `<b>Período filtrado:</b> ${f.from ? toDate(f.from).toLocaleDateString('pt-BR') : 'início'} a ${f.to ? toDate(f.to).toLocaleDateString('pt-BR') : 'fim'}. Indicadores e capacidade consideram só estes dias (feriados e grade de cada profissional respeitados). Use "Limpar filtros" para voltar ao período mensal.`);
  }
  const apply = () => { agReset(); save(); renderAgenda(); };

  window.AgImp = {
    setMap(k, v) { if (v) SIMP.map[k] = v; else delete SIMP.map[k]; previewAgenda(); },
    setStatus(k, v) { SIMP.stmap[k] = v; previewAgenda(); },
    setWeek(w) { S.agf = Object.assign(S.agf || {}, w ? { from: w, to: addDays(w, 6) } : { from: '', to: '' }); apply(); },
    setUnit(v) { S.agf = Object.assign(S.agf || {}, { unit: v }); apply(); },
    setRange(k, v) { S.agf = Object.assign(S.agf || {}, { [k]: v }); apply(); },
    periodFields, periodNote
  };
  window.previewAgenda = previewAgenda; window.commitAgenda = commitAgenda;

  // todo arquivo de agenda passa pelo assistente, inclusive os de formato já conhecido
  const baseNext = window.smartNext;
  window.smartNext = function () { if (SIMP.kind === 'agenda') return previewAgenda(); return baseNext(); };
})();
