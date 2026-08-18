DELETE FROM public.wtn_document_images WHERE document_id IN (SELECT id FROM public.wtn_documents WHERE file_name ILIKE 'INV%');
DELETE FROM public.wtn_documents WHERE file_name ILIKE 'INV%';