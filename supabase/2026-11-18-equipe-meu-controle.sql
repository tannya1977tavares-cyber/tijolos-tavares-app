-- Logins da equipe com funções e a área "Meu Controle" de cada funcionário.
-- Funções: vendedor, carga (carga e descarga), motorista. Uma pessoa pode ter várias.
-- Senhas ficam só no Supabase Auth, guardadas com bcrypt (nunca em texto).

-- 1) perfil: funções e ligação com o cadastro de pessoas do Financeiro
alter table public.profiles add column if not exists funcoes text[] not null default '{vendedor}';
alter table public.profiles add column if not exists pessoa_id uuid references public.fin_pessoas(id) on delete set null;

create or replace function public.minha_pessoa() returns uuid
language sql stable security definer set search_path = public as $$
  select pessoa_id from public.profiles where id = (select auth.uid())
$$;

create or replace function public.pode_vender() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin or 'vendedor' = any(funcoes) from public.profiles where id = (select auth.uid())), false)
$$;

-- quem só faz carga, descarga ou motorista não vê clientes nem cria pedido
drop policy if exists "ver clientes" on public.clientes;
create policy "ver clientes" on public.clientes for select to authenticated using ((select public.pode_vender()));
drop policy if exists "cadastrar cliente" on public.clientes;
create policy "cadastrar cliente" on public.clientes for insert to authenticated with check ((select public.pode_vender()));
drop policy if exists "mudar cliente" on public.clientes;
create policy "mudar cliente" on public.clientes for update to authenticated using ((select public.pode_vender())) with check ((select public.pode_vender()));
drop policy if exists "criar carga" on public.cargas;
create policy "criar carga" on public.cargas for insert to authenticated with check (vendedor_id = (select auth.uid()) and (select public.pode_vender()));
drop policy if exists "criar orcamento" on public.orcamentos;
create policy "criar orcamento" on public.orcamentos for insert to authenticated with check (vendedor_id = (select auth.uid()) and (select public.pode_vender()));
drop policy if exists "admin muda perfis" on public.profiles;
create policy "admin muda perfis" on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 2) o que o funcionário anota: descargas, carregadas, motorista e outros serviços
create table if not exists public.func_lancamentos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.fin_pessoas(id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('descarga', 'carregada', 'motorista', 'outro')),
  valor numeric not null default 0 check (valor >= 0),
  obs text not null default '',
  conferido boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists func_lancamentos_pessoa on public.func_lancamentos (pessoa_id, dia);

-- 3) presença do vendedor por turno (vale por diária: salário / 20)
create table if not exists public.func_presenca (
  pessoa_id uuid not null references public.fin_pessoas(id) on delete cascade,
  dia date not null,
  turno text not null check (turno in ('manha', 'tarde', 'dia', 'folga')),
  atualizado_em timestamptz not null default now(),
  primary key (pessoa_id, dia)
);

-- 4) resumos enviados (sexta-feira ou quando o Bruno mandar)
create table if not exists public.func_avisos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.fin_pessoas(id) on delete cascade,
  semana date not null,
  titulo text not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);
create index if not exists func_avisos_pessoa on public.func_avisos (pessoa_id, criado_em desc);

grant select, insert, update, delete on public.func_lancamentos, public.func_presenca, public.func_avisos to authenticated;
alter table public.func_lancamentos enable row level security;
alter table public.func_presenca enable row level security;
alter table public.func_avisos enable row level security;

-- administrador vê e muda tudo; o funcionário só o que é dele
create policy "admin lancamentos" on public.func_lancamentos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "meus lancamentos ver" on public.func_lancamentos for select to authenticated using (pessoa_id = (select public.minha_pessoa()));
create policy "meus lancamentos criar" on public.func_lancamentos for insert to authenticated with check (pessoa_id = (select public.minha_pessoa()) and not conferido);
create policy "meus lancamentos mudar" on public.func_lancamentos for update to authenticated using (pessoa_id = (select public.minha_pessoa()) and not conferido) with check (pessoa_id = (select public.minha_pessoa()) and not conferido);
create policy "meus lancamentos apagar" on public.func_lancamentos for delete to authenticated using (pessoa_id = (select public.minha_pessoa()) and not conferido);

create policy "admin presenca" on public.func_presenca for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "minha presenca ver" on public.func_presenca for select to authenticated using (pessoa_id = (select public.minha_pessoa()));
-- o vendedor marca só os últimos 7 dias (dias antigos só o Bruno muda)
create policy "minha presenca marcar" on public.func_presenca for insert to authenticated with check (pessoa_id = (select public.minha_pessoa()) and dia between current_date - 7 and current_date);
create policy "minha presenca mudar" on public.func_presenca for update to authenticated using (pessoa_id = (select public.minha_pessoa()) and dia >= current_date - 7) with check (pessoa_id = (select public.minha_pessoa()) and dia between current_date - 7 and current_date);
create policy "minha presenca apagar" on public.func_presenca for delete to authenticated using (pessoa_id = (select public.minha_pessoa()) and dia >= current_date - 7);

create policy "admin avisos" on public.func_avisos for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "meus avisos ver" on public.func_avisos for select to authenticated using (pessoa_id = (select public.minha_pessoa()));
-- o app dele cria o resumo automático da sexta (uma vez por semana)
create policy "meus avisos criar" on public.func_avisos for insert to authenticated with check (pessoa_id = (select public.minha_pessoa()) and lido_em is null);
create policy "meus avisos lidos" on public.func_avisos for update to authenticated using (pessoa_id = (select public.minha_pessoa())) with check (pessoa_id = (select public.minha_pessoa()));

alter publication supabase_realtime add table public.func_lancamentos, public.func_presenca, public.func_avisos;

-- 5) "Meu Controle": só os dados da própria pessoa (o administrador escolhe de quem).
-- Não devolve clientes, preços de custo nem gastos da empresa.
create or replace function public.meu_controle(p_pessoa uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid uuid; p public.fin_pessoas; nomes text[];
begin
  if public.is_admin() then pid := coalesce(p_pessoa, public.minha_pessoa()); else pid := public.minha_pessoa(); end if;
  if pid is null then return null; end if;
  select * into p from public.fin_pessoas where id = pid;
  if not found then return null; end if;
  nomes := array[lower(split_part(trim(p.nome), ' ', 1))];
  return jsonb_build_object(
    'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome, 'tipo', p.tipo, 'salario_mes', p.salario_mes, 'inicio', p.inicio, 'valor_carga', p.valor_carga, 'telefone', p.telefone, 'ativo', p.ativo),
    'ajudantes', coalesce((select jsonb_agg(jsonb_build_object('carga_id', a.carga_id, 'pessoa_id', a.pessoa_id, 'valor', a.valor)) from public.fin_carga_ajudantes a where a.pessoa_id = pid), '[]'),
    -- viagens em que o nome dele aparece no carregamento (sem o que os outros ganharam além do necessário)
    'viag', coalesce((select jsonb_agg(jsonb_build_object('carga_id', v.carga_id, 'viagem', v.viagem, 'carregamento',
        case when v.carregamento is null then null else jsonb_build_object('fornecedor', v.carregamento->'fornecedor', 'carregadores', v.carregamento->'carregadores', 'quem', v.carregamento->'quem', 'valor', v.carregamento->'valor',
          'motorista', v.carregamento->'motorista', 'motoristaValor', v.carregamento->'motoristaValor', 'entrega', v.carregamento->'entrega') end))
      from public.carga_viagem v where v.viagem in (select v2.viagem from public.carga_viagem v2 where lower(coalesce(v2.carregamento::text, '')) like '%' || nomes[1] || '%')), '[]'),
    -- cargas: só data e vendedor; as entregas (valor vendido) só nas cargas que ele mesmo vendeu
    'cargas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'data', c.data, 'vendedor', c.vendedor, 'status', c.status,
        'entregas', case when lower(c.vendedor) = lower(p.nome) then (select coalesce(jsonb_agg(jsonb_build_object('mil', e->'mil', 'preco', e->'preco', 'frete', e->'frete')), '[]') from jsonb_array_elements(c.entregas) e) else '[]'::jsonb end))
      from public.cargas c where c.id in (select carga_id from public.fin_carga_ajudantes where pessoa_id = pid)
        or c.id in (select v.carga_id from public.carga_viagem v where lower(coalesce(v.carregamento::text, '')) like '%' || nomes[1] || '%')
        or lower(c.vendedor) = lower(p.nome)), '[]'),
    'movs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'valor', m.valor, 'quando', m.quando, 'pessoa_id', m.pessoa_id, 'ignorado', m.ignorado, 'banco', m.banco, 'contraparte', m.contraparte) order by m.quando)
      from public.fin_movimentos m where m.pessoa_id = pid and m.tipo = 'saida' and not coalesce(m.ignorado, false)), '[]'),
    'faltas', coalesce((select jsonb_agg(jsonb_build_object('pessoa_id', f.pessoa_id, 'dia', f.dia)) from public.fin_faltas f where f.pessoa_id = pid), '[]'),
    'presencas', coalesce((select jsonb_agg(jsonb_build_object('pessoa_id', x.pessoa_id, 'dia', x.dia, 'turno', x.turno)) from public.func_presenca x where x.pessoa_id = pid), '[]'),
    'lancamentos', coalesce((select jsonb_agg(to_jsonb(l) order by l.dia desc, l.criado_em desc) from public.func_lancamentos l where l.pessoa_id = pid), '[]'),
    'avisos', coalesce((select jsonb_agg(to_jsonb(a) order by a.criado_em desc) from (select * from public.func_avisos where pessoa_id = pid order by criado_em desc limit 20) a), '[]')
  );
end $$;
revoke all on function public.meu_controle(uuid) from public, anon;
grant execute on function public.meu_controle(uuid) to authenticated;

-- 6) o Bruno cria e muda logins pelo app (Configurações > Equipe)
create or replace function public.email_login(p_nome text) returns text
language sql immutable as $$
  select regexp_replace(lower(translate(trim(p_nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]', '', 'g') || '@tijolostavares.app'
$$;

create or replace function public.criar_login(p_nome text, p_senha text, p_funcoes text[], p_pessoa uuid) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); em text := public.email_login(p_nome);
begin
  if not public.is_admin() then raise exception 'Só o administrador cria login'; end if;
  if length(coalesce(p_senha, '')) < 4 then raise exception 'A senha precisa ter pelo menos 4 números ou letras'; end if;
  if em = '@tijolostavares.app' then raise exception 'Nome inválido'; end if;
  if exists (select 1 from auth.users where email = em) then raise exception 'Já existe um login com esse nome'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', trim(p_nome)), now(), now(), '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.profiles (id, nome, admin, aparencia, funcoes, pessoa_id) values (uid, trim(p_nome), false, '{}', coalesce(p_funcoes, '{}'), p_pessoa);
  return uid;
end $$;

create or replace function public.mudar_login(p_id uuid, p_senha text, p_funcoes text[], p_pessoa uuid) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Só o administrador muda login'; end if;
  if p_senha is not null and p_senha <> '' then
    if length(p_senha) < 4 then raise exception 'A senha precisa ter pelo menos 4 números ou letras'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  end if;
  update public.profiles set funcoes = coalesce(p_funcoes, funcoes), pessoa_id = p_pessoa where id = p_id and not admin;
end $$;
revoke all on function public.criar_login(text, text, text[], uuid) from public, anon;
revoke all on function public.mudar_login(uuid, text, text[], uuid) from public, anon;
revoke all on function public.email_login(text) from anon;
grant execute on function public.criar_login(text, text, text[], uuid) to authenticated;
grant execute on function public.mudar_login(uuid, text, text[], uuid) to authenticated;

-- 7) login do Fabinho: carga e descarga + motorista, ligado ao cadastro "Fabinho" do Financeiro.
-- (rodado uma vez à parte, como administrador; a senha não fica neste arquivo)
