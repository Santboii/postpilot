alter table content_libraries
add column if not exists platforms text[] default null;
