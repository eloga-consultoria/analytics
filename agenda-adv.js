/* ELOGA Analytics v3 — Agenda: análises avançadas (integração do Painel Operacional)
   Usa o motor de agenda existente (S.agenda, kindOf, agStats, cadastros) e acrescenta:
   capacidade efetiva e ociosidade, receita em risco, reocupação, continuidade terapêutica,
   produtividade, lista de espera, qualidade do dado, capacidade teórica e metas. */
(function () {
  const OCC = ['realizado', 'falta', 'falta_cob', 'sembaixa', 'agendado'];   // status que ocupam o horário
  const CANCK = ['canc_pac', 'canc_clin', 'aus_prof'];
  const TABS = [['ocios', 'Capacidade e ociosidade'], ['risco', 'Faltas, cancelamentos e reocupação'], ['cont', 'Continuidade terapêutica'], ['prod', 'Produtividade'], ['espera', 'Lista de espera'], ['dado', 'Qualidade do dado'], ['metas', 'Capacidade teórica e metas']];
  let AGX = 'ocios';
  const k2 = (sig, n, v, d, cls = 'neu') => `<div class="kpi ${cls}"><div class="kl"><span class="sig">${sig}</span>${n}</div><div class="kv">${v}</div><div class="kd">${d}</div></div>`;
  const slotMin = p => toNum(p.slot) || toNum(S.cad.clinic.slot) || 50;
  const win = () => windowMonths();
  const rowsIn = ms => { const set = new Set(ms); return S.agenda.filter(r => set.has(r.d.slice(0, 7))); };

  /* ---------- 1. Capacidade e ociosidade ---------- */
  function capGrid(ms) {   // capacidade por dia da semana x hora, somando o período
    const cap = {}; const rooms = toNum(S.cad.clinic.rooms);
    ms.forEach(m => monthDays(m).forEach(dt => { const w = dt.getDay(); const perH = {};
      S.cad.profs.filter(p => p.active !== false).forEach(p => { const g = (p.grade || {})[w]; if (!g) return; const sl = slotMin(p); const sim = toNum(p.simult) || 1;
        String(g).split(/[;,]+/).forEach(r => { const [a, b] = r.split('-').map(toMin); if (!isNum(a) || !isNum(b)) return; for (let s = a; s + sl <= b; s += sl) { const h = String(Math.floor(s / 60)).padStart(2, '0'); perH[h] = (perH[h] || 0) + sim; } }); });
      Object.entries(perH).forEach(([h, n]) => { let c = n; const sl = toNum(S.cad.clinic.slot) || 50; if (isNum(rooms) && rooms > 0) c = Math.min(n, rooms * Math.floor(60 / sl)); cap[w + '|' + h] = (cap[w + '|' + h] || 0) + c; }); }));
    return cap;
  }
  function tabOcios(A, ms) {
    const rows = rowsIn(ms).filter(r => OCC.includes(kindOf(r)) && r.h);
    const occ = {}; rows.forEach(r => { const key = toDate(r.d).getDay() + '|' + r.h.slice(0, 2); occ[key] = (occ[key] || 0) + 1; });
    const cap = capGrid(ms); const hrs = [...new Set(Object.keys(cap).map(k => k.split('|')[1]))].sort();
    const capTot = Object.values(cap).reduce((a, b) => a + b, 0); const occTot = Object.keys(cap).reduce((s, k) => s + Math.min(occ[k] || 0, cap[k]), 0);
    const idle = capTot - occTot; const slotAvg = avg(S.cad.profs.filter(p => p.active !== false).map(slotMin)) || toNum(S.cad.clinic.slot) || 50;
    const horas = idle * slotAvg / 60; const rec = isNum(A.ticket) ? idle * A.ticket : null;
    const heat = hrs.length ? `<div class="tscroll"><table class="heat"><thead><tr><th></th>${hrs.map(h => `<th>${h}h</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map(w => `<tr><th>${WD[w]}</th>${hrs.map(h => { const c = cap[w + '|' + h], o = occ[w + '|' + h] || 0; if (!c) return '<td></td>'; const p = Math.min(1, o / c); return `<td title="${o} de ${c} vagas" style="background:rgba(15,107,122,${(0.08 + p * 0.8).toFixed(2)});color:${p > .55 ? '#fff' : 'inherit'}">${Math.round(p * 100)}%</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">Cadastre a grade dos profissionais (Cadastros) para ver o mapa.</p>';
    const byM = monthTable(ms, [
      { l: 'Capacidade dos profissionais', f: m => A.M[m] && A.M[m].cap },
      { l: 'Capacidade das salas', f: m => A.M[m] && A.M[m].capRoom },
      { l: 'Capacidade efetiva (menor das duas)', cls: 'b', f: m => { const c = A.M[m] && A.M[m].cap, r = A.M[m] && A.M[m].capRoom; return isNum(c) && isNum(r) ? Math.min(c, r) : (isNum(c) ? c : r); } },
      { l: 'Horários ocupados (realizados, faltas, sem baixa, agendados)', f: m => A.M[m] ? A.M[m].realizado + A.M[m].falta + A.M[m].falta_cob + A.M[m].sembaixa + A.M[m].agendado : null },
      { l: 'Vagas livres', cls: 'b', f: m => { const c = A.M[m] && A.M[m].cap, r = A.M[m] && A.M[m].capRoom; const e = isNum(c) && isNum(r) ? Math.min(c, r) : (isNum(c) ? c : r); return isNum(e) ? Math.max(0, e - (A.M[m].realizado + A.M[m].falta + A.M[m].falta_cob + A.M[m].sembaixa + A.M[m].agendado)) : null; } },
      { l: 'Gargalo', agg: 'none', f: m => null }
    ]);
    const lim = capByEsp(lastM(ms)).filter(x => x.lim);
    return `<div class="kpis">${k2('Vagas', 'Vagas livres no período', capTot ? fmtNum(idle) : 'n/a', capTot ? `De ${fmtNum(capTot)} vagas na grade (mínimo entre profissionais e salas, por horário).` : 'Cadastre a grade e as salas.', idle > capTot * .3 ? 'bad' : 'neu')}
      ${k2('Horas', 'Horas ociosas', capTot ? fmtNum(horas, 0) + ' h' : 'n/a', 'Vagas livres × duração do atendimento.')}
      ${k2('R$ ocioso', 'Receita ociosa potencial', isNum(rec) ? fmtMoney(rec) : 'n/a', 'Vagas livres × ticket médio estimado da agenda. É potencial, não perda contábil.')}</div>
    <div class="card"><div class="chead"><h3>Mapa de ocupação por dia e horário</h3></div>${heat}<div class="howto"><b>Como ler:</b> % das vagas da grade que foram ocupadas naquele dia e horário, somando o período. Células claras são vagas sobrando; escuras, horário cheio. Passe o mouse para ver o número de vagas.</div></div>
    <div class="card"><div class="chead"><h3>Capacidade por mês</h3></div>${byM}
    ${lim.length ? `<div class="howto"><b>Gargalo por especialidade (${monthLabel(lastM(ms))}):</b> ${lim.map(x => `${esc(x.esp)}: limitada por <b>${x.lim}</b>`).join(' · ')}.</div>` : ''}</div>`;
  }

  /* ---------- 2. Faltas, cancelamentos e reocupação ---------- */
  function tabRisco(A, ms) {
    const rows = rowsIn(ms); const slotKey = r => r.prof + '|' + r.d + '|' + (r.h || '').slice(0, 5);
    const busy = {}; rows.forEach(r => { const k = kindOf(r); if (['realizado', 'agendado', 'sembaixa', 'falta_cob'].includes(k) && r.h) (busy[slotKey(r)] = busy[slotKey(r)] || new Set()).add(r.p); });
    const freed = rows.filter(r => r.h && (CANCK.includes(kindOf(r)) || kindOf(r) === 'falta' || kindOf(r) === 'falta_cob'));
    const reoc = f => { const b = busy[slotKey(f)]; return b && [...b].some(p => p !== f.p); };
    const perM = {}; ms.forEach(m => perM[m] = { lib: 0, reoc: 0, risco: 0, riscoN: 0, cob: 0 });
    freed.forEach(f => { const m = f.d.slice(0, 7); const o = perM[m]; if (!o) return; o.lib++; if (reoc(f)) o.reoc++; });
    rows.forEach(r => { const k = kindOf(r), m = r.d.slice(0, 7); if (k === 'falta') { const pr = priceOf(r); perM[m].riscoN++; if (isNum(pr)) perM[m].risco += pr; } if (k === 'falta_cob') perM[m].cob++; });
    const tl = ms.reduce((s, m) => s + perM[m].lib, 0), tr = ms.reduce((s, m) => s + perM[m].reoc, 0), rr = ms.reduce((s, m) => s + perM[m].risco, 0), rn = ms.reduce((s, m) => s + perM[m].riscoN, 0);
    const byProf = {}; freed.forEach(f => { const o = (byProf[f.prof || 'Não informado'] = byProf[f.prof || 'Não informado'] || { lib: 0, reoc: 0, falta: 0, cp: 0, cc: 0, ap: 0 }); o.lib++; if (reoc(f)) o.reoc++; const k = kindOf(f); if (k === 'falta' || k === 'falta_cob') o.falta++; if (k === 'canc_pac') o.cp++; if (k === 'canc_clin') o.cc++; if (k === 'aus_prof') o.ap++; });
    const tbl = Object.entries(byProf).sort((a, b) => b[1].lib - a[1].lib);
    return `<div class="kpis">${k2('Receita em risco', 'Faltas sem cobrança × tabela', rn ? fmtMoney(rr) : '—', `${fmtNum(rn)} sessões faltadas e não cobradas, valorizadas pela tabela do convênio.`, rn ? 'bad' : 'neu')}
      ${k2('Vagas liberadas', 'Faltas e cancelamentos', fmtNum(tl), 'Horários que ficaram vagos por falta, cancelamento ou ausência do profissional.')}
      ${k2('Reocupação', 'Vagas reocupadas', tl ? fmtPct(tr / tl) : '—', `${fmtNum(tr)} de ${fmtNum(tl)} vagas liberadas foram preenchidas por outro paciente no mesmo horário.`, tl && tr / tl >= .3 ? 'good' : 'neu')}</div>
    <div class="card"><div class="chead"><h3>Por mês</h3></div>${monthTable(ms, [
      { l: 'Faltas do paciente sem cobrança', f: m => A.M[m] && A.M[m].falta }, { l: 'Faltas com cobrança', f: m => A.M[m] && A.M[m].falta_cob },
      { l: 'Cancelado pelo paciente', f: m => A.M[m] && A.M[m].canc_pac }, { l: 'Cancelado pela clínica', f: m => A.M[m] && A.M[m].canc_clin }, { l: 'Ausência do profissional', f: m => A.M[m] && A.M[m].aus_prof },
      { l: 'Receita em risco (faltas sem cobrança × tabela)', cls: 'b', f: m => perM[m].risco, fmt: fmtMoney },
      { l: 'Vagas liberadas', f: m => perM[m].lib }, { l: 'Vagas reocupadas', f: m => perM[m].reoc },
      { l: 'Taxa de reocupação', cls: 'b', f: m => div(perM[m].reoc, perM[m].lib), fmt: v => fmtPct(v), agg: 'avg' }])}</div>
    <div class="card"><div class="chead"><h3>Por profissional</h3></div><div class="tscroll"><table class="tbl"><thead><tr><th>Profissional</th><th>Vagas liberadas</th><th>Faltas</th><th>Cancel. paciente</th><th>Cancel. clínica</th><th>Ausência prof.</th><th>Reocupadas</th><th>Taxa</th></tr></thead><tbody>
    ${tbl.map(([n, o]) => `<tr><td><b>${esc(n)}</b></td><td class="num">${o.lib}</td><td class="num">${o.falta}</td><td class="num">${o.cp}</td><td class="num">${o.cc}</td><td class="num">${o.ap}</td><td class="num">${o.reoc}</td><td class="num">${fmtPct(div(o.reoc, o.lib))}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sem registros com horário no período.</td></tr>'}</tbody></table></div>
    <div class="howto"><b>Como ler:</b> uma vaga conta como reocupada quando, no mesmo profissional, dia e horário, outro paciente foi atendido ou agendado. O arquivo precisa ter a hora de cada agendamento.</div></div>`;
  }

  /* ---------- 3. Continuidade terapêutica ---------- */
  function tabCont(A, ms) {
    const real = S.agenda.filter(r => kindOf(r) === 'realizado' && r.p).sort((a, b) => a.d < b.d ? -1 : 1);
    const byP = {}; real.forEach(r => (byP[r.p] = byP[r.p] || []).push(r.d));
    const perM = {}; ms.forEach(m => {
      const act = Object.entries(byP).map(([p, ds]) => [p, ds.filter(d => d.slice(0, 7) === m)]).filter(([, d]) => d.length);
      const gaps = []; act.forEach(([, d]) => { for (let i = 1; i < d.length; i++) gaps.push((toDate(d[i]) - toDate(d[i - 1])) / 864e5); });
      const rows = S.agenda.filter(r => r.d.slice(0, 7) === m); const sched = {}, done = {}; rows.forEach(r => { const k = kindOf(r); if (!r.p) return; if (['realizado', 'falta', 'falta_cob', 'canc_pac', 'sembaixa'].includes(k)) sched[r.p] = (sched[r.p] || 0) + 1; if (k === 'realizado') done[r.p] = (done[r.p] || 0) + 1; });
      const ad = Object.keys(sched).map(p => (done[p] || 0) / sched[p]);
      const b = { b1: 0, b2: 0, b3: 0, b4: 0 }; act.forEach(([, d]) => { const n = d.length; if (n === 1) b.b1++; else if (n <= 3) b.b2++; else if (n <= 7) b.b3++; else b.b4++; });
      perM[m] = { ativos: act.length, spp: act.length ? act.reduce((s, [, d]) => s + d.length, 0) / act.length : null, gap: avg(gaps), ad: avg(ad), ...b };
    });
    const lm = lastM(ms); const perm = Object.entries(byP).filter(([, ds]) => ds.some(d => d.slice(0, 7) === lm)).map(([, ds]) => Math.max(1, Math.round((toDate(ds[ds.length - 1]) - toDate(ds[0])) / 864e5 / 30)));
    return `<div class="kpis">${k2('Sessões/pac.', 'Sessões por paciente no mês', isNum(perM[lm].spp) ? fmtNum(perM[lm].spp, 1) : '—', `Média de sessões realizadas por paciente ativo em ${monthLabel(lm)}.`)}
      ${k2('Intervalo', 'Intervalo médio entre sessões', isNum(perM[lm].gap) ? fmtNum(perM[lm].gap, 1) + ' dias' : '—', 'Dias entre uma sessão e a seguinte do mesmo paciente, dentro do mês.')}
      ${k2('Aderência', 'Aderência ao previsto', isNum(perM[lm].ad) ? fmtPct(perM[lm].ad) : '—', 'Realizadas ÷ (realizadas + faltas + cancelamentos do paciente), média por paciente.', isNum(perM[lm].ad) && perM[lm].ad >= .85 ? 'good' : 'neu')}
      ${k2('Permanência', 'Tempo de permanência', perm.length ? fmtNum(avg(perm), 1) + ' meses' : '—', 'Entre a primeira e a última sessão dos pacientes ativos no último mês (limitado ao período do arquivo).')}</div>
    <div class="card"><div class="chead"><h3>Por mês</h3></div>${monthTable(ms, [
      { l: 'Pacientes ativos', f: m => perM[m].ativos, agg: 'avg' }, { l: 'Sessões por paciente', f: m => perM[m].spp, fmt: v => fmtNum(v, 1), agg: 'avg' },
      { l: 'Intervalo médio entre sessões (dias)', f: m => perM[m].gap, fmt: v => fmtNum(v, 1), agg: 'avg' }, { l: 'Aderência ao previsto', f: m => perM[m].ad, fmt: v => fmtPct(v), agg: 'avg' },
      { l: 'Pacientes com 1 sessão', f: m => perM[m].b1, agg: 'avg' }, { l: 'Pacientes com 2 a 3 sessões', f: m => perM[m].b2, agg: 'avg' }, { l: 'Pacientes com 4 a 7 sessões', f: m => perM[m].b3, agg: 'avg' }, { l: 'Pacientes com 8 ou mais sessões', f: m => perM[m].b4, agg: 'avg' }])}
    <div class="howto"><b>Como ler:</b> continuidade é o que sustenta o resultado terapêutico e a receita recorrente. Muitos pacientes com poucas sessões no mês, ou intervalo alto entre sessões, indicam risco de abandono. O paciente aparece só pelo código.</div></div>`;
  }

  /* ---------- 4. Produtividade por profissional ---------- */
  function tabProd(A, ms) {
    const rows = rowsIn(ms); const by = {};
    rows.forEach(r => { const k = kindOf(r); if (k === 'ignorar') return; const o = (by[r.prof || 'Não informado'] = by[r.prof || 'Não informado'] || { real: 0, falta: 0, ag: 0, rec: 0 }); if (k === 'realizado') { o.real++; const pr = pkgPrice(r) !== undefined ? pkgPrice(r) : priceOf(r); if (isNum(pr)) o.rec += pr; } if (k === 'falta' || k === 'falta_cob') o.falta++; if (PAST_KINDS.includes(k)) o.ag++; });
    const list = Object.entries(by).map(([n, o]) => { const p = S.cad.profs.find(x => x.name === n); const cap = p ? ms.reduce((s, m) => s + (profCapacity(p, m) || 0), 0) : 0; const sl = p ? slotMin(p) : (toNum(S.cad.clinic.slot) || 50); const hg = cap * sl / 60;
      return { n, ...o, cap, hg, ocup: div(o.real, cap), rph: div(o.rec, hg), aph: div(o.real, hg), abs: div(o.falta, o.real + o.falta) }; }).sort((a, b) => b.real - a.real);
    return `<div class="card"><div class="chead"><h3>Produtividade por profissional (${esc(periodLabel(ms))})</h3></div><div class="tscroll"><table class="tbl"><thead><tr><th>Profissional</th><th>Realizados</th><th>Horas de grade</th><th>Ocupação</th><th>Atend./hora de grade</th><th>Receita estimada</th><th>Receita/hora de grade</th><th>Absenteísmo</th></tr></thead><tbody>
    ${list.map(o => `<tr><td><b>${esc(o.n)}</b></td><td class="num">${fmtNum(o.real)}</td><td class="num">${o.hg ? fmtNum(o.hg, 0) : '—'}</td><td class="num">${isNum(o.ocup) ? fmtPct(o.ocup) : '—'}</td><td class="num">${isNum(o.aph) ? fmtNum(o.aph, 2) : '—'}</td><td class="num">${fmtMoney(o.rec)}</td><td class="num">${isNum(o.rph) ? fmtMoney(o.rph) : '—'}</td><td class="num">${isNum(o.abs) ? fmtPct(o.abs) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="howto"><b>Como ler:</b> compara quanto cada profissional produz por hora de grade disponível, o que separa quem atende pouco por ter pouca demanda de quem tem grade subutilizada. Profissionais sem grade cadastrada não têm ocupação nem produtividade por hora.</div></div>`;
  }

  /* ---------- 5. Lista de espera ---------- */
  const ESP_SYN = { nome: ['paciente', 'nome', 'responsavel', 'cliente'], d: ['data de entrada', 'data entrada', 'data da solicitacao', 'data solicitacao', 'cadastro', 'data de cadastro', 'data'], esp: ['especialidade', 'servico', 'terapia', 'area'], payer: ['convenio', 'operadora', 'plano', 'pagador'], prof: ['profissional', 'terapeuta'], st: ['situacao', 'status'], saida: ['data de saida', 'data saida', 'data de agendamento', 'data atendimento', 'data de inicio'] };
  function importEspera() {
    const inp = $('fileSheet'); inp.value = ''; inp.accept = '.xlsx,.xls,.csv'; if (!window.XLSX) return toast('Leitor de planilhas indisponível.', 'bad');
    inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try {
      const wb = XLSX.read(r.result, { type: 'array', cellDates: true }); const { headers, rows } = sheetRows(wb.Sheets[wb.SheetNames[0]]);
      const col = k => headers.find(h => ESP_SYN[k].some(s => norm(h) === s)) || headers.find(h => ESP_SYN[k].some(s => norm(h).includes(s)));
      const c = Object.fromEntries(Object.keys(ESP_SYN).map(k => [k, col(k)])); if (!c.nome && !c.d) throw new Error('não encontrei colunas de paciente e data de entrada');
      const out = rows.map(x => ({ p: c.nome ? hashId(x[c.nome]) : '', d: c.d ? (isoDateOf(x[c.d])) : '', esp: c.esp ? String(x[c.esp] || '').trim() : '', payer: c.payer ? String(x[c.payer] || '').trim() : '', prof: c.prof ? String(x[c.prof] || '').trim() : '', st: c.st ? String(x[c.st] || '').trim() : '', saida: c.saida ? isoDateOf(x[c.saida]) : '' })).filter(x => x.d || x.p);
      S.espera = out; save(true); toast(`${out.length} pessoas na lista de espera importadas (nomes descartados).`, 'good'); render();
    } catch (x) { toast('Não foi possível ler a lista de espera: ' + x.message, 'bad'); } }; r.readAsArrayBuffer(f); }; inp.click();
  }
  const isoDateOf = v => { if (!v) return ''; if (v instanceof Date) return isoLocal(v); const s = String(v).trim(); const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; };
  function tabEspera(A, ms) {
    const L = S.espera || []; const hoje = isoLocal(new Date());
    const head = `<div class="card smart"><div><h3>Lista de espera</h3><p>Planilha com uma linha por pessoa na fila: paciente, data de entrada, especialidade, convênio e situação. Os nomes são trocados por código na importação e não ficam gravados.</p></div><button class="btn" onclick="AgAdv.importEspera()">Importar lista de espera</button></div>`;
    if (!L.length) return head + notice('', 'Nenhuma lista importada. Colunas reconhecidas: paciente, data de entrada, especialidade, convênio, profissional, situação e data de saída.');
    const ativa = x => !x.saida && !/atendid|agendad|conclu|cancel|desist|alta|iniciou/.test(norm(x.st));
    const fila = L.filter(ativa); const dias = x => x.d ? Math.max(0, Math.round((toDate(x.saida || hoje) - toDate(x.d)) / 864e5)) : null;
    const byE = {}; fila.forEach(x => { const o = (byE[x.esp || 'Não informada'] = byE[x.esp || 'Não informada'] || { n: 0, d: [] }); o.n++; const dd = dias(x); if (isNum(dd)) o.d.push(dd); });
    const saidos = L.filter(x => x.saida && x.d).map(dias); const freq = A.freq && A.ms.length ? A.freq / A.ms.length : null;
    const semana = isNum(A.freq) ? Math.round(fila.length * (A.freq / 4.3) * 10) / 10 : null;
    return head + `<div class="kpis">${k2('Na fila', 'Pessoas aguardando', fmtNum(fila.length), `De ${fmtNum(L.length)} registros importados.`, fila.length ? 'bad' : 'good')}
      ${k2('Espera', 'Tempo médio na fila', fila.length ? fmtNum(avg(fila.map(dias)), 0) + ' dias' : '—', 'Da data de entrada até hoje, para quem ainda aguarda.')}
      ${k2('Até agendar', 'Tempo médio até a saída', saidos.length ? fmtNum(avg(saidos), 0) + ' dias' : '—', 'Quem já saiu da fila (precisa da coluna de data de saída).')}
      ${k2('Demanda', 'Sessões por semana reprimidas', isNum(semana) ? fmtNum(semana, 0) : '—', 'Pessoas na fila × frequência média de sessões por paciente da agenda.')}</div>
    <div class="card"><div class="chead"><h3>Fila por especialidade</h3></div><div class="tscroll"><table class="tbl"><thead><tr><th>Especialidade</th><th>Aguardando</th><th>Tempo médio (dias)</th><th>Mais antigo (dias)</th></tr></thead><tbody>
    ${Object.entries(byE).sort((a, b) => b[1].n - a[1].n).map(([e, o]) => `<tr><td><b>${esc(e)}</b></td><td class="num">${o.n}</td><td class="num">${fmtNum(avg(o.d), 0)}</td><td class="num">${o.d.length ? Math.max(...o.d) : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="howto"><b>Como ler:</b> compare a fila com as vagas livres da aba Capacidade e ociosidade: vaga sobrando em um horário e gente esperando na mesma especialidade é receita disponível sem captação nova.</div></div>
    <div class="row"><button class="btn sm danger" onclick="if(confirm('Apagar a lista de espera importada?')){S.espera=[];save(true);AgAdv.render()}">Apagar lista importada</button></div>`;
  }

  /* ---------- 6. Qualidade do dado ---------- */
  function tabDado(A, ms) {
    const rows = rowsIn(ms); const n = rows.length || 1; const seen = new Set(); let dup = 0; rows.forEach(r => { const k = [r.p, r.d, r.h, r.prof].join('|'); if (seen.has(k)) dup++; else seen.add(k); });
    const semProfGrade = S.cad.profs.filter(p => p.active !== false && !Object.values(p.grade || {}).some(v => v));
    const futReal = rows.filter(r => kindOf(r) === 'realizado' && r.d > dataCut()).length;
    const items = [
      ['Atendimentos sem preço na tabela', A.semPreco, 'A receita estimada fica incompleta. Complete a tabela em Cadastros.', A.semPreco > 0],
      ['Agendamentos sem baixa', A.K.sembaixa, 'Passaram da data e não têm registro do que aconteceu.', A.K.sembaixa > 0],
      ['Registros sem código de paciente', rows.filter(r => !r.p).length, 'Não entram em pacientes ativos, novos e evadidos.', rows.some(r => !r.p)],
      ['Registros sem horário', rows.filter(r => !r.h).length, 'Não entram no mapa de uso nem na reocupação.', rows.some(r => !r.h)],
      ['Registros sem convênio', rows.filter(r => !r.payer || /nao informado/i.test(norm(r.payer))).length, 'Aparecem como "Não informado" nas análises por convênio.', rows.some(r => !r.payer || /nao informado/i.test(norm(r.payer)))],
      ['Registros duplicados (mesmo paciente, dia, hora e profissional)', dup, 'Podem inflar atendimentos. Confira o arquivo de origem.', dup > 0],
      ['Realizados com data futura', futReal, 'Data após o último dia do arquivo: possível erro de data.', futReal > 0],
      ['Profissionais ativos sem grade', semProfGrade.length, semProfGrade.map(p => p.name).join(', ') || '', semProfGrade.length > 0],
      ['Status ainda não classificados', S.cad.statusOK ? 0 : 1, 'Confirme em Cadastros › Status da agenda como cada status conta (ocupa horário, fatura).', !S.cad.statusOK]
    ];
    return `<div class="card"><div class="chead"><h3>Qualidade do dado da agenda</h3><span class="chip ${items.some(i => i[3]) ? 'no' : 'ok'}">${items.filter(i => i[3]).length} ponto(s) de atenção</span></div><div class="tscroll"><table class="tbl"><thead><tr><th>Verificação</th><th>Quantidade</th><th>% do período</th><th>O que significa</th></tr></thead><tbody>
    ${items.map(([t, c, d, bad]) => `<tr><td><b>${t}</b></td><td class="num ${bad ? 'neg' : ''}">${fmtNum(c)}</td><td class="num">${t.startsWith('Profissionais') || t.startsWith('Status') ? '—' : fmtPct(c / n)}</td><td><small>${esc(d)}</small></td></tr>`).join('')}</tbody></table></div>
    <div class="howto"><b>Como ler:</b> corrija na origem (sistema da clínica) sempre que possível. Quanto mais limpo o arquivo, mais confiáveis os indicadores e as decisões sobre capacidade e receita.</div></div>`;
  }

  /* ---------- 7. Capacidade teórica e metas ---------- */
  const METAS = [['comp', 'Taxa de comparecimento', m => div(A_.M[m].realizado, pastN(A_.M[m])), 'pct', 1], ['abs', 'Absenteísmo', m => div(A_.M[m].falta + A_.M[m].falta_cob, A_.M[m].realizado + A_.M[m].falta + A_.M[m].falta_cob), 'pct', -1], ['canc', 'Cancelamentos', m => div(A_.M[m].canc_pac + A_.M[m].canc_clin + A_.M[m].aus_prof, pastN(A_.M[m])), 'pct', -1], ['ocup', 'Ocupação da grade', m => div(A_.M[m].realizado, A_.M[m].cap), 'pct', 1], ['sb', 'Agendamentos sem baixa', m => div(A_.M[m].sembaixa, pastN(A_.M[m])), 'pct', -1], ['ativos', 'Pacientes ativos', m => A_.P[m].ativos, 'num', 1], ['evad', 'Pacientes evadidos', m => A_.P[m].evad, 'num', -1]];
  let A_ = null;
  function tabMetas(A, ms) {
    A_ = A; S.agMetas = S.agMetas || {}; const base = ms[0], cur = lastM(ms);
    const teor = toNum(S.cad.capTeorica);
    const fm = (t, v) => !isNum(v) ? '—' : t === 'pct' ? fmtPct(v) : fmtNum(v, 0);
    const sem = (t, dir, v, meta) => { if (!isNum(v) || !isNum(meta)) return ''; const ok = dir > 0 ? v >= meta : v <= meta; return ok ? '<span class="chip ok">Na meta</span>' : '<span class="chip no">Fora da meta</span>'; };
    return `<div class="card"><div class="chead"><h3>Real × capacidade teórica</h3></div>
      <div class="row" style="align-items:end;gap:14px"><div class="field" style="max-width:300px"><label>Capacidade teórica mensal (atendimentos)</label><input class="cin" value="${isNum(teor) ? teor : ''}" placeholder="ex.: 2167 (do relatório operacional)" onchange="S.cad.capTeorica=toNum(this.value);save();AgAdv.render()"></div><span class="muted"><small>Vem do relatório de diagnóstico operacional (capacidade calculada). Será preenchida automaticamente quando o relatório for importado.</small></span></div>
      ${isNum(teor) ? monthTable(ms, [{ l: 'Realizados', f: m => A.M[m].realizado }, { l: 'Capacidade teórica', f: () => teor, agg: 'none' }, { l: 'Real ÷ teórica', cls: 'b', f: m => div(A.M[m].realizado, teor), fmt: v => fmtPct(v), agg: 'avg' }]) : ''}</div>
    <div class="card"><div class="chead"><h3>Antes × depois e metas</h3></div><div class="tscroll"><table class="tbl"><thead><tr><th>Indicador</th><th>Linha de base (${monthLabel(base)})</th><th>Atual (${monthLabel(cur)})</th><th>Variação</th><th>Meta</th><th>Situação</th></tr></thead><tbody>
    ${METAS.map(([k, l, f, t, dir]) => { const b = f(base), c = f(cur), meta = toNum(S.agMetas[k]); const dv = isNum(b) && isNum(c) ? c - b : null; const better = isNum(dv) ? (dir > 0 ? dv > 0 : dv < 0) : null;
      return `<tr><td><b>${l}</b></td><td class="num">${fm(t, b)}</td><td class="num">${fm(t, c)}</td><td class="num ${better === null ? '' : better ? 'pos' : 'neg'}">${isNum(dv) ? (dv > 0 ? '+' : '') + (t === 'pct' ? fmtNum(dv * 100, 1) + ' p.p.' : fmtNum(dv, 0)) : '—'}</td><td><input class="cin sm" style="width:90px" value="${isNum(meta) ? (t === 'pct' ? fmtNum(meta * 100, 1) : meta) : ''}" placeholder="${t === 'pct' ? 'ex.: 85' : 'ex.: 120'}" onchange="S.agMetas['${k}']=(${t === 'pct' ? 'toNum(this.value)/100' : 'toNum(this.value)'});save();AgAdv.render()"></td><td>${sem(t, dir, c, meta)}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="howto"><b>Como ler:</b> a linha de base é o primeiro mês do período analisado. Para percentuais, digite a meta em % (ex.: 85). A situação compara o mês atual com a meta definida.</div></div>`;
  }

  /* ---------- montagem ---------- */
  function render() {
    const host = document.getElementById('agAdv'); if (!host) return;
    const A = agStats(); const ms = A.ms; let body = '';
    try { body = AGX === 'ocios' ? tabOcios(A, ms) : AGX === 'risco' ? tabRisco(A, ms) : AGX === 'cont' ? tabCont(A, ms) : AGX === 'prod' ? tabProd(A, ms) : AGX === 'espera' ? tabEspera(A, ms) : AGX === 'dado' ? tabDado(A, ms) : tabMetas(A, ms); }
    catch (e) { console.error(e); body = `<div class="card"><div class="notice bad"><b>Não foi possível calcular esta análise.</b> ${esc(e.message)}</div></div>`; }
    host.innerHTML = `<div class="card" style="margin-top:18px"><div class="chead"><h3>Análises avançadas da agenda</h3></div><div class="subtabs" style="margin:0">${TABS.map(([k, l]) => `<button class="${AGX === k ? 'active' : ''}" onclick="AgAdv.tab('${k}')">${l}</button>`).join('')}</div></div>${body}`;
  }
  window.AgAdv = { render, tab: k => { AGX = k; render(); }, importEspera };
  const _ra = renderAgenda;
  renderAgenda = function () { _ra(); const sec = document.getElementById('pg_agenda'); if (!sec || !S.agenda.length) return; let h = document.getElementById('agAdv'); if (!h) { h = document.createElement('div'); h.id = 'agAdv'; sec.appendChild(h); } render(); };
})();
