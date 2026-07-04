# 🎉 FestaFlow

Sistema web de gestão logística, CRM e acervo inteligente para empresas de eventos — construído com React, Supabase e Inteligência Artificial (Gemini API).

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-BaaS-3FCF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-AI-4285F4?logo=google&logoColor=white)

---

## 📋 Sobre o Projeto

O **FestaFlow** nasceu para resolver um problema real: a desorganização operacional de uma empresa de eventos que gerenciava festas, acervo de decorações e atendimento ao cliente de forma totalmente manual.

### Funcionalidades Principais

- **Pipeline de Vendas (Kanban):** Funil visual para acompanhar orçamentos desde o primeiro contato até a confirmação da festa.
- **Agenda Logística:** Painel operacional com visão por dia/semana/mês, controle de status (separação → entrega → montagem) e checklist de carregamento.
- **Catálogo e Acervo Inteligente:** Galeria de decorações com busca semântica por IA — digite "festa rústica com girassóis" e encontre a foto exata.
- **Caixa de Entrada (Avisos):** Sistema de lembretes automáticos para festas próximas com disparo direto para o WhatsApp.
- **Gerador de Orçamentos:** Formulário inteligente que monta o orçamento, calcula o valor e cria o card no pipeline automaticamente.
- **Base de Clientes:** CRM completo com histórico de interações, fichas detalhadas e filtros avançados.
- **Triagem de Orçamentos com IA:** Integração com a API do Gemini para transformar mensagens desestruturadas de clientes em dados organizados no banco.

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| **Front-end** | React 18, Vite, CSS Modules |
| **Back-end / BaaS** | Supabase (PostgreSQL, Auth, Storage, RLS) |
| **Inteligência Artificial** | Google Gemini API (texto + visão) |
| **Deploy** | Vercel |

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/festaflow.git
cd festaflow

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Preencha o .env.local com suas credenciais do Supabase e Gemini

# Rode em modo de desenvolvimento
npm run dev
```

---

## 📁 Estrutura do Projeto

```
src/
├── components/       # Componentes React (Agenda, Kanban, Catálogo, etc.)
│   └── ui/           # Design System (Button, Card, Badge, Modal, etc.)
├── contexts/         # Context API (CompanyContext)
├── services/         # Serviços de banco de dados (dbService)
├── constants.js      # Constantes do pipeline e configurações
├── supabaseClient.js # Configuração do cliente Supabase
├── App.jsx           # Componente raiz e roteamento
└── index.css         # Variáveis CSS globais e design tokens
```

---

## 📄 Licença

Este projeto é de uso pessoal/portfólio.
