/* ELOGA Analytics — ajuda de colunas na importação (o que é cada coluna, exemplo do arquivo) e retorno de recurso / 2ª análise */
(function () {
  'use strict';
  const H = {
    fat: { date: 'Dia em que o paciente foi atendido. Define a competência do lote. Obrigatório.', pid: 'Código do paciente no sistema. Cruza com a agenda (vira código irreversível).', name: 'Só para cruzar guia × agenda. Não é gravado.', guia: 'Número da guia TISS enviada. Une o faturamento ao demonstrativo e ao recurso.', guiaOp: 'Número da guia na operadora; cruza com as autorizações.', valor: 'Valor total apresentado na guia. Base do faturamento. Obrigatório.', qty: 'Sessões na guia, para conferir faturado × realizado.', proc: 'Procedimento cobrado.', exec: 'Profissional executante.', lote: 'Número do lote enviado; agrupa as guias e é a ligação com o pagamento.' },
    dem: { date: 'Data de realização do procedimento. Define o mês do atendimento. Obrigatório.', name: 'Só para cruzar com a agenda. Não é gravado.', guia: 'Número da guia. Une o demonstrativo ao faturamento enviado e ao recurso.', code: 'Código TUSS do procedimento; usado para conferir o preço da tabela.', desc: 'Nome do procedimento.', qty: 'Quantidade executada/paga.', inf: 'Valor que a clínica cobrou (apresentado). Obrigatório.', lib: 'Valor que a operadora aprovou/pagou.', gl: 'Valor que a operadora recusou. Base de todo o painel de glosas. Obrigatório.', gcode: 'Código do motivo da glosa; agrupa o Pareto.', gdesc: 'Texto do motivo da glosa.', protocolo: 'Protocolo do lote na operadora.', lote: 'Lote a que a guia pertence.', envio: 'Data em que o lote foi enviado; base do prazo de pagamento e do aging.' },
    receb: { payer: 'Operadora que pagou.', ref: 'Lote ou protocolo pago; liga o pagamento ao lote.', data: 'Data em que o dinheiro entrou.', valor: 'Valor pago.', comp: 'Competência paga (alternativa ao lote).' },
    part: { date: 'Data do atendimento ao particular.', pid: 'Código do paciente.', proc: 'Procedimento ou pacote.', valor: 'Valor cobrado.', venc: 'Vencimento da cobrança; define inadimplência.', pago: 'Data em que o paciente pagou.', vpago: 'Valor efetivamente pago.', forma: 'Forma de pagamento (para calcular taxas de cartão).' },
    tabela: { payer: 'Convênio a que o preço se refere. Em clínica de estética pode ficar em branco: vira Particular.', code: 'Código do procedimento.', desc: 'Nome do procedimento. Obrigatório.', det: 'Descrição detalhada. Opcional.', dur: 'Tempo médio do procedimento em minutos (aceita 45, 45 min ou 01:00). Usado nas horas produzidas.', pkgf: 'Sim quando o item é vendido em pacote de várias sessões.', pkgn: 'Número de sessões do pacote. Maior que 1 já marca o item como pacote.', group: 'Grupo ou especialidade.', value: 'Valor pago pela operadora por unidade. Base da receita estimada da agenda.' },
    recurso: {
      guia: 'Número da guia recorrida. É a chave que liga o retorno à glosa do demonstrativo. Obrigatório.', date: 'Data do atendimento; ajuda a achar a glosa certa quando a guia tem vários itens.', code: 'Código do procedimento; desempata quando a guia tem vários itens glosados.',
      vgl: 'Valor que havia sido glosado na 1ª análise (confere com o demonstrativo).', rr: 'Valor que a clínica contestou no recurso. Sem esta coluna, considera-se o valor glosado inteiro.', rc: 'Valor que a operadora devolveu/aceitou na 2ª análise. Define quanto da glosa foi recuperado.',
      status: 'Parecer da operadora (deferido, parcial, indeferido, em análise). Definem a perda final da glosa.', rd: 'Data em que o recurso foi enviado.', protocolo: 'Protocolo do recurso.', rdr: 'Data em que a operadora respondeu o recurso (2ª análise).', mot: 'Justificativa do parecer; alimenta a análise de por que os recursos são negados.' }
  };
  const _sm = window.smartMapping;
  window.smartMapping = function () {
    _sm(); try { enhance(); } catch (e) { console.error(e); }
  };
  function enhance() {
    if (!SIMP || !H[SIMP.kind]) return; const help = H[SIMP.kind]; const box = workBox();
    box.querySelectorAll('.mapgrid .map').forEach(m => {
      const label = (m.querySelector('b') || {}).textContent || ''; const f = KINDS[SIMP.kind].fields.find(x => label.replace('*', '').trim() === x.l);
      if (!f || m.querySelector('.mh')) return; const sel = m.querySelector('select');
      const div = document.createElement('div'); div.className = 'mh'; div.style.cssText = 'font-size:12px;color:#5f6f77;margin-top:4px';
      const ex = () => { const col = sel.value; const v = col ? (SIMP.rows.find(r => String(r[col] ?? '').trim()) || {})[col] : ''; return v ? ` <i>Exemplo do arquivo: ${esc(String(v).slice(0, 40))}</i>` : ''; };
      const draw = () => { div.innerHTML = esc(help[f.k] || '') + ex(); }; draw(); sel.addEventListener('change', draw); m.appendChild(div);
    });
  }

  /* ---- retorno de recurso / 2ª análise: tipo de arquivo e de-para dos pareceres ---- */
  const OUT = ['Deferido total', 'Deferido parcial', 'Indeferido', 'Recurso enviado'];
  const OUTL = { 'Deferido total': 'Deferido total (operadora devolveu tudo)', 'Deferido parcial': 'Deferido parcial (devolveu parte)', 'Indeferido': 'Indeferido (manteve a glosa: perda)', 'Recurso enviado': 'Em análise / sem resposta' };
  const _rf = window.recForm;
  window.recForm = function () {
    if (RECIMP && !RECIMP.tipo) { const hasRet = ['rc', 'status', 'rdr'].some(k => SIMP.map[k]); RECIMP.tipo = hasRet ? 'retorno' : 'enviado'; }
    if (RECIMP && !RECIMP.stmap) { RECIMP.stmap = {}; }
    _rf();
    try {
      const box = workBox(); const card = box.querySelector('.card.work'); if (!card || !RECIMP) return;
      const texts = SIMP.map.status ? [...new Set(SIMP.rows.map(r => String(G(r, 'status')).trim()).filter(Boolean))].slice(0, 30) : [];
      const cur = t => { const k = norm(t); return RECIMP.stmap[k] || recStatusBase(t); };
      const html = `<div class="notice"><div class="grid g2"><div class="field c6"><label>O que este arquivo é?</label><select onchange="RECIMP.tipo=this.value;recForm()"><option value="enviado" ${RECIMP.tipo === 'enviado' ? 'selected' : ''}>Recurso enviado à operadora (ainda sem resposta)</option><option value="retorno" ${RECIMP.tipo === 'retorno' ? 'selected' : ''}>Retorno do recurso / 2ª análise (com parecer e valores)</option></select><small>“Enviado” marca as guias como <b>Recurso enviado</b>. “Retorno” grava valor recuperado e parecer e fecha a perda final.</small></div></div>
        ${RECIMP.tipo === 'retorno' && texts.length ? `<p class="muted"><b>De-para dos pareceres:</b> como cada texto da coluna de parecer deve ser entendido.</p><div class="tscroll"><table class="tbl sm"><thead><tr><th>Texto no arquivo</th><th>Linhas</th><th>Significa</th></tr></thead><tbody>${texts.map(t => `<tr><td>${esc(t)}</td><td class="num">${SIMP.rows.filter(r => String(G(r, 'status')).trim() === t).length}</td><td><select onchange='RECIMP.stmap[${JSON.stringify(norm(t)).replace(/'/g, '&#39;')}]=this.value;recForm()'>${OUT.map(o => `<option value="${o}" ${cur(t) === o ? 'selected' : ''}>${OUTL[o]}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
      const k = card.querySelector('.kpis'); (k || card.querySelector('.grid')).insertAdjacentHTML(k ? 'beforebegin' : 'afterend', html);
    } catch (e) { console.error(e); }
  };
  // status "base" sem de-para (para sugerir o padrão no seletor)
  function recStatusBase(t) { const s = RECIMP; const keep = s.stmap; s.stmap = {}; const tp = s.tipo; s.tipo = 'retorno'; const v = recStatus(t, null, null); s.stmap = keep; s.tipo = tp; return v; }

  /* ---- guia + modelo na aba de glosas ---- */
  const COLS = [['Número da guia', 'Obrigatória', 'Guia recorrida. Liga o retorno à glosa do demonstrativo.'], ['Código do procedimento', 'Recomendada', 'Desempata guias com vários itens.'], ['Valor glosado', 'Recomendada', 'Valor recusado na 1ª análise.'], ['Valor recorrido', 'Opcional', 'Quanto a clínica contestou. Vazio = glosa inteira.'], ['Valor recuperado', 'Retorno', 'Quanto a operadora devolveu na 2ª análise.'], ['Parecer', 'Retorno', 'Deferido, parcial, indeferido ou em análise.'], ['Data do recurso', 'Opcional', 'Quando foi enviado.'], ['Data da resposta', 'Retorno', 'Quando a operadora respondeu.'], ['Protocolo', 'Opcional', 'Protocolo do recurso.'], ['Motivo do parecer', 'Opcional', 'Justificativa da operadora.']];
  function modelo() {
    if (!window.XLSX) return toast('Gerador de planilha indisponível.', 'bad');
    const wb = XLSX.utils.book_new();
    const ins = [['ELOGA | Modelo de recurso de glosa e retorno da 2ª análise'], [''], ['Uma linha por item glosado. Não inclua nome de paciente.'], [''], ['Coluna', 'Quando preencher', 'O que informar'], ...COLS.map(c => [c[0], c[1], c[2]])];
    const w1 = XLSX.utils.aoa_to_sheet(ins); w1['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 70 }]; XLSX.utils.book_append_sheet(wb, w1, 'Instruções');
    const w2 = XLSX.utils.aoa_to_sheet([COLS.map(c => c[0]), ['0001234567', '50000470', 150, 150, 150, 'Deferido', '2026-09-10', '2026-09-25', 'PRT-998', ''], ['0001234890', '50000470', 150, 150, 0, 'Indeferido', '2026-09-10', '2026-09-25', 'PRT-998', 'Falta de assinatura']]); w2['!cols'] = COLS.map(() => ({ wch: 20 })); XLSX.utils.book_append_sheet(wb, w2, 'Recurso');
    XLSX.writeFile(wb, 'ELOGA_Modelo_Recurso_Glosa.xlsx');
  }
  const _fg = window.fatGlosas;
  if (typeof _fg === 'function') window.fatGlosas = function () {
    const h = _fg.apply(this, arguments); if (!S.dem.length) return h;
    return `<div class="card"><details><summary><b>Que colunas o arquivo de retorno do recurso / 2ª análise deve ter?</b></summary><div class="tscroll"><table class="tbl sm"><thead><tr><th>Coluna</th><th>Quando</th><th>O que é</th></tr></thead><tbody>${COLS.map(c => `<tr><td><b>${c[0]}</b></td><td>${c[1]}</td><td>${c[2]}</td></tr>`).join('')}</tbody></table></div><p class="muted">Sua planilha não precisa ter esses nomes: ao importar, você indica a coluna de cada informação e o sistema memoriza o perfil. <a href="#" onclick="ImpHelp.modelo();return false">Baixar modelo (.xlsx)</a></p></details></div>` + h;
  };
  window.ImpHelp = { modelo };
})();
