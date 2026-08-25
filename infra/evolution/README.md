# Evolution local para piloto

Esta instalação usa Evolution API 2.3.7, PostgreSQL e Redis em containers locais. A API escuta apenas em `127.0.0.1:8080`; o acesso do Supabase deve ocorrer pelo túnel HTTPS.

## Inicialização

1. Instale Docker Desktop e reinicie o Windows se o instalador solicitar.
2. Execute `./setup.ps1`. O script cria `.env.evolution` com segredos aleatórios; esse arquivo é ignorado pelo Git.
3. Crie uma conta gratuita no ngrok, autentique o cliente e copie o domínio de desenvolvimento atribuído para `NGROK_DOMAIN` em `.env.evolution`.
4. Execute `./start-tunnel.ps1`. O script atualiza a URL publica da Evolution, reinicia o container e abre o tunel; mantenha a janela e o computador ligados.
5. Configure no Supabase, sem expor os valores:
   - `EVOLUTION_API_URL=https://SEU-DOMINIO.ngrok-free.app`
   - `EVOLUTION_GLOBAL_API_KEY` com o valor local de `EVOLUTION_API_KEY`
   - `EVOLUTION_WEBHOOK_SECRET` com o segredo local de mesmo nome
   - `WEBHOOK_URL=https://ksbivaolyusmrcblnnfe.supabase.co/functions/v1/webhook-receiver`

Depois disso, use Configurações > WhatsApp no FestaControl para gerar o QR Code.

## Limitações

- O computador, Docker Desktop e ngrok precisam permanecer ativos.
- O plano gratuito do ngrok possui cotas e não oferece SLA.
- Evolution via Baileys/WhatsApp Web é uma integração beta e pode exigir nova leitura do QR após alterações do WhatsApp.
- A licença do Evolution exige que o uso da Evolution API permaneça informado aos administradores e na documentação. O FestaControl exibe essa informação em Configurações.
