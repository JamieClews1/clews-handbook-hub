insert into public.user_roles (user_id, role)
values ('ac1bc214-bf10-4ada-afe9-2e05c12abfd6', 'user')
on conflict (user_id, role) do nothing;