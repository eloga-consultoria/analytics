/* ELOGA Analytics — extrato bancário (Caixa e recebimento)
   Importa Excel, CSV ou OFX; o usuário indica a que se refere cada coluna; classifica entradas e saídas,
   concilia as entradas com os pagamentos lançados nos lotes das operadoras e com o particular, e alimenta
   "Total recebido", "Saldo de caixa" e os custos do mês. */
(function () {
  'use strict';
  const T = () => ((S && S.detail && (S.detail.bank = S.detail.bank || [])) || []);
  const r2 = v => Math.round(v * 100) / 100;
  const dd = (a, b) => Math.abs((toDate(a) - toDate(b)) / 864e5);

  /* ---------- categorias ---------- */
  const IN = [['in_conv', 'Recebimento de convênio'], ['in_part', 'Recebimento de particular'], ['in_out', 'Outras entradas']];
  const OUT = [['cf_pessoal', 'Equipe administrativa e pró-labore'], ['cf_ocupacao', 'Aluguel, condomínio e utilidades'], ['cf_outros', 'Sistemas, marketing e outros fixos'], ['cv_prof', 'Repasse a profissionais'], ['cv_insumos', 'Insumos e materiais'], ['cv_outros', 'Comissões e outros variáveis'], ['taxas', 'Taxas de cartão e antecipação'], ['impostos', 'Impostos'], ['desp_fin', 'Despesas financeiras (juros e tarifas)'], ['div_parcela', 'Parcelas de empréstimos']];
  const IGN = ['ign', 'Transferência interna / aplicação (ignorar)'], SEM = ['sem', 'Sem categoria'];
  const LBL = Object.fromEntries(IN.concat(OUT, [IGN, SEM]));
  const RULES = [
    ['ign', /\b(transf\w* (entre )?(contas|propria|mesma titular\w*)|aplicacao|resgate|rend\w* (de )?(aplicacao|poupanca|cdb)|aplic\.? aut\w*|invest\w*|cdb|poupanca)\b/],
    ['impostos', /\b(das|simples nacional|darf|iss|pis|cofins|irpj|csll|imposto\w*|tribut\w*|prefeitura|receita federal)\b/],
    ['desp_fin', /\b(tarifa|tar\.?|iof|juros|multa|mora|anuidade|manutencao de conta|pacote de servicos|cesta)\b/],
    ['div_parcela', /\b(emprestimo|financiamento|parcela|consorcio|pronampe|capital de giro)\b/],
    ['taxas', /\b(taxa\w* (de )?(cartao|maquin\w*|adquirencia)|stone|cielo|getnet|pagseguro|pagbank|mercado ?pago|sumup|antecipac\w*|rede card)\b/],
    ['cf_ocupacao', /\b(aluguel|locacao|condominio|iptu|energia|enel|neoenergia|cosern|celpe|cemig|light|sabesp|caern|agua|saneamento|internet|fibra|telefon\w*|vivo|claro|tim|limpeza|zeladoria)\b/],
    ['cf_pessoal', /\b(folha|salario\w*|pro ?labore|fgts|inss|gps|esocial|vale (transporte|refeicao|alimentacao)|13o|ferias|rescis\w*|vt|vr)\b/],
    ['cv_prof', /\b(repasse\w*|honorario\w*|terapeuta|profissional|autonomo|rpa)\b/],
    ['cv_insumos', /\b(material|materiais|insumo\w*|descartav\w*|cosmetic\w*|farmac\w*|dermo\w*|distribuidora)\b/],
    ['cf_outros', /\b(contabil\w*|contador|software|sistema|assinatura|google|meta ads|facebook|instagram|marketing|publicidade|seguro\w*|manutencao|alvara|clinicexperts|clinica experts)\b/]
  ];

  /* ---------- análise: classificação + conciliação ---------- */
  let _an = null;
  function analyze() {
    const tx = T(); const key = tx.length + '|' + S.fat.length + S.dem.length + '|' + S.part.length + '|' + S.cad.payers.length + '|' + tx.reduce((n, t) => n + (t.cat ? 1 : 0), 0);
    if (_an && _an.key === key) return _an;
    const pays = []; S.fat.concat(S.dem).forEach(b => (b.pays || []).forEach(p => { if (p.d && isNum(toNum(p.v))) pays.push({ d: p.d, v: toNum(p.v), payer: b.payer, file: b.file, used: false }); }));
    const part = (S.part || []).filter(p => p.pago && isNum(p.vpago)).map(p => ({ d: p.pago, v: p.vpago, used: false }));
    const payers = (S.cad.payers || []).filter(p => !isPrivate(p.name) && String(p.name).trim().length >= 3).map(p => ({ n: p.name, k: norm(p.name) }));
    const res = new Array(tx.length); const order = tx.map((t, i) => i).sort((a, b) => tx[a].d < tx[b].d ? -1 : tx[a].d > tx[b].d ? 1 : a - b);
    const byGroup = {}; pays.forEach(p => { const k = p.payer + '|' + p.d; (byGroup[k] = byGroup[k] || []).push(p); });
    for (const i of order) { const t = tx[i], nd = ' ' + norm(t.desc) + ' ';
      if (t.cat) { res[i] = { cat: t.cat, st: 'man', link: 'Classificado por você' }; continue; }
      if (RULES[0][1].test(nd)) { res[i] = { cat: 'ign', st: 'auto', link: 'Regra: transferência / aplicação' }; continue; }
      if (t.v > 0) {
        const namePay = payers.find(p => nd.includes(p.k));
        const cand = pays.filter(p => !p.used && Math.abs(p.v - t.v) <= 0.01 && dd(p.d, t.d) <= 10).sort((a, b) => (namePay && norm(b.payer) === namePay.k ? 1 : 0) - (namePay && norm(a.payer) === namePay.k ? 1 : 0) || dd(a.d, t.d) - dd(b.d, t.d))[0];
        if (cand) { cand.used = true; res[i] = { cat: 'in_conv', st: 'ok', link: `Lote ${cand.payer}${cand.file ? ' · ' + cand.file : ''} (pago em ${toDate(cand.d).toLocaleDateString('pt-BR')})` }; continue; }
        let grp = null; for (const g of Object.values(byGroup)) { const free = g.filter(p => !p.used); if (free.length > 1 && Math.abs(free.reduce((s, p) => s + p.v, 0) - t.v) <= 0.01 && dd(free[0].d, t.d) <= 10) { grp = free; break; } }
        if (grp) { grp.forEach(p => p.used = true); res[i] = { cat: 'in_conv', st: 'ok', link: `${grp.length} lotes de ${grp[0].payer} pagos juntos` }; continue; }
        const ps = part.find(p => !p.used && Math.abs(p.v - t.v) <= 0.01 && dd(p.d, t.d) <= 3);
        if (ps) { ps.used = true; res[i] = { cat: 'in_part', st: 'ok', link: 'Pagamento do particular (controle do particular)' }; continue; }
        if (namePay) { res[i] = { cat: 'in_conv', st: 'nome', link: `Operadora ${namePay.n} pelo nome, sem pagamento lançado no lote` }; continue; }
        res[i] = { cat: 'in_out', st: 'pend', link: 'Entrada sem lançamento correspondente' };
      } else {
        const rule = RULES.find(r => r[1].test(nd)); res[i] = rule ? { cat: rule[0], st: 'auto', link: 'Classificado por palavra da descrição' } : { cat: 'sem', st: 'pend', link: 'Saída sem categoria' };
      }
    }
    // pagamentos lançados nos lotes dentro do período do extrato que não aparecem como entrada
    const ds = tx.map(t => t.d).sort(); const lo = ds[0], hi = ds[ds.length - 1];
    const sobra = tx.length ? pays.filter(p => !p.used && p.d >= lo && p.d <= hi) : [];
    _an = { key, res, sobra }; return _an;
  }

  function monthly() {
    const tx = T(), A = analyze(), M = {}; const mo = ym => (M[ym] = M[ym] || { in: 0, out: 0, cats: {}, caixa: null });
    tx.forEach((t, i) => { const c = A.res[i].cat, o = mo(t.d.slice(0, 7)); o.cats[c] = (o.cats[c] || 0) + t.v; if (c === 'ign') return; if (t.v > 0) o.in += t.v; else o.out += -t.v; });
    // saldo de caixa: último saldo do mês em cada conta (com carregamento dos meses sem movimento)
    const accs = [...new Set(tx.map(t => t.acc || ''))]; const months = Object.keys(M).sort();
    accs.forEach(a => { let last = null; const mm = months.length ? (() => { const r = []; for (let m = months[0]; m <= months[months.length - 1]; m = addMonths(m, 1)) r.push(m); return r; })() : [];
      mm.forEach(ym => { const rows = tx.filter(t => (t.acc || '') === a && t.d.slice(0, 7) === ym && isNum(t.bal)); if (rows.length) { const lastT = rows.reduce((x, y) => (y.d > x.d || (y.d === x.d && (y.seq || 0) >= (x.seq || 0))) ? y : x); last = lastT.bal; }
        if (last !== null && M[ym]) M[ym].caixa = (M[ym].caixa || 0) + last; }); });
    return M;
  }

  /* ---------- alimenta o painel (Total recebido, saldo de caixa e custos do mês) ---------- */
  const seen = new WeakSet(); const _d = window.derived;
  window.derived = function () {
    const out = _d.apply(this, arguments); if (seen.has(out)) return out; seen.add(out);
    try { if (!T().length) return out; const M = monthly();
      Object.keys(M).forEach(ym => { const o = out[ym] = out[ym] || { _lag: [], _n: 0 }; const m = M[ym];
        o.recebido = r2(m.in); if (isNum(m.caixa)) o.caixa = r2(m.caixa);
        OUT.forEach(([k]) => { const v = -(m.cats[k] || 0); if (v > 0 && !isNum(o[k])) o[k] = r2(v); }); });
    } catch (e) { console.error(e); }
    return out;
  };
  const _av = window.availableMonths;
  window.availableMonths = function () { const a = _av.apply(this, arguments); try { if ((typeof isEPage === 'function' && isEPage()) || !T().length) return a;
    const s = new Set(a); T().forEach(t => s.add(t.d.slice(0, 7))); const arr = [...s].filter(m => /^\d{4}-\d{2}$/.test(m)).sort(); const out = []; for (let m = arr[0]; m <= arr[arr.length - 1]; m = addMonths(m, 1)) out.push(m); return out; } catch (e) { return a; } };
  const _ra = window.resetAll; window.resetAll = function () { _an = null; return _ra.apply(this, arguments); };
  const _uc = window.upgradeClient; window.upgradeClient = function (c) { c = _uc.apply(this, arguments); try { c.detail = c.detail || {}; c.detail.bank = c.detail.bank || []; } catch (e) { } return c; };

  /* ---------- importação ---------- */
  const FIELDS = [
    { k: 'date', l: 'Data da movimentação', req: 1, syn: ['data', 'data mov', 'data movimento', 'data lancamento', 'dt', 'data transacao', 'data da transacao', 'dt movimento'], h: 'Dia em que o dinheiro entrou ou saiu. Define o mês. Obrigatório.' },
    { k: 'desc', l: 'Descrição / histórico', syn: ['descricao', 'historico', 'lancamento', 'memo', 'detalhe', 'detalhes', 'favorecido', 'beneficiario', 'nome', 'estabelecimento'], h: 'Texto do lançamento. Usado para classificar (aluguel, folha, imposto...) e reconhecer o nome da operadora.' },
    { k: 'doc', l: 'Documento / identificador', syn: ['documento', 'doc', 'nr documento', 'numero documento', 'id', 'fitid', 'protocolo', 'autenticacao'], h: 'Número do documento ou da transação. Opcional.' },
    { k: 'valor', l: 'Valor (entradas positivas, saídas negativas)', syn: ['valor', 'vlr', 'valor r', 'montante', 'amount', 'valor lancamento'], h: 'Uma única coluna de valor. Se o banco mostra tudo positivo, indique também a coluna Tipo.' },
    { k: 'cred', l: 'Crédito (entradas) – se o banco separa', syn: ['credito', 'creditos', 'entrada', 'entradas', 'valor credito', 'valor de credito'], h: 'Use quando o extrato tem uma coluna só para entradas.' },
    { k: 'deb', l: 'Débito (saídas) – se o banco separa', syn: ['debito', 'debitos', 'saida', 'saidas', 'valor debito', 'valor de debito'], h: 'Use quando o extrato tem uma coluna só para saídas.' },
    { k: 'tipo', l: 'Tipo (crédito/débito, C/D)', syn: ['tipo', 'natureza', 'c d', 'd c', 'cred deb', 'deb cred', 'operacao', 'tipo lancamento', 'tipo de lancamento'], h: 'Quando o valor vem sempre positivo: indica se é crédito (C) ou débito (D).' },
    { k: 'saldo', l: 'Saldo após a movimentação', syn: ['saldo', 'saldo apos', 'saldo final', 'saldo do dia', 'balance', 'saldo r'], h: 'Permite calcular o saldo de caixa no fim de cada mês. Opcional.' }
  ];
  let BK = null; const UI = { mes: '', sit: '', all: true, pg: 0 };
  const g = (r, k) => BK.map[k] ? (r[BK.map[k]] ?? '') : '';
  function amt(v) {
    if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return v;
    let s = String(v).trim(); if (!s) return null; let sign = 1; const m = s.match(/^(.*?\d)\s*([CD])$/i); if (m) { s = m[1]; if (/d/i.test(m[2])) sign = -1; }
    if (/^-?\d+(\.\d+)?$/.test(s)) return sign * parseFloat(s); const n = toNum(s); return n === null ? null : sign * n;
  }
  const decode = buf => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); } };

  function parseOFX(text) {
    const tag = (blk, t) => { const m = blk.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
    const rows = []; const re = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>)/gi; let m;
    while ((m = re.exec(text))) { const b = m[1]; const dt = tag(b, 'DTPOSTED').slice(0, 8); const d = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '';
      const nm = tag(b, 'NAME'), mm = tag(b, 'MEMO'); rows.push({ 'Data': d, 'Descrição': [nm, mm].filter((x, i, a) => x && a.indexOf(x) === i).join(' · '), 'Valor': tag(b, 'TRNAMT').replace(',', '.'), 'Documento': tag(b, 'FITID') || tag(b, 'CHECKNUM'), 'Tipo': tag(b, 'TRNTYPE') }); }
    const bal = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i); const bank = tag(text, 'BANKID'), acct = tag(text, 'ACCTID');
    return { ofx: true, headers: ['Data', 'Descrição', 'Valor', 'Documento', 'Tipo'], rows, final: bal ? parseFloat(bal[1].replace(',', '.')) : null, acc: [bank && 'Banco ' + bank, acct && 'conta ' + acct].filter(Boolean).join(' · ') };
  }

  async function read(f) {
    if (!f) return; loader('Lendo o extrato...');
    try {
      let parsed;
      if (/\.(ofx|ofc|qfx)$/i.test(f.name) || (/\.txt$/i.test(f.name))) { const txt = decode(await f.arrayBuffer()); if (/<OFX|OFXHEADER/i.test(txt)) parsed = parseOFX(txt); else parsed = null; }
      if (!parsed) { const aoa = await readAOA(f); const { headers, rows } = aoaToRows(aoa); parsed = { headers, rows, final: null, acc: '' }; }
      if (!parsed.rows.length) throw new Error('nenhuma movimentação encontrada');
      const map = parsed.ofx ? { date: 'Data', desc: 'Descrição', valor: 'Valor', doc: 'Documento', tipo: 'Tipo' } : autoMap(FIELDS, parsed.headers);
      if (map.cred && map.deb && map.valor && map.valor === map.cred) delete map.valor;
      BK = { file: f.name, headers: parsed.headers, rows: parsed.rows, map, acc: parsed.acc || f.name.replace(/\.[^.]+$/, ''), inv: false, final: isNum(parsed.final) ? parsed.final : null, ofx: !!parsed.ofx };
      loader(); preview();
    } catch (e) { loader(); toast('Não foi possível ler o extrato: ' + e.message, 'bad'); console.error(e); }
  }

  function build() {
    const out = []; let skip = 0; const M = BK.map;
    for (const r of BK.rows) {
      const dt = toDate(g(r, 'date')); if (!dt) { skip++; continue; } const desc = String(g(r, 'desc')).trim(); let v = null;
      if (M.cred || M.deb) { const c = amt(g(r, 'cred')), d = amt(g(r, 'deb')); if (c === null && d === null) { skip++; continue; } v = (c || 0) - Math.abs(d || 0); }
      else if (M.valor) { v = amt(g(r, 'valor')); if (v === null) { skip++; continue; }
        if (M.tipo) { const tp = norm(g(r, 'tipo')); if (/^(d|deb|saida|pagto|pgto|pagamento|compra|saque|tarifa)/.test(tp)) v = -Math.abs(v); else if (/^(c|cred|entrada|deposito|recebimento)/.test(tp)) v = Math.abs(v); } }
      else { skip++; continue; }
      if (BK.inv) v = -v; if (!v || /^saldo\b/.test(norm(desc))) { skip++; continue; }
      out.push({ d: isoLocal(dt), v: r2(v), desc, doc: String(g(r, 'doc')).trim(), bal: M.saldo ? amt(g(r, 'saldo')) : null, acc: BK.acc });
    }
    if (out.length > 1 && out[0].d > out[out.length - 1].d) out.reverse(); // extratos do mais novo para o mais antigo
    out.forEach((t, i) => t.seq = i);
    if (!out.some(t => isNum(t.bal)) && isNum(BK.final)) { let run = BK.final; for (let i = out.length - 1; i >= 0; i--) { out[i].bal = r2(run); run -= out[i].v; } }
    out.forEach(t => { if (!isNum(t.bal)) delete t.bal; if (!t.doc) delete t.doc; });
    BK.out = out; BK.skip = skip; return out;
  }

  function preview() {
    const out = build(); const F = FIELDS; const sample = BK.rows[0] || {};
    const opts = sel => `<option value="">— não usar —</option>` + BK.headers.map(h => `<option ${sel === h ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const miss = []; if (!BK.map.date) miss.push('Data'); if (!BK.map.valor && !BK.map.cred && !BK.map.deb) miss.push('Valor (ou Crédito/Débito)');
    const ent = out.filter(t => t.v > 0).reduce((s, t) => s + t.v, 0), sai = out.filter(t => t.v < 0).reduce((s, t) => s - t.v, 0); const ds = out.map(t => t.d).sort();
    const exist = T().filter(t => (t.acc || '') === BK.acc && ds.length && t.d >= ds[0] && t.d <= ds[ds.length - 1]).length;
    const lastBal = out.length && isNum(out[out.length - 1].bal) ? out[out.length - 1].bal : null;
    workBox().innerHTML = `<div class="card"><h3>Extrato bancário: ${esc(BK.file)}</h3>
      ${miss.length ? notice('warn', 'Indique a coluna de: <b>' + miss.join(', ') + '</b>.') : notice('good', `<b>${out.length.toLocaleString('pt-BR')} movimentações</b> de ${ds.length ? toDate(ds[0]).toLocaleDateString('pt-BR') + ' a ' + toDate(ds[ds.length - 1]).toLocaleDateString('pt-BR') : '—'} · entradas <b>${fmtMoney2(ent)}</b> · saídas <b>${fmtMoney2(sai)}</b>${isNum(lastBal) ? ` · saldo final <b>${fmtMoney2(lastBal)}</b>` : ''}.${BK.skip ? ` ${BK.skip} linha(s) sem data ou valor foram ignoradas (cabeçalhos, totais, saldos).` : ''}${exist ? ` <b>${exist}</b> movimentações já importadas desta conta no mesmo período serão substituídas.` : ''}`)}
      <div class="grid g2"><div class="field c6"><label>Banco / conta</label><input value="${esc(BK.acc)}" onchange="Bank.set('acc',this.value)"><small>Várias contas podem ser importadas; o saldo de caixa soma o último saldo de cada uma.</small></div>
      <div class="field c6"><label>Saldo final do extrato (R$) <small>(se o arquivo não tiver coluna de saldo)</small></label><input value="${isNum(BK.final) ? esc(String(BK.final).replace('.', ',')) : ''}" placeholder="ex.: 12.345,67" onchange="Bank.set('final',toNum(this.value))"></div></div>
      <h4 style="margin:12px 0 6px">Colunas do arquivo</h4><p class="muted">${BK.ofx ? 'Arquivo OFX: as colunas já vêm definidas pelo banco. ' : ''}Indique a que se refere cada coluna da planilha. Use <b>Valor</b> (uma coluna) <i>ou</i> <b>Crédito e Débito</b> (duas colunas).</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Informação</th><th>Para que serve</th><th>Coluna do arquivo</th><th>Exemplo da 1ª linha</th></tr></thead><tbody>
      ${F.map(f => `<tr><td><b>${esc(f.l)}</b>${f.req ? ' <span class="req">*</span>' : ''}</td><td><small>${esc(f.h)}</small></td><td><select onchange="Bank.setMap('${f.k}',this.value)">${opts(BK.map[f.k])}</select></td><td><small>${BK.map[f.k] ? esc(String(sample[BK.map[f.k]] ?? '').slice(0, 40)) : '—'}</small></td></tr>`).join('')}</tbody></table></div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" ${BK.inv ? 'checked' : ''} onchange="Bank.set('inv',this.checked)"> Inverter o sinal (o banco mostra saídas como positivas e não tem coluna de tipo)</label>
      <div class="tscroll" style="max-height:260px"><table class="tbl sm"><thead><tr><th>Data</th><th>Descrição</th><th>Documento</th><th>Valor</th><th>Saldo</th></tr></thead><tbody>${out.slice(0, 12).map(t => `<tr><td>${toDate(t.d).toLocaleDateString('pt-BR')}</td><td>${esc(t.desc)}</td><td>${esc(t.doc || '')}</td><td class="num ${t.v < 0 ? 'neg' : 'pos'}">${fmtMoney2(t.v)}</td><td class="num">${isNum(t.bal) ? fmtMoney2(t.bal) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhuma movimentação reconhecida com as colunas atuais.</td></tr>'}</tbody></table></div>
      <div class="row end"><button class="btn ghost" onclick="Bank.cancel()">Cancelar</button><button class="btn pdf" ${miss.length || !out.length ? 'disabled' : ''} onclick="Bank.commit()">Importar extrato</button></div></div>`;
    workBox().scrollIntoView({ behavior: 'smooth' });
  }

  function commit() {
    const out = build(); if (!out.length) return; const ds = out.map(t => t.d).sort(), a = ds[0], b = ds[ds.length - 1]; const id = uid();
    out.forEach(t => t.s = id);
    S.detail.bank = T().filter(t => !((t.acc || '') === BK.acc && t.d >= a && t.d <= b)).concat(out).sort((x, y) => x.d < y.d ? -1 : x.d > y.d ? 1 : (x.seq || 0) - (y.seq || 0));
    const ent = out.filter(t => t.v > 0).reduce((s, t) => s + t.v, 0), sai = out.filter(t => t.v < 0).reduce((s, t) => s - t.v, 0); const keep = SIMP; SIMP = { file: BK.file };
    try { logImport('bank', out.length, `${BK.acc} · ${toDate(a).toLocaleDateString('pt-BR')}–${toDate(b).toLocaleDateString('pt-BR')} · entradas ${fmtMoney(ent)}, saídas ${fmtMoney(sai)}`, id); } finally { SIMP = keep; }
    BK = null; resetAll(); toast(`${out.length.toLocaleString('pt-BR')} movimentações importadas e conciliadas.`, 'good'); show('caixa');
  }

  /* ---------- tela: seção do extrato em Caixa e recebimento ---------- */
  function section() {
    const tx = T(); const btn = `<button class="btn pdf" onclick="Bank.start()">Importar extrato bancário</button>`;
    if (!tx.length) return `<div class="card smart" id="bankSec"><div><h3>Extrato bancário</h3><p>Importe o extrato do banco (Excel, CSV ou OFX) e indique a que se refere cada coluna. O painel classifica entradas e saídas, concilia as entradas com os pagamentos lançados nos lotes das operadoras e com o particular, e alimenta o total recebido, o saldo de caixa e os custos do mês.</p></div><div class="row" style="margin:0;margin-left:auto">${btn}</div></div>`;
    const A = analyze(), M = monthly(), ms = Object.keys(M).sort();
    const sum = f => tx.reduce((s, t, i) => s + f(t, A.res[i]), 0);
    const ent = sum((t, r) => t.v > 0 && r.cat !== 'ign' ? t.v : 0), sai = sum((t, r) => t.v < 0 && r.cat !== 'ign' ? -t.v : 0);
    const entOk = sum((t, r) => t.v > 0 && r.st === 'ok' ? t.v : 0), pend = tx.filter((t, i) => A.res[i].st === 'pend'); const pendV = pend.reduce((s, t) => s + Math.abs(t.v), 0);
    const lastBal = (() => { const x = tx.filter(t => isNum(t.bal)); return x.length ? x[x.length - 1].bal : null; })(); const sobraV = A.sobra.reduce((s, p) => s + p.v, 0);
    const k = (sig, n, v, d, cls = 'neu') => `<div class="kpi ${cls}"><div class="kl"><span class="sig">${sig}</span>${n}</div><div class="kv">${v}</div><div class="kd">${d}</div></div>`;
    const catRows = (list, sign) => list.filter(([c]) => ms.some(m => M[m].cats[c])).map(([c, l]) => `<tr><td>${esc(l)}</td>${ms.map(m => `<td class="num">${M[m].cats[c] ? fmtMoney(sign * M[m].cats[c]) : '—'}</td>`).join('')}</tr>`).join('');
    const rowsF = tx.map((t, i) => [t, i, A.res[i]]).filter(([t, , r]) => (!UI.mes || t.d.slice(0, 7) === UI.mes) && (!UI.sit || (UI.sit === 'pend' ? r.st === 'pend' : UI.sit === 'ok' ? r.st === 'ok' : UI.sit === 'in' ? t.v > 0 : t.v < 0)));
    const per = 200, pgs = Math.max(1, Math.ceil(rowsF.length / per)); if (UI.pg >= pgs) UI.pg = 0; const view = rowsF.slice(UI.pg * per, UI.pg * per + per);
    const sel = (t, i, r) => `<select onchange="Bank.setCat(${i},this.value)">${(t.v > 0 ? IN.concat([IGN]) : OUT.concat([IGN, SEM])).map(([c, l]) => `<option value="${c}" ${r.cat === c ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const stChip = r => ({ ok: '<span class="chip ok">Conciliado</span>', man: '<span class="chip">Manual</span>', nome: '<span class="chip warn">Sem lote</span>', pend: '<span class="chip warn">Classificar</span>', auto: '<span class="chip">Automático</span>' })[r.st] || '';
    return `<div id="bankSec"><div class="card"><div class="chead"><h3>Extrato bancário e conciliação</h3><div class="row" style="margin:0">${btn}<a href="#" class="muted" onclick="show('importar');return false">Ver / excluir arquivos importados</a></div></div>
      <div class="kpis">${k('Entradas', 'Entradas no extrato', fmtMoney(ent), 'Sem transferências internas e aplicações.')}${k('Saídas', 'Saídas no extrato', fmtMoney(sai), 'Sem transferências internas e aplicações.')}${k('Saldo', 'Saldo final', isNum(lastBal) ? fmtMoney(lastBal) : '—', isNum(lastBal) ? 'Último saldo do extrato.' : 'Sem coluna de saldo: informe o saldo final ao importar.')}
      ${k('Conciliado', 'Entradas conciliadas', ent ? fmtPct(entOk / ent) : '—', `${fmtMoney(entOk)} batem com pagamentos lançados nos lotes ou no particular.`, ent && entOk / ent < .6 ? 'bad' : 'good')}${k('Pendente', 'A classificar', fmtNum(pend.length), `${fmtMoney(pendV)} em entradas sem lançamento e saídas sem categoria.`, pend.length ? 'bad' : 'good')}${k('Sem entrada', 'Pagamentos lançados sem entrada', fmtNum(A.sobra.length), `${fmtMoney(sobraV)} lançados nos lotes e não encontrados no extrato.`, A.sobra.length ? 'bad' : 'good')}</div>
      <div class="tscroll"><table class="tbl sm"><thead><tr><th>Por mês</th>${ms.map(m => `<th>${monthLabel(m)}</th>`).join('')}</tr></thead><tbody>
      <tr class="grp"><td colspan="${ms.length + 1}">Entradas</td></tr>${catRows(IN, 1)}<tr class="b"><td>Total de entradas</td>${ms.map(m => `<td class="num">${fmtMoney(M[m].in)}</td>`).join('')}</tr>
      <tr class="grp"><td colspan="${ms.length + 1}">Saídas</td></tr>${catRows(OUT.concat([SEM]), -1)}<tr class="b"><td>Total de saídas</td>${ms.map(m => `<td class="num">${fmtMoney(M[m].out)}</td>`).join('')}</tr>
      <tr class="hl"><td>Saldo de caixa no fim do mês</td>${ms.map(m => `<td class="num">${isNum(M[m].caixa) ? fmtMoney(M[m].caixa) : '—'}</td>`).join('')}</tr></tbody></table></div>
      <div class="howto"><b>Como ler:</b> as entradas vão para <b>Total recebido</b> do mês e o saldo do fim do mês para <b>Saldo de caixa</b> (valores digitados à mão em Preencher dados continuam valendo). As saídas classificadas viram custos do mês quando o custo não vem de outra fonte (repasse cadastrado, notas fiscais, controle do particular). Entrada <b>conciliada</b> = valor igual a um pagamento lançado em lote de operadora (±10 dias) ou no controle do particular (±3 dias); vários lotes pagos juntos também são reconhecidos.</div></div>
      ${A.sobra.length ? `<div class="card"><div class="chead"><h3>Pagamentos lançados nos lotes sem entrada no extrato (${A.sobra.length})</h3></div><div class="tscroll" style="max-height:260px"><table class="tbl sm"><thead><tr><th>Operadora</th><th>Arquivo do lote</th><th>Data do pagamento</th><th>Valor</th></tr></thead><tbody>${A.sobra.slice(0, 100).map(p => `<tr><td>${esc(p.payer)}</td><td><small>${esc(p.file || '')}</small></td><td>${toDate(p.d).toLocaleDateString('pt-BR')}</td><td class="num">${fmtMoney2(p.v)}</td></tr>`).join('')}</tbody></table></div><div class="howto"><b>O que fazer:</b> confira se o pagamento caiu em outra conta (importe o extrato dela), se a data/valor lançados no lote estão certos ou se o dinheiro ainda não entrou.</div></div>` : ''}
      <div class="card"><div class="chead"><h3>Movimentações</h3><div class="row" style="margin:0"><select onchange="Bank.f('mes',this.value)"><option value="">Todos os meses</option>${ms.map(m => `<option value="${m}" ${UI.mes === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
        <select onchange="Bank.f('sit',this.value)">${[['', 'Todas'], ['pend', 'A classificar'], ['ok', 'Conciliadas'], ['in', 'Só entradas'], ['out', 'Só saídas']].map(([v, l]) => `<option value="${v}" ${UI.sit === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" ${UI.all ? 'checked' : ''} onchange="Bank.f('all',this.checked)"> aplicar a descrições iguais</label></div></div>
      <div class="tscroll" style="max-height:520px"><table class="tbl sm"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Situação</th><th>Observação</th></tr></thead><tbody>
      ${view.map(([t, i, r]) => `<tr><td>${toDate(t.d).toLocaleDateString('pt-BR')}</td><td>${esc(t.desc)}</td><td class="num ${t.v < 0 ? 'neg' : 'pos'}">${fmtMoney2(t.v)}</td><td>${sel(t, i, r)}</td><td>${stChip(r)}</td><td><small>${esc(r.link)}</small></td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhuma movimentação neste filtro.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:8px;align-items:center"><span class="muted">${fmtNum(rowsF.length)} movimentação(ões)${pgs > 1 ? ` · página ${UI.pg + 1} de ${pgs}` : ''}</span>${pgs > 1 ? `<button class="btn ghost sm" onclick="Bank.page(-1)">‹ Anterior</button><button class="btn ghost sm" onclick="Bank.page(1)">Próxima ›</button>` : ''}</div></div></div>`;
  }

  const _rc = window.renderCaixa;
  window.renderCaixa = function () { const r = _rc.apply(this, arguments); try { const pg = document.getElementById('pg_caixa'); if (pg) { const old = pg.querySelector('#bankSec'); if (old) old.remove(); pg.insertAdjacentHTML('beforeend', section()); } } catch (e) { console.error(e); } return r; };
  RENDER.caixa = window.renderCaixa;

  window.Bank = {
    start() { if (!S) return; const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.txt,.ofx,.ofc,.qfx'; inp.onchange = () => read(inp.files[0]); inp.click(); },
    setMap(k, v) { if (v) BK.map[k] = v; else delete BK.map[k]; preview(); }, set(k, v) { BK[k] = v; preview(); },
    cancel() { BK = null; workBox().innerHTML = ''; }, commit,
    f(k, v) { UI[k] = v; UI.pg = 0; renderCaixa(); }, page(d) { UI.pg = Math.max(0, UI.pg + d); renderCaixa(); },
    setCat(i, c) { const tx = T(), t = tx[i]; if (!t) return; const key = norm(t.desc), sg = t.v > 0;
      if (UI.all && key) tx.forEach(x => { if (norm(x.desc) === key && (x.v > 0) === sg) x.cat = c; }); else t.cat = c;
      resetAll(); renderCaixa(); },
    analyze, monthly, parseOFX, cats: LBL
  };
})();
