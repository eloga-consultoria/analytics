/* ELOGA Analytics — exportação da agenda em Excel (com gráficos) e PDF (com gráficos) */
(function () {
  'use strict';

  const slug = s => String(s || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const FMT = { n: v => fmtNum(v), n1: v => fmtNum(v, 1), pct: v => fmtPct(v), money: v => fmtMoney(v), money2: v => fmtMoney2(v) };
  const XFMT = { n: '#,##0', n1: '#,##0.0', pct: '0.0%', money: '"R$" #,##0', money2: '"R$" #,##0.00' };
  const dimName = { prof: 'Profissional', esp: 'Especialidade', proc: 'Procedimento', payer: 'Convênio', unit: 'Unidade' };

  /* ---------- modelo único de dados (usado por Excel e PDF) ---------- */
  function model() {
    const A = agStats(); const ms = A.ms; const K = ST_KINDS.map(x => x[0]).filter(k => k !== 'ignorar' && ms.some(m => A.M[m][k]));
    const F = A.F; const rg = agRange();
    const filtros = [F.prof && 'Profissional: ' + F.prof, F.esp && 'Especialidade: ' + F.esp, F.proc && 'Procedimento: ' + F.proc, F.payer && 'Convênio: ' + F.payer, F.unit && 'Unidade: ' + F.unit,
      rg && ('Período: ' + (F.from ? toDate(F.from).toLocaleDateString('pt-BR') : 'início') + ' a ' + (F.to ? toDate(F.to).toLocaleDateString('pt-BR') : 'fim'))].filter(Boolean);
    const kpis = [
      ['Agendamentos do período', A.passados, 'n', 'Agendamentos com data já ocorrida (sem reagendados e ignorados).'],
      ['Atendimentos realizados', A.K.realizado, 'n', 'Status classificados como realizado.'],
      ['Taxa de comparecimento', A.comp, 'pct', 'Realizados ÷ agendamentos do período. Referência: ≥ 85%.'],
      ['Absenteísmo (faltas)', A.abs, 'pct', 'Faltas ÷ (realizados + faltas). Referência: ≤ 10%.'],
      ['Faltas cobradas', A.K.falta_cob, 'n', 'Faltas do paciente cuja sessão é cobrada.'],
      ['Faltas não cobradas', A.K.falta, 'n', 'Faltas do paciente sem cobrança.'],
      ['Sem baixa', A.sb, 'pct', 'Passaram da data e não têm registro do que aconteceu.'],
      ['Cancelamentos', A.canc, 'pct', 'Paciente, clínica e ausência do profissional ÷ agendamentos.'],
      ['Ocupação da grade', A.capOK ? A.ocup : null, 'pct', 'Realizados ÷ capacidade da grade dos profissionais.'],
      ['Ocupação das salas', A.ocupRoom, 'pct', 'Realizados ÷ (horário de funcionamento × salas).'],
      ['Pacientes ativos no último mês', A.ativosUlt, 'n', 'Com atendimento realizado no último mês do período.'],
      ['Pacientes novos', A.novos, 'n', 'Primeira vez na agenda.'],
      ['Pacientes evadidos', A.evad, 'n', 'Tinham agendamento no mês anterior e nenhum no mês.'],
      ['Receita estimada', A.receita, 'money', 'Realizados + faltas cobradas × tabela do convênio. Não é o faturado.'],
      ['Ticket médio', A.ticket, 'money2', 'Receita estimada ÷ atendimentos cobráveis com preço.'],
      ['Receita por paciente', A.recPac, 'money', 'Receita estimada ÷ pacientes atendidos.']
    ];
    const pm = m => A.M[m];
    const sections = [
      { id: 'resultado', title: 'Resultado dos agendamentos por mês', cfg: () => cfgAgMonth(), note: AG_NOTES.month, rows: K.map(k => ({ l: KSHORT[k], f: m => pm(m)[k], kind: 'n' })).concat([
        { l: 'Agendamentos do período', f: m => pastN(pm(m)), kind: 'n', b: 1 }, { l: 'Taxa de comparecimento', f: m => div(pm(m).realizado, pastN(pm(m))), kind: 'pct', tot: A.comp }, { l: 'Absenteísmo', f: m => div(pm(m).falta + pm(m).falta_cob, pm(m).realizado + pm(m).falta + pm(m).falta_cob), kind: 'pct', tot: A.abs }]) },
      { id: 'ocupacao', title: 'Ocupação e preenchimento da agenda', cfg: () => cfgAgOcup(), note: AG_NOTES.ocup, rows: [
        { l: 'Capacidade da grade dos profissionais', f: m => pm(m).cap, kind: 'n' }, { l: 'Capacidade das salas', f: m => pm(m).capRoom, kind: 'n' }, { l: 'Agendamentos (inclui futuros)', f: m => pastN(pm(m)) + pm(m).agendado, kind: 'n' },
        { l: 'Realizados', f: m => pm(m).realizado, kind: 'n' }, { l: 'Faltas', f: m => pm(m).falta + pm(m).falta_cob, kind: 'n' },
        { l: 'Ocupação da grade', f: m => div(pm(m).realizado, pm(m).cap), kind: 'pct', tot: A.ocup, b: 1 }, { l: 'Preenchimento da grade', f: m => div(pastN(pm(m)) + pm(m).agendado, pm(m).cap), kind: 'pct', tot: A.preench }, { l: 'Ocupação das salas', f: m => div(pm(m).realizado, pm(m).capRoom), kind: 'pct', tot: A.ocupRoom }] },
      { id: 'pacientes', title: 'Pacientes por mês: ativos, novos, retornos e evadidos', cfg: () => cfgAgPac(), note: AG_NOTES.pac, rows: [
        { l: 'Ativos (atendidos no mês)', f: m => A.P[m].ativos, kind: 'n', tot: A.ativosUlt }, { l: 'Novos', f: m => A.P[m].novos, kind: 'n' }, { l: 'Retornos', f: m => A.P[m].ret, kind: 'n' }, { l: 'Evadidos', f: m => A.P[m].evad, kind: 'n' },
        { l: 'Saldo (novos + retornos − evadidos)', f: m => A.P[m].novos + A.P[m].ret - A.P[m].evad, kind: 'n', b: 1 }] },
      { id: 'receita', title: 'Receita estimada por mês', cfg: () => cfgAgRec(), note: AG_NOTES.rec, rows: [
        { l: 'Atendimentos cobráveis', f: m => pm(m).eleg, kind: 'n' }, { l: 'Receita estimada', f: m => pm(m).receita, kind: 'money', b: 1 }, { l: 'Pacientes atendidos', f: m => pm(m).pac.size, kind: 'n', tot: A.pacientes },
        { l: 'Receita por paciente', f: m => div(pm(m).receita, pm(m).pac.size), kind: 'money', tot: A.recPac }, { l: 'Ticket médio', f: m => div(pm(m).receita, pm(m).eleg), kind: 'money2', tot: A.ticket }] }
    ];
    sections.forEach(sec => sec.rows.forEach(r => { r.v = ms.map(m => r.f(m)); if (r.tot === undefined) r.tot = r.kind === 'pct' || r.kind === 'n1' ? null : r.v.filter(isNum).reduce((a, b) => a + b, 0); }));
    // quadros por dimensão
    const dims = ['prof', 'esp', 'payer', 'proc'].concat(AgUn.has() ? ['unit'] : []);
    const kk = K.filter(x => x !== 'agendado');
    const quadros = dims.map(dk => {
      const head = [dimName[dk], 'Agendamentos'].concat(kk.map(x => KSHORT[x]), ['Comparecimento'], dk === 'prof' ? ['Ocupação'] : [], ['Pacientes', 'Receita estimada']);
      const kinds = ['txt', 'n'].concat(kk.map(() => 'n'), ['pct'], dk === 'prof' ? ['pct'] : [], ['n', 'money']);
      const rows = Object.entries(A.dims[dk]).map(([n, g]) => ({ n, g, pas: pastN(g) })).filter(x => x.pas).sort((a, b) => b.g.realizado - a.g.realizado)
        .map(({ n, g, pas }) => [n, pas].concat(kk.map(x => g[x]), [div(g.realizado, pas)], dk === 'prof' ? [div(g.realizado, A.capProf[n])] : [], [g.pac.size, g.receita]));
      return { dk, title: 'Quadro por ' + dimName[dk].toLowerCase(), head, kinds, rows };
    });
    // classificação de status do período
    const cnt = {}; const set = new Set(ms); const rgx = agRange();
    S.agenda.forEach(r => { if (!set.has(r.d.slice(0, 7)) || (rgx && (r.d < rgx[0] || r.d > rgx[1]))) return; const k = stKey(r); cnt[k] = (cnt[k] || 0) + 1; });
    const lab = Object.fromEntries(ST_KINDS);
    const status = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k.replace(' ▸ ', ' · '), n, lab[S.cad.statusMap[k] || defaultKind(k)] || '']);
    return { A, ms, kpis, sections, quadros, status, filtros, name: S.meta.tradeName || S.meta.company || 'Cliente', per: periodLabel(ms) };
  }

  /* ---------- Excel com gráficos ---------- */
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'exceljs.min.js'; s.onload = res; s.onerror = () => rej(new Error('biblioteca de Excel não carregou')); document.head.appendChild(s); });
  }
  async function xlsx() {
    try {
      if (!S.agenda.length) return toast('Importe a agenda antes de exportar.', 'bad');
      loader('Gerando o Excel com os gráficos...'); await loadExcelJS();
      const d = model(); const wb = new ExcelJS.Workbook(); wb.creator = 'ELOGA Analytics'; wb.created = new Date();
      const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2F3A' } }, alignment: { vertical: 'middle', wrapText: true } };
      const style = row => row.eachCell(c => Object.assign(c, HEAD));
      const top = (ws, title, sub) => { ws.getCell('A1').value = 'ELOGA — Consultoria & Estratégias em Saúde'; ws.getCell('A1').font = { bold: true, size: 10, color: { argb: 'FF5211FB' } };
        ws.getCell('A2').value = title; ws.getCell('A2').font = { bold: true, size: 15, color: { argb: 'FF011C27' } };
        ws.getCell('A3').value = d.name + ' · ' + d.per + (d.filtros.length ? ' · ' + d.filtros.join(' · ') : ''); ws.getCell('A3').font = { color: { argb: 'FF5F6F77' } };
        if (sub) { ws.getCell('A4').value = sub; ws.getCell('A4').font = { italic: true, color: { argb: 'FF5F6F77' } }; } };
      // Resumo
      const r1 = wb.addWorksheet('Resumo'); top(r1, 'Agenda e atendimentos — resumo');
      r1.addRow([]); style(r1.addRow(['Indicador', 'Valor', 'Como é calculado']));
      d.kpis.forEach(([l, v, k, n]) => { const row = r1.addRow([l, isNum(v) ? v : '—', n]); if (isNum(v)) row.getCell(2).numFmt = XFMT[k]; });
      r1.columns = [{ width: 34 }, { width: 18 }, { width: 90 }];
      // Seções mensais (gráfico + tabela)
      for (const sec of d.sections) {
        const ws = wb.addWorksheet(sec.title.slice(0, 31).replace(/[:\\/?*\[\]]/g, '')); top(ws, sec.title, sec.note);
        let line = 6; const img = sec.cfg() ? chartImage(sec.cfg()) : null;
        if (img) { const id = wb.addImage({ base64: img, extension: 'png' }); ws.addImage(id, { tl: { col: 0, row: line - 1 }, ext: { width: 920, height: 408 } }); line += 22; }
        ws.getRow(line).values = ['Indicador'].concat(d.ms.map(monthLabel), ['Total']); style(ws.getRow(line));
        sec.rows.forEach((r, i) => { const row = ws.getRow(line + 1 + i); row.values = [r.l].concat(r.v.map(v => isNum(v) ? v : null), [isNum(r.tot) ? r.tot : null]); for (let c = 2; c <= d.ms.length + 2; c++) row.getCell(c).numFmt = XFMT[r.kind]; if (r.b) row.font = { bold: true }; });
        ws.columns = [{ width: 42 }].concat(d.ms.map(() => ({ width: 12 })), [{ width: 14 }]);
      }
      // Quadros por dimensão (+ gráfico de ocupação por profissional)
      for (const q of d.quadros) {
        const ws = wb.addWorksheet(('Por ' + dimName[q.dk].toLowerCase()).slice(0, 31)); top(ws, q.title); let line = 5;
        if (q.dk === 'prof' && cfgAgProfOcup()) { const img = chartImage(cfgAgProfOcup(), 1200, 640); if (img) { ws.addImage(wb.addImage({ base64: img, extension: 'png' }), { tl: { col: 0, row: 4 }, ext: { width: 800, height: 427 } }); line = 27; } }
        ws.getRow(line).values = q.head; style(ws.getRow(line));
        q.rows.forEach((r, i) => { const row = ws.getRow(line + 1 + i); row.values = r; r.forEach((v, c) => { if (q.kinds[c] !== 'txt') row.getCell(c + 1).numFmt = XFMT[q.kinds[c]]; }); });
        ws.columns = q.head.map((h, i) => ({ width: i === 0 ? 36 : 14 }));
      }
      const st = wb.addWorksheet('Status e classificação'); top(st, 'Classificação dos status no período', 'A falta do paciente é contada como cobrada ou não cobrada conforme a classificação abaixo.');
      st.getRow(6).values = ['Status no sistema', 'Registros', 'Classificado como']; style(st.getRow(6)); d.status.forEach((r, i) => st.getRow(7 + i).values = r); st.columns = [{ width: 40 }, { width: 12 }, { width: 44 }];
      const buf = await wb.xlsx.writeBuffer(); loader();
      download(`ELOGA_Agenda_${slug(d.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast('Excel gerado com tabelas e gráficos.', 'good');
    } catch (e) { loader(); console.error(e); toast('Não foi possível gerar o Excel: ' + e.message, 'bad'); }
  }

  /* ---------- PDF com gráficos ---------- */
  function pdf() {
    try {
      if (!S.agenda.length) return toast('Importe a agenda antes de exportar.', 'bad');
      if (!window.jspdf) return toast('Gerador de PDF indisponível.', 'bad');
      loader('Gerando o PDF com os gráficos...');
      setTimeout(() => { try { buildAgendaPDF(); } catch (e) { console.error(e); toast('Não foi possível gerar o PDF: ' + e.message, 'bad'); } finally { loader(); } }, 30);
    } catch (e) { loader(); toast('Não foi possível gerar o PDF: ' + e.message, 'bad'); }
  }
  function buildAgendaPDF() {
    const d = model(); const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, H = 297, M = 14, CW = W - 2 * M, TOP = 32, BOT = 278; let y = TOP;
    const setC = (a, t = 'text') => t === 'fill' ? doc.setFillColor(...a) : t === 'draw' ? doc.setDrawColor(...a) : doc.setTextColor(...a);
    const font = (sz, st = 'normal', col = PDF_C.ink) => { doc.setFont('helvetica', st); doc.setFontSize(sz); setC(col); };
    const text = (s, x, yy, o) => doc.text(pdfTxt(s), x, yy, o);
    const drawn = new Set([1]);
    function letterhead() {
      setC(PDF_C.petro, 'fill'); doc.rect(0, 0, W, 24, 'F'); setC(PDF_C.lima, 'fill'); doc.rect(0, 24, W, 1.3, 'F');
      try { doc.addImage(LOGO_LIGHT, 'PNG', M, 4.2, 44, 44 * 166 / 900, undefined, 'FAST'); font(6.3, 'normal', [190, 208, 212]); text('CONSULTORIA & ESTRATÉGIAS EM SAÚDE', M, 20.6); } catch (e) { font(17, 'bold', [255, 255, 255]); text('ELOGA', M, 13); }
      font(8, 'bold', [255, 255, 255]); text(d.name, W - M, 10, { align: 'right' }); font(7.5, 'normal', [190, 208, 212]); text('Agenda e atendimentos · ' + d.per, W - M, 15.5, { align: 'right' });
    }
    const newPage = () => { doc.addPage(); drawn.add(doc.getNumberOfPages()); letterhead(); y = TOP; }; const need = h => { if (y + h > BOT) newPage(); };
    const title = (s, sub) => { need(20); font(14, 'bold', PDF_C.petro); text(s, M, y); setC(PDF_C.roxo, 'fill'); doc.rect(M, y + 2.2, 18, 1, 'F'); y += 8; if (sub) { font(8.5, 'normal', PDF_C.muted); const l = doc.splitTextToSize(pdfTxt(sub), CW); doc.text(l, M, y); y += l.length * 4 + 2; } };
    const tbl = (head, body, opts = {}) => { doc.autoTable(Object.assign({ startY: y, margin: { left: M, right: M, top: TOP, bottom: H - BOT }, head: [head.map(pdfTxt)], body: body.map(r => r.map(pdfTxt)), theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: PDF_C.ink, lineColor: PDF_C.line, lineWidth: 0.15 }, headStyles: { fillColor: PDF_C.petro, textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: PDF_C.soft },
      didDrawPage: dd => { if (!drawn.has(dd.pageNumber)) { drawn.add(dd.pageNumber); letterhead(); } } }, opts)); y = doc.lastAutoTable.finalY + 6; };
    letterhead();
    font(9, 'normal', PDF_C.muted); if (d.filtros.length) { const l = doc.splitTextToSize(pdfTxt('Filtros: ' + d.filtros.join(' · ')), CW); doc.text(l, M, y); y += l.length * 4 + 2; }
    title('Resumo do período', 'Números calculados a partir da agenda importada e da classificação de status confirmada para este cliente.');
    tbl(['Indicador', 'Valor', 'Como é calculado'], d.kpis.map(([l, v, k, n]) => [l, isNum(v) ? FMT[k](v) : '—', n]), { columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 26, halign: 'right' } } });
    for (const sec of d.sections) {
      need(125); title(sec.title); const cfg = sec.cfg();
      if (cfg) { const img = chartImage(cfg); if (img) { const h = 78; need(h + 4); setC(PDF_C.line, 'draw'); doc.rect(M, y, CW, h); doc.addImage(img, 'PNG', M + 1, y + 1, CW - 2, h - 2, undefined, 'FAST'); y += h + 4; } }
      const head = ['Indicador'].concat(d.ms.map(monthLabel), ['Total']); const cs = { 0: { cellWidth: d.ms.length > 8 ? 44 : 56, fontStyle: 'bold' } };
      tbl(head, sec.rows.map(r => [r.l].concat(r.v.map(v => isNum(v) ? FMT[r.kind](v) : '—'), [isNum(r.tot) ? FMT[r.kind](r.tot) : '—'])), { columnStyles: cs, styles: { fontSize: d.ms.length > 8 ? 6.3 : 7.2, cellPadding: 1.3 } });
      font(8, 'normal', PDF_C.muted); const nl = doc.splitTextToSize(pdfTxt('Como ler: ' + sec.note), CW); need(nl.length * 3.6 + 2); doc.text(nl, M, y - 2); y += nl.length * 3.6 + 2;
    }
    const prof = d.quadros.find(q => q.dk === 'prof');
    for (const q of d.quadros) {
      need(40); title(q.title);
      if (q.dk === 'prof') { const cfg = cfgAgProfOcup(); const img = cfg && chartImage(cfg, 1200, 640); if (img) { const h = 80; need(h + 4); setC(PDF_C.line, 'draw'); doc.rect(M, y, 150, h); doc.addImage(img, 'PNG', M + 1, y + 1, 148, h - 2, undefined, 'FAST'); y += h + 4; } }
      tbl(q.head, q.rows.map(r => r.map((v, c) => q.kinds[c] === 'txt' ? v : (isNum(v) ? FMT[q.kinds[c]](v) : '—'))), { styles: { fontSize: 6.6, cellPadding: 1.2 } });
    }
    need(40); title('Status e classificação', 'A falta do paciente é cobrada ou não conforme a classificação abaixo. Isso define a receita estimada e a receita em risco.');
    tbl(['Status no sistema', 'Registros', 'Classificado como'], d.status.map(r => [r[0], FMT.n(r[1]), r[2]]));
    const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); font(7, 'normal', PDF_C.muted); text('ELOGA Analytics · ' + d.name, M, 291); text('Página ' + i + ' de ' + n, W - M, 291, { align: 'right' }); }
    doc.save(`ELOGA_Agenda_${slug(d.name)}_${new Date().toISOString().slice(0, 10)}.pdf`); toast('PDF gerado com tabelas e gráficos.', 'good');
  }

  window.AgExp = { model, xlsx, pdf };
})();
