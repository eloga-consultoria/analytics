/* ELOGA Analytics — botões ⓘ: o que é, como é calculado, dados considerados, como melhorar.
   Também mostra, em cada aba, o que falta para os indicadores indisponíveis. */
(function () {
  'use strict';
  const R = (calc, fix, src) => ({ calc, fix, src });
  /* ---- Indicadores do catálogo (IND) ---- */
  const INFO = {
    rb: R('Soma da receita bruta do mês (convênios + particular + outras). Se só as fontes forem informadas, o total é a soma delas.', 'Revise preços de tabela e reajustes contratuais; aumente a ocupação da grade; reduza horários ociosos; capte demanda da lista de espera.'),
    rl: R('Receita bruta − descontos − impostos − glosa final.', 'Reduza glosas (envio correto), negocie descontos com critério e confira o regime tributário com a contabilidade.'),
    mc_v: R('Receita líquida − custos variáveis (repasse dos terapeutas, insumos, taxas de cartão).', 'Revise regras de repasse, taxas de cartão e insumos; priorize convênios e procedimentos de maior margem.'),
    mc_p: R('Margem de contribuição (R$) ÷ receita líquida.', 'Mesmas ações da margem em R$: repasse, taxas e insumos. Se o repasse é o maior custo, revise valores fixos × variáveis por profissional.'),
    ebitda_v: R('Margem de contribuição − custos fixos (pessoal administrativo, ocupação, outros).', 'Aumente receita sobre a estrutura fixa (ocupação) ou renegocie custos fixos (aluguel, contratos).'),
    ebitda_p: R('Resultado operacional ÷ receita líquida.', 'Subir ocupação dilui custo fixo; corte desperdícios fixos antes de cortar assistência.'),
    ml_p: R('(Resultado operacional − despesas financeiras) ÷ receita líquida.', 'Renegocie dívidas e tarifas bancárias; evite antecipação cara de recebíveis.'),
    pe: R('Custos fixos ÷ margem de contribuição % (receita líquida mínima para não ter prejuízo).', 'Reduza custo fixo ou eleve a margem de contribuição; quanto menor o ponto de equilíbrio, mais folga a clínica tem.'),
    ms_p: R('(Receita líquida − ponto de equilíbrio) ÷ receita líquida.', 'Aumente a receita acima do ponto de equilíbrio (ocupação, ticket) ou baixe o custo fixo.'),
    pes_p: R('(Repasse dos profissionais + pessoal administrativo) ÷ receita líquida.', 'Ajuste a produtividade por profissional (ocupação), revise repasses fixos e dimensione a equipe administrativa à demanda.'),
    ticket: R('Receita bruta ÷ atendimentos lançados (ou realizados, quando não há lançamento).', 'Revise a tabela dos convênios, reduza procedimentos sem preço e descontos; avalie pacotes para particulares.'),
    custo_at: R('(Custos variáveis + fixos + despesas financeiras) ÷ atendimentos realizados.', 'Aumente atendimentos sobre a mesma estrutura (ocupação) e reduza custo fixo; compare com o ticket.'),
    mc_h: R('Margem de contribuição ÷ horas de atendimento. Horas = realizados × duração da sessão.', 'Priorize horários e profissionais com maior margem por hora; reduza ociosidade.'),
    comp_p: R('Atendimentos realizados ÷ agendados (sem reagendados e futuros).', 'Confirmação ativa 24–48 h antes, lembrete por WhatsApp, reocupação rápida da vaga, conversa de adesão com a família, ajuste de horário.'),
    falt_p: R('Faltas do paciente (com e sem cobrança) ÷ agendados.', 'Política de faltas comunicada no acolhimento, confirmação ativa, horários que a família consegue manter, reocupação por lista de espera.'),
    canc_p: R('Cancelamentos por falta de profissional/sala ÷ agendados.', 'Cobertura de férias e atestados, escala de reposição, manutenção de salas; acompanhe por profissional.'),
    ocup_p: R('Atendimentos realizados ÷ capacidade (grade dos profissionais, salas e equipe).', 'Preencha horários ociosos com a lista de espera, ajuste a grade ao horário de procura das famílias, reduza faltas.'),
    lag: R('Média de dias entre a data do atendimento e o lançamento/envio para cobrança.', 'Baixa e evolução no mesmo dia, fechamento semanal de lançamentos, checagem de guias antes do envio.'),
    miss_p: R('(Elegíveis − lançados) ÷ elegíveis. Elegível = realizado + falta cobrada.', 'Rotina diária de conferência agenda × lançamento; liste sessões sem baixa e sem guia; trate causas por profissional.'),
    miss_v: R('Sessões elegíveis não lançadas × ticket médio do mês.', 'Mesma ação do indicador anterior; priorize recuperar o que ainda está dentro do prazo de cobrança da operadora.'),
    env_p: R('Sessões enviadas ao faturamento ÷ sessões elegíveis (realizadas + faltas cobradas).', 'Confira guias vencidas, assinatura e autorização antes do fechamento; trate rapidamente o que ficou fora do lote.'),
    gi_p: R('Valor glosado no 1º retorno ÷ valor apresentado às operadoras.', 'Padronize guias, confira autorização, assinatura e códigos; treine a equipe nos motivos mais frequentes (veja Glosas).'),
    gf_p: R('Glosa final (perda definitiva) ÷ valor apresentado. Glosa sem desfecho fica em aberto.', 'Recorra todas as glosas dentro do prazo; acompanhe o desfecho de cada recurso.'),
    gf_v: R('Valor da glosa que não foi recuperado após o recurso ou que não foi recorrida.', 'Mesma ação da glosa final; foque nos maiores valores e nos motivos que se repetem.'),
    recu_p: R('Valor recorrido ÷ valor glosado.', 'Crie rotina de recurso com prazo; use o retorno da 2ª análise para fechar o desfecho.'),
    rev_p: R('Valor recuperado ÷ valor recorrido.', 'Melhore a qualidade do recurso: documentação completa, argumentação por motivo, acompanhamento do protocolo.'),
    subpag: R('Para itens sem glosa: valor da tabela contratada × quantidade − valor pago.', 'Confira tabela cadastrada × contrato; abra reclamação com a operadora quando o valor pago divergir.'),
    conv_p: R('Recebido no mês ÷ receita líquida do mês. Abaixo de 100% por meses seguidos indica receita presa.', 'Acompanhe lotes enviados e vencidos, cobre operadoras no prazo, reduza glosa e registre todos os recebimentos (Faturamento).'),
    pmr: R('Média ponderada dos dias entre o envio do lote e cada pagamento recebido.', 'Envie lotes mais cedo e sem erros, negocie prazo com operadoras, acompanhe lotes vencidos.'),
    ar90_p: R('Saldo vencido há mais de 90 dias ÷ saldo vencido total.', 'Priorize cobrança dos lotes mais antigos, escale ao gerente de conta da operadora e recorra o que for glosa.'),
    ar_v: R('Soma dos lotes enviados cujo prazo de pagamento venceu e que ainda têm saldo a receber (valor esperado − pagamentos).', 'Cobrança semanal dos lotes vencidos; confirme se os pagamentos já recebidos foram lançados em Faturamento.'),
    inad_p: R('Valores vencidos e não pagos de particulares ÷ receita particular do mês.', 'Cobrança no vencimento, forma de pagamento recorrente (cartão/PIX), contrato com condições claras.'),
    cob_p: R('Custo de faturar, recorrer e cobrar ÷ recebido no mês.', 'Automatize conferências, reduza retrabalho de glosa e terceirização cara.'),
    mix_c: R('Receita de convênios ÷ receita bruta.', 'Indicador de dependência: acima de 70% exige gestão forte de glosa e prazo; avalie crescer o particular.'),
    dcx: R('Saldo de caixa ÷ (custo total do mês ÷ 30).', 'Reserva de caixa mensal, antecipe cobrança de vencidos, escalone pagamentos, reduza custo fixo.'),
    gcx: R('Saldo de caixa do mês − saldo do mês anterior.', 'Acompanhe recebimentos × saídas; ajuste datas de pagamento e cobrança.'),
    div_p: R('Parcelas de empréstimos e financiamentos ÷ receita líquida.', 'Renegociar prazo e taxa; evitar novas dívidas para capital de giro sem plano de recebimento.')
  };
  /* ---- KPIs do painel de agenda (pela sigla) ---- */
  const AG = {
    'Agend.': R('Agendamentos com data já ocorrida, sem reagendados e ignorados.', 'Aumente a captação e a ocupação das vagas ociosas.'),
    'Realiz.': R('Agendamentos cujo status foi classificado como Realizado (Cadastros → Status da agenda).', 'Reduza faltas e cancelamentos; reocupe vagas.'),
    'Compar.': R('Realizados ÷ agendamentos do período.', 'Confirmação ativa, lembretes, reocupação e conversa de adesão.'),
    'Abs.': R('Faltas (com e sem cobrança) ÷ (realizados + faltas).', 'Política de faltas, confirmação ativa, rever horários que a família não consegue manter.'),
    'S/ baixa': R('Agendamentos passados sem registro do que aconteceu.', 'Fechamento diário da agenda por profissional; cobrar baixa até o dia seguinte.'),
    'Canc.': R('Cancelados pelo paciente, pela clínica e ausências do profissional ÷ agendamentos.', 'Separe causas (clínica × paciente) e trate cada uma; cobertura de ausências.'),
    'Ocup.': R('Realizados ÷ capacidade da grade dos profissionais (horas da grade ÷ duração da sessão, vezes atendimentos simultâneos).', 'Preencher horários ociosos, ajustar grade à demanda e reduzir faltas. Acima de 100% indica grade cadastrada incompleta.'),
    'Salas': R('Realizados ÷ (horário de funcionamento × número de salas).', 'Reveja horários de pico e ociosos; use salas em turnos fracos.'),
    'Ativos': R('Pacientes com ao menos 1 atendimento realizado no último mês do período.', 'Retenção: acompanhe quem reduziu frequência e a lista de evadidos.'),
    'Novos': R('Pacientes cuja primeira aparição na agenda é no mês (exceto o primeiro mês do arquivo).', 'Fortaleça o funil comercial e a conversão da lista de espera.'),
    'Evad.': R('Tinham agendamento no mês anterior e nenhum no mês (até a data de corte).', 'Contato ativo nos primeiros 15 dias sem agendamento, pesquisa de motivo e plano de retorno.'),
    'Rec. est.': R('Realizados + faltas cobradas × valor da tabela do convênio (Cadastros → Tabela). Não é o faturado.', 'Cadastre os preços que faltam; compare com o faturado para achar perdas.'),
    'Ticket': R('Receita estimada ÷ atendimentos cobráveis com preço.', 'Revise tabela e mix de procedimentos.'),
    'Rec/pac': R('Receita estimada ÷ pacientes atendidos no período.', 'Aumente frequência por paciente e reduza faltas.')
  };
  /* ---- Quadros e gráficos (pelo título) ---- */
  const CARD = [
    [/resultado dos agendamentos/i, R('Contagem de agendamentos por status classificado, mês a mês. Clique nos números para ver a lista.', 'Compare meses: aumento de faltas ou sem baixa mostra onde agir.')],
    [/ocupação e preenchimento/i, R('Ocupação = realizados ÷ capacidade; preenchimento = (passados + futuros) ÷ capacidade.', 'Preenchimento alto com ocupação baixa = muitas faltas/cancelamentos; preenchimento baixo = falta demanda.')],
    [/pacientes por mês/i, R('Ativos, novos, retornos e evadidos, mês a mês. Clique nos números para ver os pacientes.', 'Saldo negativo repetido pede ação de retenção.')],
    [/receita estimada por mês/i, R('Atendimentos cobráveis × preço da tabela, por mês, convênio, especialidade ou procedimento.', 'Preço faltante subestima a receita; cadastre a tabela.')],
    [/resultado por mês e/i, R('Total de agendamentos do grupo e divisão pelos status.', 'Procure grupos com mais faltas ou cancelamentos.')],
    [/ocupação por profissional/i, R('Realizados ÷ capacidade da grade de cada profissional.', 'Profissionais abaixo da média podem receber pacientes da lista de espera.')],
    [/mapa de uso/i, R('Agendamentos por dia da semana e hora.', 'Horários claros = oportunidade; escuros = disputa por vaga.')],
    [/quadro do período/i, R('Totais do período por profissional, especialidade, procedimento, convênio ou unidade.', 'Compare grupos com volume parecido.')],
    [/caixa e dias de caixa/i, R('Saldo de caixa informado por mês e dias de caixa (saldo ÷ custo diário).', 'Informe o saldo no fim de cada mês em Preenchimento → Mensal → Caixa.')],
    [/aging/i, R('Saldo vencido por faixa de atraso, calculado pelo prazo de pagamento da operadora (Cadastros) a partir da data de envio do lote, menos os pagamentos vinculados.', 'Cobrar primeiro as faixas mais antigas e conferir se há pagamentos ainda não lançados.')],
    [/agenda e realização/i, R('Agendados, realizados, faltas, capacidade e ocupação por mês.', 'Procure meses em que a ocupação cai: veja faltas e cancelamentos.')],
    [/por profissional/i, R('Agenda, faltas, receita e atrasos de lançamento por profissional.', 'Compare profissionais com volume parecido.')]
  ];

  const fmtV = (k, v) => !isNum(v) ? '—' : (FIELD[k] && FIELD[k].t === 'money' ? fmtMoney(v) : fmtNum(v, 1));
  const WHERE = {
    caixa: 'Preenchimento → Mensal → Liquidez (saldo de caixa no fim do mês)', recebido: 'Importe Recebimentos (Ciclo de receita) ou preencha em Preenchimento → Mensal',
    pmr: 'Importe os lotes com data de envio e vincule os pagamentos (Ciclo de receita → Recebimentos)', ar_0_30: 'Automático: importe faturamento/demonstrativo com data de envio e os recebimentos',
    ar_31_60: 'Automático (veja “A receber vencido 0–30 dias”)', ar_61_90: 'Automático (veja “A receber vencido 0–30 dias”)', ar_90: 'Automático (veja “A receber vencido 0–30 dias”)',
    inad_part: 'Importe o controle do particular (Caixa) ou preencha em Preenchimento → Mensal', rb_part: 'Importe o controle do particular ou preencha a receita particular',
    div_parcela: 'Preenchimento → Mensal → Liquidez (parcelas de empréstimos)', rb: 'Preenchimento → Mensal (receita bruta) ou importe faturamento/demonstrativo', cv: 'Preenchimento → Mensal → Custos variáveis (ou cadastre repasse)',
    rb_conv: 'Importe faturamento/demonstrativo ou preencha a receita de convênios', real: 'Importe a agenda', ag: 'Importe a agenda', capacidade: 'Cadastre a grade dos profissionais', horas: 'Importe a agenda', lag: 'Importe faturamento com data de envio',
    elegiveis: 'Importe a agenda e confirme os status', lancados: 'Importe o faturamento enviado', glosa_ini: 'Importe o demonstrativo de análise', fat_conv: 'Importe faturamento/demonstrativo', glosa_fin: 'Informe o desfecho dos recursos (Glosas)', recursado: 'Informe os recursos (Glosas)', recuperado: 'Informe os recursos (Glosas)', subpag: 'Importe o demonstrativo e cadastre a tabela de preços', custo_cob: 'Preenchimento → Mensal'
  };
  const LBL = { cv: 'Custos variáveis (total)', cf: 'Custos fixos (total)', rl: 'Receita líquida', rb: 'Receita bruta' };
  const lbl = k => LBL[k] || (FIELD[k] ? FIELD[k].l.replace('• ', '') : k);

  /* ---- data-ind nos KPIs ---- */
  const _kpi = window.kpi;
  window.kpi = function (id, opts) { const h = _kpi(id, opts); return h.replace('<div class="kpi ', `<div data-ind="${id}" class="kpi `); };

  /* ---- janela ---- */
  const css = document.createElement('style');
  css.textContent = '.ibtn{border:1px solid var(--line,#dce4e7);background:#fff;color:var(--roxo,#5211fb);width:20px;height:20px;border-radius:50%;font:700 12px/18px Georgia,serif;cursor:pointer;margin-left:6px;padding:0;vertical-align:middle}.ibtn:hover{background:var(--roxo,#5211fb);color:#fff}.infoBox h4{margin:14px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#5f6f77}.infoBox p{margin:0 0 4px;line-height:1.45}.infoBox .att{background:#fff6e0;border-left:4px solid #e0a100;padding:8px 10px;border-radius:6px}.missCard summary{cursor:pointer;font-weight:700}.missCard li{margin:4px 0}';
  document.head.appendChild(css);
  function win(title, html) {
    close(); const ov = document.createElement('div'); ov.className = 'drOv'; ov.id = 'infoOv'; ov.onclick = e => { if (e.target === ov) close(); };
    ov.innerHTML = `<div class="drBox"><header><h3>${esc(title)}</h3><button class="btn ghost sm" onclick="InfoBtn.close()">Fechar</button></header><div class="drBody infoBox">${html}</div></div>`; document.body.appendChild(ov);
  }
  function close() { const o = document.getElementById('infoOv'); if (o) o.remove(); }

  function showInd(id) {
    const r = indicators()[id]; if (!r) return; const i = r.ind; const inf = INFO[id] || {};
    const ym = r.curYm || lastM(windowMonths()); const x = B(ym);
    const keys = [...new Set([...(i.need || []), ...(i.anyOf || []), ...(i.opt || [])])];
    const rows = keys.map(k => { const has = x.has[k]; const s = srcOf(ym, k); const kind = (i.need || []).includes(k) ? 'obrigatório' : (i.anyOf || []).includes(k) ? 'um dos' : 'opcional';
      return `<tr><td>${esc(lbl(k))}</td><td>${kind}</td><td class="num">${has ? fmtV(k, x[k]) : '—'}</td><td>${has ? (s === 'm' ? 'Preenchido/importado' : s === 'd' ? 'Calculado das importações' : 'Calculado') : '<b>Falta</b>'}</td></tr>`; }).join('');
    const bad = r.trend === 'pior' || r.refOk === false || r.tgtOk === false;
    const state = isNum(r.cur) ? `${fmtBy(i.fmt, r.cur)} em ${monthLabel(r.curYm)}${isNum(r.baseline) ? ` · linha de base ${fmtBy(i.fmt, r.baseline)}` : ''}${r.ref ? ` · referência ${esc(r.ref.t)}` : ''}${isNum(r.tgt) ? ` · meta ${fmtBy(i.fmt, r.tgt)}` : ''}` : 'Indisponível: faltam dados (veja a tabela).';
    const faltam = !isNum(r.cur) ? (r.miss.length ? r.miss : (i.need || [])).map(k => `<li><b>${esc(lbl(k))}</b>: ${esc(WHERE[k] || 'Preenchimento → Mensal')}</li>`).join('') : '';
    let extra = '';
    if (id === 'conv_p') { const ms = windowMonths(); let a = 0, b = 0; ms.forEach(m => { const q = B(m); if (isNum(q.recebido) && isNum(q.rl)) { a += q.recebido; b += q.rl; } }); if (b) extra += `<p>Média do período (recebido total ÷ receita líquida total): <b>${fmtPct(a / b)}</b>. Um mês isolado oscila porque o dinheiro entra semanas depois da competência.</p>`;
      const nop = rcmData().batches.filter(b => !(b.pays || []).length).map(b => b.payer); const u = [...new Set(nop)]; if (u.length) extra += `<p class="att">Operadoras com lote importado e <b>nenhum pagamento vinculado</b>: ${esc(u.join(', '))}. Enquanto os recebimentos não forem informados, a conversão em caixa fica subestimada.</p>`; }
    if (id === 'rb' || id === 'rl') { const c = coverage(); if (c) extra += `<p class="${c.avg < .9 ? 'att' : ''}">Cobertura: a receita bruta de origem importada equivale a <b>${fmtPct(c.avg)}</b> da receita estimada pela agenda no período.</p>`; }
    win(`${i.n} (${i.sig})`, `<h4>O que é</h4><p>${esc(i.d)}</p>
      <h4>Como é calculado</h4><p>${esc(inf.calc || 'Veja a descrição acima.')}</p>
      <h4>Resultado atual</h4><p>${state}</p>${extra}
      <h4>Dados considerados (${monthLabel(ym)})</h4><div class="tscroll"><table class="tbl sm"><thead><tr><th>Dado</th><th>Tipo</th><th>Valor</th><th>Origem</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${faltam ? `<h4>O que falta para calcular</h4><ul>${faltam}</ul>` : ''}
      <h4>Como melhorar</h4><p class="${bad ? 'att' : ''}">${bad ? '<b>Atenção: este indicador piorou ou está fora da referência/meta.</b> ' : ''}${esc(inf.fix || 'Acompanhe a tendência mês a mês e identifique as causas por profissional, convênio ou unidade.')}</p>`);
  }
  function showText(title, text, extra) {
    const ent = extra || {}; const d = ent.calc || '';
    win(title, `<h4>O que é</h4><p>${esc(text || 'Indicador da tela.')}</p>${d ? `<h4>Como é calculado</h4><p>${esc(d)}</p>` : ''}${ent.fix ? `<h4>Como melhorar</h4><p>${esc(ent.fix)}</p>` : '<h4>Como melhorar</h4><p>Compare mês a mês e por grupo (profissional, convênio, unidade) para achar a causa antes de agir.</p>'}`);
  }

  /* ---- decorar a tela ---- */
  function decorate() {
    const pg = document.querySelector('.page.active'); if (!pg) return;
    pg.querySelectorAll('.kpi').forEach(k => {
      if (k.querySelector('.ibtn')) return; const kl = k.querySelector('.kl'); if (!kl) return; const id = k.dataset.ind;
      const b = document.createElement('button'); b.className = 'ibtn'; b.type = 'button'; b.title = 'O que é, como é calculado e como melhorar'; b.textContent = 'i';
      if (id) b.onclick = e => { e.stopPropagation(); showInd(id); };
      else { const sig = (kl.querySelector('.sig') || {}).textContent || ''; const name = kl.textContent.replace(sig, '').trim(); const d = (k.querySelector('.kd') || {}).textContent || ''; b.onclick = e => { e.stopPropagation(); showText(name, d, AG[sig]); }; }
      kl.appendChild(b);
    });
    pg.querySelectorAll('.card .chead h3').forEach(h => {
      if (h.querySelector('.ibtn')) return; const card = h.closest('.card'); const t = h.textContent;
      const b = document.createElement('button'); b.className = 'ibtn'; b.type = 'button'; b.title = 'Como ler e como melhorar'; b.textContent = 'i';
      b.onclick = e => { e.stopPropagation(); const ent = (CARD.find(c => c[0].test(t)) || [])[1]; const how = card.querySelector('.howto'); showText(t, how ? how.textContent.replace(/^Como ler:\s*/, '') : (ent && ent.calc) || '', ent); };
      h.appendChild(b);
    });
    missing(pg);
  }

  function coverage() {
    if (!S.agenda.length) return null; const A = agStats(); let a = 0, b = 0, n = 0;
    A.ms.forEach(m => { if (srcOf(m, 'rb') === 'm') return; const rb = B(m).rb, est = A.M[m].receita; if (isNum(rb) && est > 0) { a += rb; b += est; n++; } });
    return n && b ? { avg: a / b, n } : null;
  }
  /* ---- o que falta, por aba ---- */
  const PG_BLOCKS = { rent: ['rent'], prod: ['prod'], caixa: ['rec', 'liq'], ciclo: ['cap', 'env', 'glo', 'rec'] };
  function missing(pg) {
    const page = pg.id.replace('pg_', ''); if (pg.querySelector('.missCard')) return;
    if (page === 'importar') { if (S.agenda.length && S.detail.attend.length) pg.querySelector('.phead').insertAdjacentHTML('afterend', `<div class="card missCard">${notice('warn', `<b>Atendimentos do modelo antigo duplicam a agenda.</b> Há ${fmtNum(S.detail.attend.length)} linha(s) em Atendimentos e também a agenda classificada. Os cálculos de agenda já usam só a agenda; você pode apagar os atendimentos antigos para evitar confusão. <button class="btn ghost sm" onclick="clearDetail('attend')">Apagar atendimentos antigos</button>`)}</div>`); return; }
    const blocks = PG_BLOCKS[page]; if (!blocks) return; const I = indicators();
    const cov = coverage(); const covHtml = (cov && cov.avg < .9 && ['rent', 'caixa', 'ciclo'].includes(page)) ? `<div class="card missCard">${notice('warn', `<b>A receita considerada cobre só ${fmtPct(cov.avg)} da receita estimada pela agenda.</b> Ela vem apenas dos lotes de faturamento/demonstrativo importados. Margens, ponto de equilíbrio e conversão em caixa ficam distorcidos até você importar os demais convênios e o particular, ou preencher a receita do mês em Preenchimento → Mensal.`)}</div>` : '';
    const list = IND.filter(i => blocks.includes(i.b) && !isNum(I[i.id].cur));
    const after0 = pg.querySelector('.impbar') || pg.querySelector('details.period') || pg.querySelector('.phead');
    if (!list.length) { if (covHtml && after0) after0.insertAdjacentHTML('afterend', covHtml); return; }
    const items = list.map(i => { const miss = I[i.id].miss.length ? I[i.id].miss : (i.need || i.anyOf || []); return `<li><b>${esc(i.n)}</b> — falta: ${miss.map(k => `${esc(lbl(k))} <span class="muted">(${esc(WHERE[k] || 'Preenchimento → Mensal')})</span>`).join('; ')}</li>`; }).join('');
    const html = covHtml + `<div class="card missCard"><details><summary>${list.length} indicador(es) desta aba ainda sem dados — ver o que falta informar</summary><ul>${items}</ul></details></div>`;
    const after = pg.querySelector('.impbar') || pg.querySelector('details.period') || pg.querySelector('.phead'); if (after) after.insertAdjacentHTML('afterend', html);
  }

  let tm = null; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { try { decorate(); } catch (e) { console.error(e); } }, 60); }).observe(document.body, { childList: true, subtree: true });
  window.InfoBtn = { close, showInd, decorate };
})();
