-- 1. Create `acervo` table
CREATE TABLE public.acervo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT NOT NULL, -- Ex: 'Tema', 'Painel', 'Peça'
    localizacao TEXT,
    apelidos TEXT[], -- Array of strings for aliases
    observacoes TEXT,
    ativo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Trigger for updated_at
CREATE TRIGGER update_acervo_modtime
    BEFORE UPDATE ON public.acervo
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Enable RLS
ALTER TABLE public.acervo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura/escrita anônima em acervo" ON public.acervo FOR ALL USING (true);


-- 2. Create `acervo_composicao` table (Estoque Inteligente - Future Sprint)
CREATE TABLE public.acervo_composicao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tema_id UUID REFERENCES public.acervo(id) ON DELETE CASCADE NOT NULL,
    peca_id UUID REFERENCES public.acervo(id) ON DELETE CASCADE NOT NULL,
    quantidade INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER update_acervo_composicao_modtime
    BEFORE UPDATE ON public.acervo_composicao
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Enable RLS
ALTER TABLE public.acervo_composicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura/escrita anônima em acervo_composicao" ON public.acervo_composicao FOR ALL USING (true);


-- 3. Add `tema_id` to `deals` table
ALTER TABLE public.deals 
ADD COLUMN tema_id UUID REFERENCES public.acervo(id) ON DELETE SET NULL;
