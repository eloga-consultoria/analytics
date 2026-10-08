/* ELOGA Analytics — Fluxo de caixa do cliente: planilha modelo, leitura e quadro mês a mês estilo Nibo */
(function () {
  'use strict';
  /* linha do modelo -> campo do painel */
  const ROWS = [
    ['ENTRADAS', null, 'h'],
    ['Recebimentos de convênios', 'rec_conv', 'e', ['recebimentos de convenios', 'convenios', 'receita de convenios', 'operadoras']],
    ['Recebimentos de particulares', 'rec_part', 'e', ['recebimentos de particulares', 'particulares', 'receita particular', 'particular']],
    ['Outras entradas', 'rec_out', 'e', ['outras entradas', 'outras receitas', 'liminares']],
    ['SAÍDAS', null, 'h'],
    ['Repasse / folha da assistência', 'cv_prof', 's', ['repasse', 'folha assistencia', 'profissionais', 'terapeutas']],
    ['Equipe administrativa e pró-labore', 'cf_pessoal', 's', ['equipe administrativa', 'pessoal administrativo', 'pro labore', 'administrativo']],
    ['Aluguel, condomínio e utilidades', 'cf_ocupacao', 's', ['aluguel', 'ocupacao', 'condominio', 'utilidades']],
    ['Insumos e materiais', 'cv_insumos', 's', ['insumos', 'materiais']],
    ['Impostos', 'impostos', 's', ['impostos', 'tributos']],
    ['Taxas de cartão e bancárias', 'taxas', 's', ['taxas', 'taxas de cartao', 'tarifas']],
    ['Sistemas, marketing e outros fixos', 'cf_outros', 's', ['outros fixos', 'sistemas', 'marketing', 'outras saidas', 'outras despesas']],
    ['Despesas financeiras (juros e multas)', 'desp_fin', 's', ['despesas financeiras', 'juros']],
    ['Parcelas de empréstimos', 'div_parcela', 's', ['parcelas de emprestimos', 'parcelas', 'emprestimos', 'dividas']],
    ['SALDO', null, 'h'],
    ['Saldo de caixa no fim do mês', 'caixa', 'c', ['saldo de caixa', 'saldo final', 'saldo']]
  ];
  const syn = r => [norm(r[0]), ...(r[3] || []).map(norm)];

  function modelo() {
    if (!window.XLSX) return toast('Gerador de planilha indisponível.', 'bad');
    const ms = []; let m = addMonths(lastM(windowMonths()), -11); for (let i = 0; i < 12; i++) { ms.push(m); m = addMonths(m, 1); }
    const wb = XLSX.utils.book_new();
    const ins = [['ELOGA | Fluxo de caixa do cliente — modelo'], [''], ['Preencha os valores PAGOS e RECEBIDOS (regime de caixa) mês a mês, em R$. Pode deixar linhas e meses em branco.'], ['A linha de cabeçalho com os meses (AAAA-MM) deve ser mantida. Não inclua nomes de pacientes.'], [''], ['Linha', 'Alimenta o indicador'], ['Recebimentos (convênios + particulares + outras)', 'Total recebido no mês → conversão em caixa, prazo e fluxo'], ['Repasse / folha da assistência', 'Custos variáveis: profissionais'], ['Equipe administrativa, aluguel, sistemas', 'Custos fixos'], ['Insumos, impostos, taxas', 'Custos variáveis / deduções'], ['Despesas financeiras e parcelas', 'Margem líquida e comprometimento com dívidas'], ['Saldo de caixa no fim do mês', 'Dias de caixa e geração de caixa']];
    const w1 = XLSX.utils.aoa_to_sheet(ins); w1['!cols'] = [{ wch: 52 }, { wch: 70 }]; XLSX.utils.book_append_sheet(wb, w1, 'Instruções');
    const aoa = [['Conta', ...ms]]; ROWS.forEach(r => aoa.push([r[0], ...ms.map(() => '')]));
    const w2 = XLSX.utils.aoa_to_sheet(aoa); w2['!cols'] = [{ wch: 40 }, ...ms.map(() => ({ wch: 12 }))]; XLSX.utils.book_append_sheet(wb, w2, 'Fluxo de caixa');
    XLSX.writeFile(wb, 'ELOGA_Modelo_Fluxo_de_Caixa_do_Cliente.xlsx');
  }

  let PEND = null;
  async function read(f) {
    if (!f) return; loader('Lendo planilha de fluxo de caixa...');
    try {
      const aoa = await readAOA(f); let hr = -1, cols = {};
      for (let i = 0; i < Math.min(aoa.length, 30); i++) { const c = {}; (aoa[i] || []).forEach((v, j) => { const ym = j > 0 ? toYM(v) : null; if (ym) c[j] = ym; }); if (Object.keys(c).length >= 2) { hr = i; cols = c; break; } }
      if (hr < 0) { loader(); return toast('Não encontrei a linha com os meses (AAAA-MM).', 'bad'); }
      const out = {}; const found = [];
      for (let i = hr + 1; i < aoa.length; i++) { const lab = norm(String((aoa[i] || [])[0] || '')); if (!lab) continue; const row = ROWS.find(r => r[1] && syn(r).includes(lab)); if (!row) continue; found.push(row[0]);
        Object.entries(cols).forEach(([j, ym]) => { const v = toNum(aoa[i][j]); if (isNum(v)) { (out[ym] = out[ym] || {})[row[1]] = v; } }); }
      const data = {};
      Object.entries(out).forEach(([ym, o]) => { const d = (data[ym] = {}); const ent = ['rec_conv', 'rec_part', 'rec_out'].filter(k => isNum(o[k])); if (ent.length) d.recebido = ent.reduce((s, k) => s + o[k], 0); ['cv_prof', 'cf_pessoal', 'cf_ocupacao', 'cv_insumos', 'impostos', 'taxas', 'cf_outros', 'desp_fin', 'div_parcela', 'caixa'].forEach(k => { if (isNum(o[k])) d[k] = o[k]; }); });
      PEND = { file: f.name, data, found }; loader(); preview();
    } catch (e) { loader(); console.error(e); toast('Não foi possível ler a planilha: ' + e.message, 'bad'); }
  }
  function preview() {
    const box = document.getElementById('fxWork'); if (!box || !PEND) return; const ms = Object.keys(PEND.data).sort(); const keys = [...new Set(ms.flatMap(m => Object.keys(PEND.data[m])))];
    const L = { recebido: 'Total recebido', cv_prof: 'Repasse / folha da assistência', cf_pessoal: 'Equipe administrativa', cf_ocupacao: 'Aluguel e utilidades', cv_insumos: 'Insumos', impostos: 'Impostos', taxas: 'Taxas', cf_outros: 'Outros fixos', desp_fin: 'Despesas financeiras', div_parcela: 'Parcelas de empréstimos', caixa: 'Saldo de caixa' };
    box.innerHTML = `<div class="card work"><h3>Pré-visualização: ${esc(PEND.file)}</h3>${notice('good', `<b>${ms.length} mês(es)</b> e <b>${PEND.found.length} linha(s)</b> reconhecidas. Confira antes de gravar.`)}
      <div class="tscroll"><table class="tbl sm"><thead><tr><th>Linha</th>${ms.map(m => `<th>${monthLabel(m)}</th>`).join('')}</tr></thead><tbody>${keys.map(k => `<tr><td>${esc(L[k] || k)}</td>${ms.map(m => `<td class="num">${isNum(PEND.data[m][k]) ? fmtMoney(PEND.data[m][k]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${notice('', 'Valores já preenchidos manualmente são mantidos em “Preencher só vazios”. Valores calculados por importações (repasse, recebimentos) também são sobrepostos por um valor informado aqui.')}
      <div class="row end"><button class="btn ghost" onclick="Fluxo.cancel()">Cancelar</button><button class="btn" onclick="Fluxo.commit('fill')">Preencher só vazios</button><button class="btn pdf" onclick="Fluxo.commit('replace')">Substituir valores</button></div></div>`;
  }
  function commit(mode) {
    if (!PEND) return; let n = 0; const id = uid();
    Object.entries(PEND.data).forEach(([ym, o]) => Object.entries(o).forEach(([k, v]) => { const cur = (S.monthly[ym] || {})[k]; if (mode === 'fill' && isNum(cur)) return; setCell(ym, k, Math.round(v * 100) / 100); n++; }));
    S.imports.unshift({ id, date: new Date().toISOString(), type: 'mensal', file: PEND.file, count: n, note: 'Fluxo de caixa do cliente · ' + (mode === 'fill' ? 'só vazios' : 'substituição') });
    PEND = null; resetAll(); toast(`${n} valor(es) do fluxo de caixa gravados.`, 'good'); show('fluxo');
  }
  function cancel() { PEND = null; const b = document.getElementById('fxWork'); if (b) b.innerHTML = ''; }
  function pick() { const inp = $('fileSheet'); inp.value = ''; inp.accept = '.xlsx,.xls,.csv'; inp.onchange = e => read(e.target.files[0]); inp.click(); }

  window.renderFluxo = function () {
    const ms = windowMonths(); const g = (m, k) => { const v = B(m)[k]; return isNum(v) ? v : null; };
    const has = flowOk();
    $('pg_fluxo').innerHTML = head('Fluxo de caixa do cliente', 'Entradas, saídas e saldo mês a mês, a partir da planilha modelo preenchida pelo cliente ou do que já foi importado.') + emptyState() +
      `<div class="card smart"><div><h3>Planilha modelo do cliente</h3><p>Entregue o modelo ao cliente, receba preenchido e importe aqui. As linhas alimentam recebido, custos, impostos, dívidas e saldo de caixa (dias de caixa e geração de caixa).</p></div><div class="row" style="margin:0;margin-left:auto"><button class="btn ghost" onclick="Fluxo.modelo()">Baixar modelo (.xlsx)</button><button class="btn pdf" onclick="Fluxo.pick()">Importar planilha preenchida</button></div></div><div id="fxWork"></div>` +
      (has ? `<div class="card"><div class="chead"><h3>Fluxo de caixa: entradas, saídas e saldo</h3></div><div class="cwrap"><canvas id="ch_flow_fluxo"></canvas></div><div class="howto"><b>Como ler:</b> barras verdes = recebido; vermelhas = custos do mês (para baixo); linha = saldo de caixa informado ou acumulado estimado.</div></div>
      <div class="card"><div class="chead"><h3>Quadro mês a mês</h3></div>${monthTable(ms, [
        { l: 'Total recebido (entradas)', f: m => g(m, 'recebido'), fmt: fmtMoney }, { l: 'Repasse / folha da assistência', f: m => g(m, 'cv_prof'), fmt: fmtMoney }, { l: 'Custos fixos', f: m => g(m, 'cf'), fmt: fmtMoney }, { l: 'Insumos, taxas e outros variáveis', f: m => { const x = B(m); const v = (x.cv_insumos || 0) + (x.taxas || 0) + (x.cv_outros || 0); return x.has.cv ? v : null; }, fmt: fmtMoney }, { l: 'Impostos', f: m => g(m, 'impostos'), fmt: fmtMoney },
        { l: 'Despesas financeiras', f: m => g(m, 'desp_fin'), fmt: fmtMoney }, { l: 'Total de saídas', cls: 'b', f: m => g(m, 'custo_total'), fmt: fmtMoney },
        { l: 'Resultado do mês (entradas − saídas)', cls: 'b', f: m => { const e = g(m, 'recebido'), s = g(m, 'custo_total'); return isNum(e) && isNum(s) ? e - s : null; }, fmt: fmtMoney },
        { l: 'Saldo de caixa no fim do mês', cls: 'b', f: m => g(m, 'caixa'), fmt: fmtMoney, agg: 'none' }, { l: 'Dias de caixa', f: m => indicators().dcx.vals[ms.indexOf(m)], fmt: v => fmtDays(v), agg: 'avg' }], { first: 'Linha' })}</div>` : notice('warn', 'Ainda não há entradas, saídas ou saldo. Importe a planilha preenchida pelo cliente ou os recebimentos em Ciclo de receita.'));
    if (has) draw('ch_flow_fluxo', cfgFlow());
  };
  function flowOk() { return windowMonths().some(m => isNum(B(m).recebido) || isNum(B(m).custo_total)); }
  window.Fluxo = { modelo, pick, commit, cancel };
})();
