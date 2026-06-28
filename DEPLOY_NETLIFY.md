# Guia Completo de Instalação e Deploy no Netlify — VENDAS HBN1

Este guia ajudará você a implantar e configurar o **VENDAS HBN1** no Netlify de forma simples e rápida de ponta a ponta.

---

## 🚀 Como Funciona a Arquitetura

O projeto foi projetado especificamente para ser **serverless e leve no Netlify**:
1. **Frontend (SPA React)**: Compilado para uma pasta estática (`dist/`) e servido pelo Netlify CDN de forma ultra veloz.
2. **Backend (Netlify Functions / Express)**: Código de API hospedado em funções serverless (`/.netlify/functions/api`), acionadas de forma transparente via redirecionamento de `/api/*`. Ele usa um cliente REST otimizado para a Planilha do Google, fazendo o bundle do seu projeto pesar menos de **5MB** e carregar instantaneamente.
3. **Banco de Dados (Firebase)**: Configuração de autenticação offline automática de clientes e pedidos através do Firebase.

---

## 🛠️ Passo 1: Obter a Chave da Conta de Serviço do Google
Para que o sistema visualize e atualize as Planilhas, você precisa de um arquivo de credenciais JSON do Google Cloud:
1. Vá ao [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou selecione o projeto que hospeda sua Planilha.
3. Acesse **IAM e Administrador** -> **Contas de Serviço**.
4. Crie uma Conta de Serviço (ex: `sheets-api-client`).
5. Entre na conta criada, vá até a aba **Chaves** e clique em **Adicionar Chave** -> **Criar nova chave** -> Selecione **JSON** -> Faça o download do arquivo.
6. **MUITO IMPORTANTE**: Abra o arquivo baixado, copie o endereço de e-mail da conta de serviço (ex: `sheets-api-client@meu-projeto.iam.gserviceaccount.com`) e compartilhe suas planilhas de venda com este e-mail dando a permissão de **Editor**.

---

## 🔒 Passo 2: Configurar Variáveis de Ambiente no Netlify

Para que o backend serverless se conecte à planilha, você deve configurar as variáveis de ambiente no painel do Netlify.

### 📍 Onde configurar no Netlify:
Acesse o painel do seu site no Netlify:
`Seu Site -> Site Configuration -> Environment variables -> Add a variable`

Configure as seguintes variáveis:

1. **`GOOGLE_SERVICE_ACCOUNT_JSON`** *(Obrigatório)*:
   Você tem duas maneiras de inserir esta variável:
   
   * **Método 1: Codificado em Base64 (Recomendado para evitar erros de caractere)**
     1. Abra o terminal do seu computador (ou o terminal do AI Studio) e execute o comando para converter o conteúdo do seu arquivo JSON em uma única linha Base64:
        * **Mac/Linux**: `cat sua-chave-privada.json | base64 | tr -d '\r\n'`
        * **Windows (PowerShell)**: `[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content sua-chave-privada.json -Raw)))`
     2. Copie a string única e longa que foi gerada e cole no Netlify como valor de `GOOGLE_SERVICE_ACCOUNT_JSON`. O nosso backend decodificará isso automaticamente em tempo de execução sem risco de quebras de linha quebradas pelo paste!
   
   * **Método 2: Texto JSON Bruto**
     1. Copie todo o conteúdo do arquivo JSON (desde o `{` inicial até o `}` final) e cole diretamente no Netlify.

2. **`GOOGLE_SHEET_ID`** *(Opcional)*:
   Se você quiser definir uma planilha mestre global diferente da padrão, coloque o ID dela aqui.

---

## 📦 Passo 3: Facilitadores de Configuração (Zero Config)

* **Firebase**: Você **NÃO** precisa reconfigurar as variáveis `VITE_FIREBASE_*` no Netlify! O frontend busca essas informações de forma nativa e segura através do arquivo incorporado `firebase-applet-config.json` gerado na instalação do Applet.
* **Redirecionamento**: O arquivo `netlify.toml` já está programado para enviar todas as requisições de `/api/*` diretamente para a função Netlify Serverless que traduz os endpoints do Express para você.

---

## 🌩️ Passo 4: Como Fazer o Deploy

### Opção A: GitHub (Recomendado para atualizações automáticas)
1. Crie um repositório privado no seu GitHub.
2. Comite os arquivos do seu projeto.
3. No Netlify, clique em **Add new site** -> **Import an existing project**.
4. Conecte sua conta do GitHub, selecione o repositório e confirme os dados de build padrão (já configurados no `netlify.toml`):
   * **Build Command**: `npm run build`
   * **Publish Directory**: `dist`
   * **Functions Directory**: `netlify/functions`
5. Clique em **Deploy site**.

### Opção B: Netlify CLI (Deploy manual em 1 minuto)
1. Instale o CLI do Netlify no terminal do seu computador:
   ```bash
   npm install -g netlify-cli
   ```
2. Faça login no Netlify:
   ```bash
   netlify login
   ```
3. Inicialize e conecte seu repositório local:
   ```bash
   netlify init
   ```
4. Execute o deploy de produção:
   ```bash
   netlify deploy --prod
   ```

---

## 🚀 Verificação de Segurança e Conectividade
Após o deploy ter sido concluído com sucesso, você poderá conferir o funcionamento visitando o link de status do seu próprio site:
`https://seu-subdominio.netlify.app/api/health`

Esse endpoint retornará um JSON informativo mostrando se as variáveis de ambiente foram carregadas com sucesso e se o ambiente está ativo e operando em perfeito estado de escala automática.

Seus arquivos estão 100% prontos, leves, seguros e configurados para o melhor desempenho serverless possível no Netlify!
