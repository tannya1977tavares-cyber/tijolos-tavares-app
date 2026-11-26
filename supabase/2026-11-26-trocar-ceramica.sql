-- Trocar a cerâmica de uma carga já agendada: o preço de custo de cada entrega
-- (carga_admin.custos) é recalculado com a tabela da cerâmica nova.
-- O app da Tijolos já faz isso quando quem troca é o administrador; este gatilho
-- cobre a troca feita por um vendedor (que não pode mexer em carga_admin).

create or replace function public.cargas_custos()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare c jsonb; arr jsonb := '[]'::jsonb; e jsonb; v numeric;
begin
  if tg_op = 'UPDATE' and new.ceramica is not distinct from old.ceramica then
    return new;
  end if;
  select dados into c from public.config where chave = 'custos';
  for e in select * from jsonb_array_elements(new.entregas) loop
    v := (c->new.ceramica->>(e->>'medida'))::numeric;
    if v is null then v := (c->'regiao'->>(e->>'medida'))::numeric; end if;
    arr := arr || to_jsonb(coalesce(v, 0));
  end loop;
  insert into public.carga_admin(carga_id, custos) values (new.id, arr)
    on conflict (carga_id) do update set custos = excluded.custos;
  return new;
end $function$;

drop trigger if exists cargas_custos_trg on public.cargas;
create trigger cargas_custos_trg
  after insert or update of ceramica on public.cargas
  for each row execute function public.cargas_custos();
