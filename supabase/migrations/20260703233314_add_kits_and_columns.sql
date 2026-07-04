-- Criação da tabela de Kits
CREATE TABLE public.kits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    foto_url TEXT,
    disponivel BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura/escrita anônima em kits" ON public.kits FOR ALL USING (true);

-- Popular com os mockKits originais
INSERT INTO public.kits (nome, preco, foto_url, disponivel) VALUES
('Kit Pegue e Monte Básico', 150.00, 'https://images.unsplash.com/photo-1530103862676-de88924376c2?auto=format&fit=crop&q=80&w=400', true),
('Kit Pegue e Monte Luxo', 280.00, 'https://images.unsplash.com/photo-1505236858219-8373dd7075b3?auto=format&fit=crop&q=80&w=400', true),
('Kit Princesas', 350.00, 'https://images.unsplash.com/photo-1518818419601-1296dd5f6cde?auto=format&fit=crop&q=80&w=400', false);

-- Adicionar colunas novas
ALTER TABLE public.deals ADD COLUMN confirmado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.events ADD COLUMN lembrete_enviado BOOLEAN DEFAULT false;
