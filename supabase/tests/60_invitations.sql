reset role;
insert into public.invitations (token_hash, owner_key, kind, email, display_name, created_by)
values ('hash-1', 'john', 'new', 'j@x.com', 'John', test.id('mama'));
select test.login('mama');
do $$ begin
  perform test.eq('mamá ve las invitaciones', (select count(*) from public.invitations), 1);
  perform test.denied('mamá tampoco crea invitaciones directo', 'insert into public.invitations(token_hash,owner_key,kind,email,display_name) values (''h'',''john'',''new'',''a@b.c'',''x'')');
end $$;
select test.login('john');
do $$ begin
  perform test.eq('John NO ve invitaciones', (select count(*) from public.invitations), 0);
  perform test.denied('John no consulta correos registrados', 'select public._email_taken(''john@t'')');
end $$;
select test.login('brother');
do $$ begin
  perform test.eq('Hermano NO ve invitaciones', (select count(*) from public.invitations), 0);
  perform test.denied('Hermano no marca invitaciones como usadas', 'update public.invitations set used_at = now()');
end $$;
reset role;
do $$ begin
  perform test.eq('service_role sí consulta correos', (select 1 where (select public._email_taken('john@t'))), 1);
end $$;
