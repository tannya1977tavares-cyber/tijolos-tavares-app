-- Viagem (várias cargas juntas no mesmo caminhão) e controle de carregamento.
-- Tabela nova e vazia: não muda nenhuma carga, entrega, pagamento ou gasto que já existe.
-- Uma linha por carga que entrou numa viagem ou que tem carregamento anotado.
--   viagem       = id da carga principal da viagem (a própria carga, quando está sozinha)
--   carregamento = só na carga principal: {"fornecedor": true} quando a cerâmica carregou,
--                  ou {"quem": "...", "motorista": "...", "valor": 150}
-- Descarga (ajudantes), diesel, pedágio e comida da viagem ficam ligados à carga principal,
-- então contam uma vez só. Só o administrador vê e muda.
-- Já aplicado no Supabase em 18/11/2026.
create table if not exists public.carga_viagem (
  carga_id text primary key references public.cargas(id) on delete cascade,
  viagem text not null,
  carregamento jsonb,
  atualizado_em timestamptz not null default now()
);
create index if not exists carga_viagem_viagem_idx on public.carga_viagem (viagem);
alter table public.carga_viagem enable row level security;
drop policy if exists "so administrador" on public.carga_viagem;
create policy "so administrador" on public.carga_viagem for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'carga_viagem') then
    alter publication supabase_realtime add table public.carga_viagem;
  end if;
end $$;
