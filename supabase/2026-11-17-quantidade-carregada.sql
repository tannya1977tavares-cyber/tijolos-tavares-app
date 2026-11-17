-- Quantidade carregada (opcional em cada entrega, dentro de cargas.entregas -> "carregado": {"mil", "fiadas", "em"}).
-- Não muda nenhuma tabela: é um campo novo no JSON de cada entrega. Entrega sem ele continua igual.
-- Este arquivo só ajusta a planilha (aba "entregas") pra o custo do tijolo usar a quantidade carregada
-- quando ela existir, e mostrar a coluna nova. Pode rodar mais de uma vez.
-- Já aplicado no Supabase em 17/11/2026.
CREATE OR REPLACE FUNCTION public.planilha_dados(t text, aba text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'planilha'
AS $function$
declare r jsonb;
begin
  if not coalesce(public.is_admin(), false) and (t is null or not exists (select 1 from planilha.chave where token = t)) then
    raise exception 'chave invalida';
  end if;
  if aba = 'movimentos' then
    select coalesce(jsonb_agg(x order by x->>'Data' desc, x->>'Hora' desc), '[]') into r from (
      select jsonb_build_object(
        'Data', to_char(m.quando at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
        'Hora', to_char(m.quando at time zone 'America/Sao_Paulo', 'HH24:MI'),
        'Tipo', case when m.tipo = 'entrada' then 'Entrada' else 'Saída' end,
        'Valor', case when m.tipo = 'entrada' then m.valor else -m.valor end,
        'Quem', coalesce(m.contraparte, ''),
        'Categoria', coalesce(c.nome, case when m.pendente then 'A definir' else '' end),
        'Empresa/Pessoal', case m.escopo when 'empresa' then 'Empresa' when 'pessoal' then 'Pessoal' else '' end,
        'Carga', coalesce(to_char(cg.data, 'DD/MM') || ' ' || coalesce(cg.vendedor, ''), ''),
        'Pessoa', coalesce(p.nome, ''),
        'Banco', coalesce(m.banco, ''),
        'Origem', coalesce(m.origem, '')) x
      from fin_movimentos m
      left join fin_categorias c on c.id = m.categoria_id
      left join cargas cg on cg.id = m.carga_id
      left join fin_pessoas p on p.id = m.pessoa_id
      where not coalesce(m.ignorado, false)) s;
  elsif aba = 'entregas' then
    select coalesce(jsonb_agg(x order by x->>'Data' desc), '[]') into r from (
      select jsonb_build_object(
        'Data', to_char(cg.data, 'YYYY-MM-DD'),
        'Vendedor', coalesce(cg.vendedor, ''),
        'Cerâmica', public.nome_fornecedor(cg.ceramica),
        'Status da carga', coalesce(cg.status, ''),
        'Cliente', coalesce(e.v->>'cliente', ''),
        'Medida', coalesce(e.v->>'medida', ''),
        'Milheiros', coalesce((e.v->>'mil')::numeric, 0),
        'Milheiros carregados', coalesce((e.v->'carregado'->>'mil')::numeric, (e.v->>'mil')::numeric, 0),
        'Preço do milheiro', coalesce((e.v->>'preco')::numeric, 0),
        'Total da venda', round(coalesce((e.v->>'mil')::numeric, 0) * coalesce((e.v->>'preco')::numeric, 0) + coalesce((e.v->>'frete')::numeric, 0), 2),
        'Custo do tijolo', round(coalesce((ca.custos->>(e.i - 1)::int)::numeric, 0) * coalesce((e.v->'carregado'->>'mil')::numeric, (e.v->>'mil')::numeric, 0), 2),
        'Recebido no banco', coalesce((select sum(m.valor) from fin_movimentos m where m.tipo = 'entrada' and not coalesce(m.ignorado, false) and m.carga_id = cg.id and m.entrega_idx = e.i - 1), 0),
        'Pagamento', case fe.situacao when 'dinheiro' then 'Dinheiro' when 'pix_manual' then 'Pix (marcado)' when 'prazo' then 'Prazo' when 'pix' then 'Pix' when 'nao_cobrar' then 'Não cobrar' else '' end,
        'Vencimento do prazo', coalesce(to_char(fe.vencimento, 'YYYY-MM-DD'), ''),
        'Pago em', coalesce(to_char(fe.pago_em, 'YYYY-MM-DD'), '')) x
      from cargas cg
      cross join lateral jsonb_array_elements(coalesce(cg.entregas, '[]')) with ordinality as e(v, i)
      left join carga_admin ca on ca.carga_id = cg.id
      left join fin_entregas fe on fe.carga_id = cg.id and fe.idx = e.i - 1) s;
  elsif aba = 'contas' then
    select coalesce(jsonb_agg(x order by x->>'Vencimento'), '[]') into r from (
      select jsonb_build_object(
        'Vencimento', to_char(k.vencimento, 'YYYY-MM-DD'),
        'Conta', k.descricao,
        'Tipo', case k.tipo when 'cartao' then 'Fatura do cartão' when 'boleto' then 'Boleto' when 'parcela' then 'Parcela' when 'fixa' then 'Conta fixa' else 'Outra' end,
        'Parcela', case when k.parcela is not null then k.parcela || '/' || k.parcelas else '' end,
        'Valor', k.valor,
        'Empresa/Pessoal', case k.escopo when 'empresa' then 'Empresa' else 'Pessoal' end,
        'Situação', case when k.pago_em is not null then 'Paga' when k.vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'Vencida' else 'A pagar' end,
        'Pago em', coalesce(to_char(k.pago_em, 'YYYY-MM-DD'), '')) x
      from fin_contas k) s;
  elsif aba = 'mensal' then
    select coalesce(jsonb_agg(x order by x->>'Mês' desc), '[]') into r from (
      select jsonb_build_object(
        'Mês', mes,
        'Entrou empresa', sum(case when tipo = 'entrada' and escopo is distinct from 'pessoal' then valor else 0 end),
        'Saiu empresa', sum(case when tipo = 'saida' and escopo = 'empresa' then valor else 0 end),
        'Sobrou empresa', sum(case when escopo is distinct from 'pessoal' then case when tipo = 'entrada' then valor when escopo = 'empresa' then -valor else 0 end else 0 end),
        'Entrou pessoal', sum(case when tipo = 'entrada' and escopo = 'pessoal' then valor else 0 end),
        'Saiu pessoal', sum(case when tipo = 'saida' and escopo = 'pessoal' then valor else 0 end),
        'Sem categoria', sum(case when tipo = 'saida' and escopo is null then valor else 0 end)) x
      from (select to_char(quando at time zone 'America/Sao_Paulo', 'YYYY-MM') mes, tipo, valor, escopo
            from fin_movimentos where not coalesce(ignorado, false)) m
      group by mes) s;
  else
    raise exception 'aba desconhecida';
  end if;
  return r;
end $function$;
