/* ELOGA Analytics — Visão executiva mais completa (nota por bloco, como o ISF é calculado) e guia da simulação de cenários */
(function () {
  'use strict';
  function blockCard() {
    const h = health(), R = indicators(); const [hl] = healthLabel(h.total);
    const rows = Object.entries(BLOCKS).map(([bk, bl]) => {
      const list = IND.filter(i => i.b === bk).map(i => ({ i, r: R[i.id], sc: scoreOf(R[i.id]) }));
      const ev = list.filter(x => isNum(x.sc)); const g = h.groups[bk]; const worst = ev.slice().sort((a, b) => a.sc - b.sc)[0];
      const [lb, cl] = healthLabel(g.score);
      return `<tr><td><b>${esc(bl.n)}</b></td><td class="num">${bl.w}%</td><td class="num"><span class="chip ${cl === 'good' ? 'ok' : cl === 'warn' ? '' : 'no'}">${isNum(g.score) ? Math.round(g.score) : '—'}</span></td><td class="num">${ev.length} de ${list.length}</td><td>${worst && worst.sc < 100 ? esc(worst.i.n) + ' (' + worst.sc + ')' : (ev.length ? 'Todos dentro da referência' : '<span class="muted">sem dados</span>')}</td>
        <td><details><summary>ver indicadores</summary>${list.map(x => `<div style="font-size:12px">${esc(x.i.n)}: <b>${isNum(x.sc) ? x.sc : 'não pontua'}</b>${isNum(x.r.cur) ? ' · atual ' + fmtBy(x.i.fmt, x.r.cur) : ' · sem dados'}${x.r.ref ? ' · ref. ' + esc(x.r.ref.t) : ''}</div>`).join('')}</details></td></tr>`; }).join('');
    return `<div class="card"><div class="chead"><h3>Como a nota (ISF) é calculada, bloco a bloco</h3></div>
      <div class="tscroll"><table class="tbl sm"><thead><tr><th>Bloco</th><th>Peso</th><th>Nota</th><th>Indicadores avaliados</th><th>Mais baixo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="howto"><b>Como ler:</b> cada indicador recebe <b>100</b> pontos se atinge a meta (ou, sem meta, a referência de mercado); se não atinge, recebe <b>70</b> (chega a 80% da meta), <b>45</b> (60% a 80%) ou <b>20</b> (abaixo de 60%). A nota do bloco é a média dos indicadores que têm dado. O ISF é a média dos blocos <b>ponderada pelo peso</b>, usando só os blocos com dados (por isso mostramos a cobertura: ${fmtPct(h.coverage, 0)}). Faixas: 80 ou mais = Saudável · 60 a 79 = Atenção · 40 a 59 = Risco · abaixo de 40 = Crítico. Hoje: <b>${isNum(h.total) ? Math.round(h.total) : '—'}</b> (${esc(hl)}). Indicadores sem meta nem referência, ou neutros, não pontuam.</div></div>`;
  }
  const _re = window.renderExec;
  window.renderExec = function () {
    const r = _re.apply(this, arguments);
    try { const c = document.getElementById('ch_hea'); const card = c && c.closest('.grid'); if (card) card.insertAdjacentHTML('afterend', blockCard()); } catch (e) { console.error(e); }
    return r;
  };
  RENDER.exec = window.renderExec;

  /* ---- guia da simulação ---- */
  const _sr = window.scenRefresh;
  window.scenRefresh = function () {
    _sr.apply(this, arguments);
    try {
      const box = document.getElementById('scenBox'); if (!box) return; const R = indicators(); const sc = scenarios(); const s = S.scen; const x = sc.base;
      const pc = (v, d) => isNum(v) ? fmtPct(v) : '—';
      const row = (name, atual, delta, novo, how, ganho) => `<tr><td><b>${name}</b></td><td class="num">${atual}</td><td class="num">${delta}</td><td class="num">${novo}</td><td class="num pos">${isNum(ganho) ? '+' + fmtMoney(ganho) : '<span class="muted">sem dados</span>'}</td><td style="font-size:12px">${how}</td></tr>`;
      const it = Object.fromEntries(sc.items.map(i => [i.k, i.gain]));
      const sub = (cur, d) => isNum(cur) ? fmtPct(Math.max(0, cur - d / 100)) : '—';
      box.insertAdjacentHTML('beforeend', `<details class="howto" open><summary><b>Como preencher este quadro</b></summary>
        <p><b>O que são “p.p.”:</b> pontos percentuais, a diferença entre dois percentuais. Se as faltas estão em 15% e você quer 12%, a redução é de <b>3 p.p.</b> (e não 3%). “%” nos preços e custos é variação sobre o valor.</p>
        <p><b>Base:</b> média dos últimos ${x.months || 0} meses com receita informada. Cada alavanca é calculada <b>sozinha</b>; o total soma todas. Use valores que a equipe consegue entregar em 3 a 6 meses.</p>
        <div class="tscroll"><table class="tbl sm"><thead><tr><th>Alavanca</th><th>Hoje</th><th>Mudança</th><th>Fica em</th><th>Ganho/mês</th><th>Como o ganho é calculado</th></tr></thead><tbody>
        ${row('Glosa final', pc(R.gf_p.cur), '− ' + s.glosa + ' p.p.', sub(R.gf_p.cur, s.glosa), 'p.p. × valor apresentado aos convênios', it.glosa)}
        ${row('Faltas', pc(R.falt_p.cur), '− ' + s.faltas + ' p.p.', sub(R.falt_p.cur, s.faltas), 'p.p. × agendados × ticket × margem de contribuição (o atendimento extra tem custo variável)', it.faltas)}
        ${row('Não cobrados', pc(R.miss_p.cur), '− ' + s.missing + ' p.p.', sub(R.miss_p.cur, s.missing), 'p.p. × elegíveis × ticket (receita pura: o atendimento já foi feito)', it.missing)}
        ${row('Ocupação', pc(R.ocup_p.cur), '+ ' + s.ocup + ' p.p.', isNum(R.ocup_p.cur) ? fmtPct(R.ocup_p.cur + s.ocup / 100) : '—', 'p.p. × capacidade × ticket × margem de contribuição', it.ocup)}
        ${row('Preço / tabela', '—', '+ ' + s.preco + '%', '—', '% × receita líquida (não considera perda de pacientes por reajuste)', it.preco)}
        ${row('Custos fixos', isNum(x.cf) ? fmtMoney(x.cf) : '—', '− ' + s.fixos + '%', isNum(x.cf) ? fmtMoney(x.cf * (1 - s.fixos / 100)) : '—', '% × custos fixos mensais', it.fixos)}
        </tbody></table></div>
        <p class="muted">Alavancas “sem dados” precisam de: glosa (demonstrativo importado), faltas e ocupação (agenda e grade), não cobrados (agenda + faturamento enviado), preço (receita líquida), custos fixos (Preenchimento → Mensal). Se a receita cobre só parte da operação, os ganhos ficam subestimados.</p></details>`);
    } catch (e) { console.error(e); }
  };
})();
