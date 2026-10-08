/* ELOGA Analytics — Ciclo de receita mais claro: passo a passo + fluxo de caixa (entradas, saídas e saldo) */
(function () {
  'use strict';
  function flowData() {
    const ms = windowMonths(); const ent = ms.map(m => { const v = B(m).recebido; return isNum(v) ? v : null; });
    const sai = ms.map(m => { const v = B(m).custo_total; return isNum(v) ? v : null; });
    const res = ms.map((m, i) => isNum(ent[i]) && isNum(sai[i]) ? ent[i] - sai[i] : null);
    const cx = ms.map(m => { const v = B(m).caixa; return isNum(v) ? v : null; });
    const real = cx.some(isNum); let saldo = cx, acc = 0, estimado = false;
    if (!real) { estimado = true; saldo = res.map(v => isNum(v) ? (acc += v) : (res.some(isNum) ? acc : null)); }
    return { ms, ent, sai, res, saldo, estimado, ok: ent.some(isNum) || sai.some(isNum) };
  }
  window.cfgFlow = function () {
    const d = flowData(); if (!d.ok) return null;
    return { type: 'bar', data: { labels: d.ms.map(monthLabel), datasets: [
      { label: 'Entradas (recebido)', data: d.ent, backgroundColor: PAL.good, order: 3 },
      { label: 'Saídas (custos do mês)', data: d.sai.map(v => isNum(v) ? -v : null), backgroundColor: PAL.bad, order: 3 },
      { label: d.estimado ? 'Saldo acumulado (estimado)' : 'Saldo de caixa', data: d.saldo, type: 'line', borderColor: PAL.petro, backgroundColor: PAL.petro, tension: .25, order: 1, pointRadius: 3 }] },
      options: { plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtMoney(Math.abs(c.raw))}` } } }, scales: { y: { ticks: { callback: moneyTick } } } } };
  };
  function steps() {
    const f = funnelData(); if (!f || f.st.length < 2) return '';
    return `<div class="card"><div class="chead"><h3>Passo a passo do ciclo — ${monthLabel(f.ym)}</h3></div><div class="row" style="gap:6px;flex-wrap:wrap;align-items:stretch">${f.st.map((s, i) => `${i ? '<div style="align-self:center;font-size:20px;color:#8a9ba2">→</div>' : ''}<div style="flex:1;min-width:130px;border:1px solid #dce4e7;border-radius:10px;padding:8px 10px;background:#fff"><div class="muted" style="font-size:12px">${i + 1}. ${esc(s.l)}</div><div style="font-size:18px;font-weight:700">${fmtMoney(s.v)}</div>${isNum(s.lossV) && s.lossV > 0.5 ? `<div style="color:#e5484d;font-size:12px">− ${fmtMoney(s.lossV)} · ${esc(s.loss)}</div>` : '<div style="font-size:12px">&nbsp;</div>'}</div>`).join('')}</div>
      <div class="howto"><b>Como ler:</b> cada caixa é uma etapa do dinheiro, da agenda ao caixa. O valor vermelho é o que ficou pelo caminho e a causa provável. Comece corrigindo a etapa com maior perda. Valores estimados pelo ticket médio do mês.</div></div>`;
  }
  const flowCard = id => `<div class="card"><div class="chead"><h3>Fluxo de caixa: entradas, saídas e saldo</h3></div><div class="cwrap"><canvas id="${id}"></canvas></div><div class="howto"><b>Como ler:</b> barras verdes = dinheiro recebido no mês; barras vermelhas = custos do mês (variáveis, fixos e financeiros), para baixo; linha = saldo de caixa informado (ou acumulado estimado das entradas menos saídas, quando o saldo não foi informado). Barras verdes menores que as vermelhas por meses seguidos queimam caixa.</div></div>`;
  function wrap(name, page, withSteps) {
    const o = window[name]; if (typeof o !== 'function') return;
    window[name] = function () { const r = o.apply(this, arguments);
      try { const pg = document.getElementById('pg_' + page); const k = pg.querySelector('.kpis'); const has = flowData().ok;
        const html = (withSteps ? steps() : '') + (has ? flowCard('ch_flow_' + page) : '');
        if (html && k) k.insertAdjacentHTML('afterend', html);
        if (has) draw('ch_flow_' + page, cfgFlow());
      } catch (e) { console.error(e); } return r; };
    RENDER[page] = window[name];
  }
  wrap('renderCiclo', 'ciclo', true); wrap('renderCaixa', 'caixa', false);
})();
