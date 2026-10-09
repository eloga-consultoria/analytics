/* ELOGA Analytics — clínica de estética: a agenda classificada alimenta receita, rentabilidade, ciclo de receita, caixa e faturamento.
   Receita estimada = sessões cobráveis (status "realizado" e "falta cobrada") × tabela de procedimentos / pacotes. */
(function () {
  'use strict';
  const est = () => !!(S && S.meta && S.meta.segment === 'estetica');
  const info = { receita: 0, semPreco: 0, sess: 0 };

  // preço da sessão: pacote > tabela da fonte pagadora > mesmo procedimento em qualquer fonte (estética é sempre particular)
  function anyPrice(r) {
    const code = String(r.code || '').replace(/\D/g, ''), pr = norm(r.proc);
    const t = S.cad.table.find(x => isNum(toNum(x.value)) && ((code && String(x.code || '').replace(/\D/g, '') === code) || (pr && norm(x.desc) === pr)));
    return t ? toNum(t.value) : null;
  }
  function priceEst(r) { let p = pkgPrice(r); if (p === undefined) p = priceOf(r); if (!isNum(p)) p = anyPrice(r); return isNum(p) ? p : null; }

  const _am = window.agendaMonthly;
  window.agendaMonthly = function () {
    const out = _am.apply(this, arguments); info.receita = 0; info.semPreco = 0; info.sess = 0;
    if (!est() || !S.agenda.length) return out;
    const rec = {}, elg = {}, sem = {};
    for (const r of S.agenda) { const k = kindOf(r); if (k === 'ignorar' || k === 'agendado' || k === 'reagendado' || !billable(r)) continue; const ym = r.d.slice(0, 7);
      elg[ym] = (elg[ym] || 0) + 1; const p = priceEst(r); if (p === null) { sem[ym] = (sem[ym] || 0) + 1; info.semPreco++; } else { rec[ym] = (rec[ym] || 0) + p; info.receita += p; } info.sess++; }
    const noAto = S.cad.cfg.estRecebNoAto !== false;
    Object.keys(out).forEach(ym => { const o = out[ym];
      if (rec[ym] != null) { o.rb_part = rec[ym]; if (noAto) o.recebido = rec[ym]; }
      o.lancados = elg[ym] || 0; // na estética a sessão realizada na agenda já é o lançamento (não há guia)
      if (sem[ym]) o.sem_preco = sem[ym]; });
    return out;
  };

  // agenda importada antes sem convênio ("Não informado") passa a ser Particular na estética
  const _uc = window.upgradeClient;
  window.upgradeClient = function (c) { c = _uc.apply(this, arguments);
    try { if (c.meta && c.meta.segment === 'estetica') { (c.agenda || []).forEach(r => { if (!r.payer || r.payer === 'Não informado') r.payer = 'Particular'; });
      if ((c.agenda || []).length && c.cad && Array.isArray(c.cad.payers) && !c.cad.payers.some(p => /partic/i.test(p.name))) c.cad.payers.push({ name: 'Particular', type: 'Particular', ans: '', prazo: '' }); } } catch (e) { console.error(e); }
    return c; };

  function notice(page) {
    if (!est() || !S.agenda.length) return '';
    agendaMonthly(); const on = S.cad.cfg.estRecebNoAto !== false;
    const sem = info.semPreco ? `<br><b>${info.semPreco.toLocaleString('pt-BR')} de ${info.sess.toLocaleString('pt-BR')} sessões estão sem preço</b> e ficaram fora da receita. Cadastre o procedimento em <a href="#" onclick="CADTAB='tabela';show('cad');return false">Cadastros → Tabela de procedimentos</a> (o nome deve ser igual ao da agenda).` : '';
    return `<div class="notice ${info.semPreco ? 'warn' : 'good'}" id="estFinNote"><b>Clínica de estética: valores calculados pela agenda.</b> Receita = sessões cobráveis (realizadas e faltas cobradas, conforme os status que você classificou) × tabela de procedimentos e pacotes. Total no período importado: <b>${fmtMoney(info.receita)}</b>.${sem}
      <div style="margin-top:4px">Custos e despesas: <a href="modelos/Modelo_Custos_ELOGA_Estetica.xlsx" download>baixar o modelo de planilha de custos</a> e importe em Importar planilhas → Planilha mensal.</div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" ${on ? 'checked' : ''} onchange="EstFin.noAto(this.checked)"> <span>Considerar <b>recebido = faturado no mês</b> (pagamento no ato). Desmarque se o recebimento é parcelado; nesse caso importe o <b>Controle do particular</b> em Caixa e recebimento.</span></label></div>`;
  }
  function inject(page) { try { const h = notice(page); if (!h) return; const pg = document.getElementById('pg_' + page); if (!pg) return; const old = pg.querySelector('#estFinNote'); if (old) old.remove();
    const ph = pg.querySelector('.phead'); (ph || pg.firstElementChild || pg).insertAdjacentHTML(ph ? 'afterend' : 'afterbegin', h); } catch (e) { console.error(e); } }
  ['renderRent', 'renderCiclo', 'renderCaixa', 'renderFat'].forEach(n => { const f = window[n]; if (typeof f !== 'function') return; const pg = { renderRent: 'rent', renderCiclo: 'ciclo', renderCaixa: 'caixa', renderFat: 'fat' }[n];
    window[n] = function () { const r = f.apply(this, arguments); inject(pg); return r; };
    const key = { renderRent: 'rent', renderCiclo: 'ciclo', renderCaixa: 'caixa', renderFat: 'fat' }[n]; RENDER[key] = window[n]; });

  window.EstFin = { noAto(v) { S.cad.cfg.estRecebNoAto = !!v; resetAll(); show(PAGE); }, info, priceEst };
})();
