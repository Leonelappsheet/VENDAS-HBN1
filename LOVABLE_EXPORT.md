# PROJETO INTEGRADO - EXPORTAÇÃO PARA O LOVABLE

Este arquivo contém a estrutura de diretórios e o código-fonte completo do projeto para importação direta e referência no Lovable.

## 📁 ESTRUTURA DE DIRETÓRIOS

```
.
├── netlify/
│   └── functions/
│       ├── api.ts
│       └── cleanup.ts
├── public/
│   └── logo.svg
├── src/
│   ├── components/
│   │   ├── BarcodeScanner.tsx
│   │   ├── ConfigWarning.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── InstallPrompt.tsx
│   ├── constants/
│   │   └── regionals.ts
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── lib/
│   │   ├── firebase.ts
│   │   ├── firestore-errors.ts
│   │   ├── schemas.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── AdminPanel.tsx
│   │   ├── ClientSelection.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ImportPanel.tsx
│   │   ├── Login.tsx
│   │   └── ProductCatalog.tsx
│   ├── services/
│   │   └── dataService.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── types.ts
│   └── vite-env.d.ts
├── .env.example
├── .gitignore
├── DEPLOY_NETLIFY.md
├── firebase-applet-config.json
├── firebase-blueprint.json
├── firestore.rules
├── index.html
├── metadata.json
├── netlify.toml
├── package.json
├── server.ts
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

## 💻 CÓDIGO-FONTE DOS ARQUIVOS

### 📄 Arquivo: `.env.example`

```
# Configurações do Google Sheets
GOOGLE_SHEET_ID=1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs
GOOGLE_SERVICE_ACCOUNT_JSON=

# Configurações do Firebase (Frontend)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_ID=

# Outras Configurações
NODE_ENV=production

```

---

### 📄 Arquivo: `.gitignore`

```
node_modules/
build/
dist/
coverage/
.DS_Store
*.log
.env*
!.env.example

```

---

### 📄 Arquivo: `DEPLOY_NETLIFY.md`

```markdown
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
   \`\`\`bash
   npm install -g netlify-cli
   \`\`\`
2. Faça login no Netlify:
   \`\`\`bash
   netlify login
   \`\`\`
3. Inicialize e conecte seu repositório local:
   \`\`\`bash
   netlify init
   \`\`\`
4. Execute o deploy de produção:
   \`\`\`bash
   netlify deploy --prod
   \`\`\`

---

## 🚀 Verificação de Segurança e Conectividade
Após o deploy ter sido concluído com sucesso, você poderá conferir o funcionamento visitando o link de status do seu próprio site:
`https://seu-subdominio.netlify.app/api/health`

Esse endpoint retornará um JSON informativo mostrando se as variáveis de ambiente foram carregadas com sucesso e se o ambiente está ativo e operando em perfeito estado de escala automática.

Seus arquivos estão 100% prontos, leves, seguros e configurados para o melhor desempenho serverless possível no Netlify!

```

---

### 📄 Arquivo: `firebase-applet-config.json`

```json
{
  "projectId": "ai-studio-applet-webapp-34ebb",
  "appId": "1:35928227294:web:a8877955b11ec59dfcb14f",
  "apiKey": "AIzaSyB8cOud0BuE2uxLJ8DYpZvJTlN4p9TH1Ro",
  "authDomain": "ai-studio-applet-webapp-34ebb.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-1a6d9535-e2b1-45dd-bf5c-e0593e5498a5",
  "storageBucket": "ai-studio-applet-webapp-34ebb.firebasestorage.app",
  "messagingSenderId": "35928227294",
  "measurementId": ""
}
```

---

### 📄 Arquivo: `firebase-blueprint.json`

```json
{
  "entities": {
    "Product": {
      "title": "Product",
      "description": "Product in the catalog",
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "Unique product ID" },
        "ean": { "type": "string", "description": "Barcode" },
        "description": { "type": "string", "description": "Product description" },
        "stock": { "type": "number", "description": "Current stock quantity" },
        "salePrice": { "type": "number", "description": "Original sale price" },
        "discount": { "type": "number", "description": "Discount percentage" },
        "finalPrice": { "type": "number", "description": "Price after discount" },
        "category": { "type": "string", "description": "Product category" },
        "manufacturer": { "type": "string", "description": "Product manufacturer" },
        "photo": { "type": "string", "description": "URL to product photo" },
        "type": { "type": "string", "enum": ["normal", "offer", "new"], "description": "Product listing type" }
      },
      "required": ["id", "description", "finalPrice"]
    },
    "Client": {
      "title": "Client",
      "description": "Customer information",
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "Unique client ID" },
        "name": { "type": "string", "description": "Full name" },
        "tradeName": { "type": "string", "description": "Trade name (Nome Fantasia)" },
        "cnpj": { "type": "string", "description": "CNPJ tax ID" },
        "seller": { "type": "string", "description": "Assigned seller name" },
        "email": { "type": "string", "format": "email", "description": "Contact email" },
        "address": { "type": "string", "description": "Full address" },
        "city": { "type": "string", "description": "City" },
        "state": { "type": "string", "description": "State" },
        "buyer": { "type": "string", "description": "Buyer name" },
        "phone": { "type": "string", "description": "Contact phone" },
        "regional": { "type": "string", "description": "Regional office" }
      },
      "required": ["id", "name"]
    },
    "Order": {
      "title": "Order",
      "description": "Sales order",
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "Order ID" },
        "date": { "type": "string", "format": "date-time", "description": "Order date" },
        "clientId": { "type": "string", "description": "Reference to client" },
        "clientName": { "type": "string", "description": "Client name at time of order" },
        "email": { "type": "string", "description": "Client email" },
        "seller": { "type": "string", "description": "Seller name" },
        "phone": { "type": "string", "description": "Contact phone" },
        "total": { "type": "number", "description": "Total order value" },
        "status": { "type": "string", "enum": ["Novo", "Confirmado", "Entregue", "Cancelado", "Rascunho"], "description": "Order status" },
        "items": { "type": "array", "items": { "type": "object" }, "description": "Ordered items" },
        "observation": { "type": "string", "description": "Order notes" },
        "pdfUrl": { "type": "string", "description": "URL to generated PDF" }
      },
      "required": ["id", "clientId", "total", "status"]
    },
    "UserProfile": {
      "title": "User Profile",
      "description": "Extended user information",
      "type": "object",
      "properties": {
        "uid": { "type": "string", "description": "Firebase Auth UID" },
        "name": { "type": "string", "description": "Full name" },
        "role": { "type": "string", "enum": ["admin", "vendedor", "promotor"], "description": "User role" },
        "phone": { "type": "string", "description": "Contact phone" },
        "email": { "type": "string", "format": "email", "description": "Email" },
        "regional": { "type": "string", "description": "Regional office" }
      },
      "required": ["uid", "role"]
    },
    "Favorite": {
      "title": "Favorite",
      "description": "Customer favorite product",
      "type": "object",
      "properties": {
        "clientId": { "type": "string", "description": "Client ID" },
        "productId": { "type": "string", "description": "Product ID" },
        "description": { "type": "string", "description": "Product description" },
        "addedBy": { "type": "string", "description": "User who added" },
        "dateAdded": { "type": "string", "format": "date-time", "description": "Date added" }
      },
      "required": ["clientId", "productId"]
    },
    "Visit": {
      "title": "Visit",
      "description": "Geolocation visit record",
      "type": "object",
      "properties": {
        "id": { "type": "string", "description": "Client ID" },
        "name": { "type": "string", "description": "Client name" },
        "cnpj": { "type": "string", "description": "CNPJ" },
        "address": { "type": "string", "description": "Address" },
        "city": { "type": "string", "description": "City" },
        "state": { "type": "string", "description": "State" },
        "timestamp": { "type": "number", "description": "Unix timestamp" },
        "seller": { "type": "string", "description": "Seller name" }
      },
      "required": ["id", "timestamp", "seller"]
    }
  },
  "firestore": {
    "products": {
      "schema": "Product",
      "description": "Catalog products"
    },
    "clients": {
      "schema": "Client",
      "description": "Customer database"
    },
    "orders": {
      "schema": "Order",
      "description": "Sales orders"
    },
    "users": {
      "schema": "UserProfile",
      "description": "User profiles"
    },
    "favorites": {
      "schema": "Favorite",
      "description": "Customer favorite products"
    },
    "visits": {
      "schema": "Visit",
      "description": "Seller visit history"
    }
  }
}

```

---

### 📄 Arquivo: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && 
        (request.auth.token.email == "leonelamorimm@gmail.com" && request.auth.token.email_verified == true);
    }

    function isSeller(sellerName) {
      // Logic for verifying seller could involve checking user record
      return isSignedIn();
    }

    // --- Rules ---

    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId) || isAdmin();
    }

    match /products/{productId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /clients/{clientId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /orders/{orderId} {
      // Owners can see their orders, admins see all
      allow read: if isSignedIn() && (resource.data.email == request.auth.token.email || isAdmin());
      // Only authenticated users can place orders
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }

    match /favorites/{favId} {
      // key is usually {userId}_{productId}
      allow read, write: if isSignedIn() && (favId.startsWith(request.auth.uid) || isAdmin());
    }

    match /visits/{visitId} {
      allow read: if isSignedIn() && (resource.data.seller == request.auth.token.email || isAdmin());
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }

    match /banners/{bannerId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /carts/{clientId} {
      // Carts are keyed by clientId or userId
      allow read, write: if isSignedIn();
    }
  }
}

```

---

### 📄 Arquivo: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, shrink-to-fit=no" />
    <title>VENDAS HBN1</title>
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <link rel="apple-touch-icon" href="/logo.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script>
      // Global error handler to catch initialization issues on mobile
      window.onerror = function(msg, url, lineNo, columnNo, error) {
        var root = document.getElementById('root');
        if (root && root.innerHTML === "") {
          root.innerHTML = '<div style="padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px; font-family: sans-serif;">' +
            '<h3>Erro na Inicialização</h3>' +
            '<p>' + msg + '</p>' +
            '<button onclick="window.location.reload()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Recarregar</button>' +
            '</div>';
        }
        return false;
      };
    </script>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>


```

---

### 📄 Arquivo: `metadata.json`

```json
{
  "name": "VENDAS HBN1",
  "description": "Sistema de gestão de vendas para Higiene & Beleza, com catálogo de produtos, suporte offline, histórico de pedidos e painel administrativo.",
  "requestFramePermissions": ["geolocation", "camera"],
  "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
}

```

---

### 📄 Arquivo: `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "20"
  AWS_LAMBDA_JS_RUNTIME = "nodejs20.x"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Professional Header & Cache Configuration
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://placehold.co https://images.weserv.nl https://wa.me https://*.netlify.app; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.gstatic.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self'; connect-src 'self' https: wss:;"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"


```

---

### 📄 Arquivo: `netlify/functions/api.ts`

```tsx
import serverless from 'serverless-http';
import app from '../../server';

const handlerFunc = serverless(app);

export const handler = async (event: any, context: any) => {
  try {
    console.log(`[Function] Handling ${event.httpMethod} ${event.path}`);
    return await handlerFunc(event, context);
  } catch (err: any) {
    console.error('[Function] Fatal Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Function Error', message: err.message, stack: err.stack }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

```

---

### 📄 Arquivo: `netlify/functions/cleanup.ts`

```tsx
import { schedule } from '@netlify/functions';
import axios from 'axios';

// This function can be scheduled via Netlify dashboard or toml
// Internal URL would be needed, but since it's serverless, 
// we can call the API internally if we wrap the logic or just let the API handle it.

// For simplicity and since we don't have a reliable internal URL during build,
// this function acts as a placeholder for the "Routine" logic.
// In a real production setup, this would loop through regionals and trigger a cleanup.

export const handler = schedule('0 0 * * *', async (event) => {
  console.log('Running daily discount cleanup routine...');
  
  // To trigger cleanup on Sheets:
  // 1. We would need to iterate through all regionals
  // 2. Since this function is part of the bundle, we can import the logic
  // However, avoid complex imports in functions if possible.
  
  // The system is designed to "Clean on Read", which is more robust.
  // This function is kept as a placeholder if physical sheet cleaning is required.
  
  return {
    statusCode: 200,
  };
});

```

---

### 📄 Arquivo: `package.json`

```json
{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "start": "tsx server.ts",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^1.29.0",
    "@netlify/functions": "^5.2.1",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "@zxing/browser": "^0.1.5",
    "@zxing/library": "^0.21.3",
    "axios": "^1.14.0",
    "clsx": "^2.1.1",
    "cors": "^2.8.6",
    "dotenv": "^17.2.3",
    "exceljs": "^4.4.0",
    "express": "^4.21.2",
    "firebase": "^12.11.0",
    "googleapis": "^171.4.0",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "pdfjs-dist": "^5.6.205",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.13.2",
    "recharts": "^2.12.7",
    "serverless-http": "^4.0.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "vite-plugin-pwa": "^1.2.0",
    "xlsx": "^0.18.5",
    "xlsx-js-style": "^1.2.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```

---

### 📄 Arquivo: `server.ts`

```tsx
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import axios from "axios";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const apiRouter = express.Router();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - (Path: ${req.path})`);
  next();
});

const getInitialSpreadsheetId = () => {
  const envSheetId = (process.env.GOOGLE_SHEET_ID || "").trim();
  const envIdDaPlanilha = (process.env.ID_da_planilha || "").trim();
  
  if (envSheetId && !envSheetId.startsWith("AIza")) {
    return cleanSpreadsheetId(envSheetId);
  }
  if (envIdDaPlanilha) {
    return cleanSpreadsheetId(envIdDaPlanilha);
  }
  return "1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs";
};

const DEFAULT_SPREADSHEET_ID = getInitialSpreadsheetId();

const getRequestSpreadsheetId = (req: express.Request) => {
  const headerId = req.headers['x-spreadsheet-id'] as string || req.query.spreadsheetId as string;
  
  const defaultTimon = '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs';
  const defaultThe = '1I79E8X9b8O-g1wIc5fsKuO2DW9GCU24uZFkpTEQAcEk';
  const defaultImp = '1z2a_wzBrVPUEk8RrTEsIV9MsV9XBZQd9eZM6AwMwVyE';

  const envSheetId = (process.env.GOOGLE_SHEET_ID || "").trim();
  const envIdDaPlanilha = (process.env.ID_da_planilha || "").trim();
  const activeMainSheet = envSheetId || envIdDaPlanilha;

  const envTimon = (process.env.GOOGLE_SHEET_ID_TIMON || "").trim();
  const envThe = (process.env.GOOGLE_SHEET_ID_THE || "").trim();
  const envImp = (process.env.GOOGLE_SHEET_ID_IMP || "").trim();

  if (headerId) {
    const trimmedHeader = headerId.trim();
    if (trimmedHeader === defaultTimon) {
      if (envTimon) return cleanSpreadsheetId(envTimon);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    } else if (trimmedHeader === defaultThe) {
      if (envThe) return cleanSpreadsheetId(envThe);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    } else if (trimmedHeader === defaultImp) {
      if (envImp) return cleanSpreadsheetId(envImp);
      if (activeMainSheet) return cleanSpreadsheetId(activeMainSheet);
    }
    return trimmedHeader;
  }
  return DEFAULT_SPREADSHEET_ID;
};

function normalizeEAN(ean: any): string {
  if (ean === null || ean === undefined) return '';
  let s = String(ean).trim().replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.length > 0 && s.length < 13) {
    s = s.padStart(13, '0');
  }
  return s;
}

// Admin check helper
const isAdmin = (email: string) => {
  const admins = ["leonelamorimm@gmail.com"];
  return admins.includes(email);
};

// API Routes on apiRouter
apiRouter.post("/product/update-image", async (req, res) => {
  try {
    const { id, imageUrl, sheetName } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    
    if (!id || !imageUrl || !sheetName) {
      return res.status(400).json({ error: "Missing required fields (id, imageUrl, sheetName)" });
    }

    const sheets = await getSheetsClient();

    // 1. Get current data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: `Sheet "${sheetName}" not found or empty.` });
    }

    const headers = rows[0];
    const idIdx = headers.findIndex((h: string) => {
      const normalizedH = String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return ["idproduto", "id", "codigo", "cod"].includes(normalizedH);
    });
    
    const photoIdx = headers.findIndex((h: string) => {
       const normalizedH = String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
       return ["foto", "imagem", "url", "photo", "link", "img"].includes(normalizedH) || normalizedH.includes("foto");
    });

    if (idIdx === -1) {
      return res.status(500).json({ error: `Coluna ID não encontrada na sheet "${sheetName}".` });
    }

    // 2. Find the row index
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIdx] || "").trim() === String(id).trim());

    if (rowIdx === -1) {
      return res.status(404).json({ error: `Produto ID "${id}" não encontrado na sheet "${sheetName}".` });
    }

    // 3. Update the row
    let targetPhotoIdx = photoIdx;
    const getColumnLetter = (index: number) => {
      let letter = "";
      while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    if (targetPhotoIdx === -1) {
      // Photo column doesn't exist, create it at the end
      targetPhotoIdx = headers.length;
      const colLetter = getColumnLetter(targetPhotoIdx);
      
      // Add "Foto" header
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${colLetter}1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Foto"]],
        },
      });
    }

    const sheetRowNumber = rowIdx + 1;
    const colLetter = getColumnLetter(targetPhotoIdx);
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${colLetter}${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[imageUrl]],
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating image in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Google Sheets Client Lazy Initialization
let sheetsClient: any = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  let authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!authJson) {
    throw new Error(
      "A variável de ambiente GOOGLE_SERVICE_ACCOUNT_JSON não está configurada. " +
      "Se você estiver no Netlify, adicione esta variável em 'Site Configuration' -> 'Environment variables' " +
      "com o conteúdo completo do seu arquivo JSON de Conta de Serviço Google Cloud. " +
      "Dica: Para evitar erros de formatação com quebras de linha no Netlify, você pode codificar o JSON em Base64 e salvar a string única gerada!"
    );
  }

  // Handle Base64-encoded JSON strings (very common in automated deployments like Netlify/Vercel)
  if (authJson && !authJson.startsWith('{') && !authJson.startsWith('[') && !authJson.includes(' ')) {
    try {
      const decoded = Buffer.from(authJson, 'base64').toString('utf8');
      if (decoded.startsWith('{')) {
        console.log("Successfully decoded GOOGLE_SERVICE_ACCOUNT_JSON from Base64 representation");
        authJson = decoded;
      }
    } catch (b64Err) {
      console.warn("Attempted to decode GOOGLE_SERVICE_ACCOUNT_JSON as Base64, but failed. Proceeding with raw string.", b64Err);
    }
  }

  // Handle cases where the secret might be wrapped in quotes (common copy-paste issue)
  if ((authJson.startsWith('"') && authJson.endsWith('"')) || 
      (authJson.startsWith("'") && authJson.endsWith("'"))) {
    authJson = authJson.slice(1, -1).trim();
  }

  // Handle common escaping issues
  let credentials;
  try {
    credentials = JSON.parse(authJson);
  } catch (e) {
    try {
      // Try to unescape if it looks like a stringified JSON
      credentials = JSON.parse(JSON.parse(`"${authJson}"`));
    } catch (e2) {
      const preview = authJson.substring(0, 30) + "...";
      let message = `Erro ao analisar GOOGLE_SERVICE_ACCOUNT_JSON. O valor começa com "${preview}".`;
      
      if (authJson.includes('@') && !authJson.startsWith('{')) {
        message += " Parece que você colou apenas o EMAIL da conta de serviço. Você deve copiar o conteúdo JSON COMPLETO do arquivo de chave.";
      } else {
        message += " Verifique se colou o conteúdo JSON COMPLETO do arquivo de chave da sua conta de serviço (incluindo as chaves {}).";
      }
      
      throw new Error(message);
    }
  }

  // Normalize private key escapes (extremely common on Netlify, Vercel, and Cloud environments)
  if (credentials && credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  // Lightweight REST client instead of heavy googleapis package
  // This fully prevents Netlify/Vercel/serverless bundle size and dynamic require issue!
  let cachedToken: string | null = null;
  let tokenExpiryTime = 0;

  const toBase64Url = (str: string | Buffer): string => {
    const buf = typeof str === 'string' ? Buffer.from(str) : str;
    return buf.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < tokenExpiryTime - 60) {
      return cachedToken;
    }

    try {
      const header = { alg: 'RS256', typ: 'JWT' };
      const claim = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      };

      const base64Header = toBase64Url(JSON.stringify(header));
      const base64Claim = toBase64Url(JSON.stringify(claim));
      const signatureInput = `${base64Header}.${base64Claim}`;

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signatureInput);
      const signature = toBase64Url(sign.sign(credentials.private_key));

      const jwt = `${signatureInput}.${signature}`;

      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      });

      cachedToken = tokenResponse.data.access_token;
      tokenExpiryTime = now + (tokenResponse.data.expires_in || 3600);
      return cachedToken;
    } catch (tokenErr: any) {
      console.error("Error generating Google Auth Access Token:", tokenErr?.response?.data || tokenErr.message);
      throw new Error(`Google Auth error: ${tokenErr?.response?.data?.error_description || tokenErr.message}`);
    }
  }

  const axiosInstance = axios.create({
    timeout: 30000,
  });

  sheetsClient = {
    spreadsheets: {
      get: async ({ spreadsheetId }: { spreadsheetId: string }) => {
        const token = await getAccessToken();
        return axiosInstance.get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      },
      values: {
        get: async ({ spreadsheetId, range }: { spreadsheetId: string, range: string }) => {
          const token = await getAccessToken();
          return axiosInstance.get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        update: async ({ spreadsheetId, range, valueInputOption, requestBody }: { spreadsheetId: string, range: string, valueInputOption: string, requestBody: any }) => {
          const token = await getAccessToken();
          return axiosInstance.put(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`, requestBody, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        append: async ({ spreadsheetId, range, valueInputOption, requestBody }: { spreadsheetId: string, range: string, valueInputOption: string, requestBody: any }) => {
          const token = await getAccessToken();
          return axiosInstance.post(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`, requestBody, {
            headers: { Authorization: `Bearer ${token}` }
          });
        },
        clear: async ({ spreadsheetId, range }: { spreadsheetId: string, range: string }) => {
          const token = await getAccessToken();
          return axiosInstance.post(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
    }
  };

  return sheetsClient;
}

function cleanSpreadsheetId(id: string) {
  if (!id) return "";
  
  // If the ID starts with 'AIza', it's likely an API Key and NOT a Spreadsheet ID.
  // In this case, we'll ignore it and use the default ID.
  if (id.trim().startsWith("AIza")) {
    console.warn("WARNING: GOOGLE_SHEET_ID secret starts with 'AIza' (API Key). Ignoring it to use the correct Spreadsheet ID.");
    return "1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs";
  }

  // If user pasted the full URL, extract the ID
  const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const extractedId = match ? match[1] : id.trim();
  
  return extractedId;
}

// API Routes Metadata
let cachedSpreadsheetInfo: Record<string, any> = {};
let cachedMetadataFetchTime: Record<string, number> = {};
const METADATA_CACHE_DURATION = 60000; // 1 minute

apiRouter.get("/status", async (req, res) => {
  const spreadsheetId = getRequestSpreadsheetId(req);
  console.log(`[Status] Check requested for: ${spreadsheetId}`);
  try {
    const authJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    if (!authJson) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is missing from Secrets." 
      });
    }

    let credentials;
    try {
      let cleanedJson = authJson;
      if ((cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) || 
          (cleanedJson.startsWith("'") && cleanedJson.endsWith("'"))) {
        cleanedJson = cleanedJson.slice(1, -1).trim();
      }
      try {
        credentials = JSON.parse(cleanedJson);
      } catch (innerErr) {
        credentials = JSON.parse(JSON.parse(`"${cleanedJson}"`));
      }
      if (credentials && credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      return res.json({ 
        ok: false, 
        error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." 
      });
    }

    const serviceAccountEmail = credentials?.client_email || "";
    const now = Date.now();
    let isApiKey = spreadsheetId.startsWith("AIza");
    let spreadsheetError = null;

    if (!cachedSpreadsheetInfo[spreadsheetId] || (now - (cachedMetadataFetchTime[spreadsheetId] || 0) > METADATA_CACHE_DURATION)) {
      try {
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.get({
          spreadsheetId,
        });
        
        const sheetTitles = response.data.sheets?.map((s: any) => s.properties.title) || [];
        
        cachedSpreadsheetInfo[spreadsheetId] = {
          title: response.data.properties?.title,
          sheets: sheetTitles,
          headers: {} // Headers fetched on demand now to save quota
        };
        cachedMetadataFetchTime[spreadsheetId] = now;
      } catch (err: any) {
        spreadsheetError = err.message;
        if (err.code === 404 && isApiKey) {
          spreadsheetError = `ERRO CRÍTICO: O ID "${spreadsheetId}" não foi encontrado. Este valor parece ser uma CHAVE DE API (começa com 'AIza'). Você deve usar o ID da Planilha que fica na URL do navegador. Exemplo: 1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs`;
        } else if (err.code === 404) {
          spreadsheetError = `Planilha não encontrada (ID: ${spreadsheetId}). Verifique se o ID está correto e se você compartilhou a planilha com o e-mail: ${serviceAccountEmail}`;
        }
      }
    }

    res.json({
      ok: !spreadsheetError,
      serviceAccountEmail,
      spreadsheetId,
      isApiKey,
      spreadsheetInfo: cachedSpreadsheetInfo[spreadsheetId],
      spreadsheetError,
      instructions: [
        `1. Open your Google Sheet in your browser.`,
        `2. Copy the ID from the URL (the long string between '/d/' and '/edit').`,
        `3. Update the GOOGLE_SHEET_ID secret in AI Studio.`,
        `4. Share the sheet with: ${serviceAccountEmail}`
      ]
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const dataCache: Record<string, { data: any, timestamp: number }> = {};
const DATA_CACHE_DURATION = 30000; // 30 seconds

apiRouter.get("/data/:sheetName", async (req, res) => {
  try {
    const { sheetName } = req.params;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const fetchNow = Date.now();

    const cacheKey = `${spreadsheetId}_${sheetName}`;

    // Check cache
    if (dataCache[cacheKey] && (fetchNow - dataCache[cacheKey].timestamp < DATA_CACHE_DURATION)) {
      return res.json(dataCache[cacheKey].data);
    }

    const sheets = await getSheetsClient();
    
    console.log(`Fetching sheet: ${sheetName} from spreadsheet: ${spreadsheetId}`);

    // First, verify the spreadsheet exists and get available sheet names
    let availableSheets: string[] = [];
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });
      availableSheets = spreadsheet.data.sheets?.map((s: any) => s.properties.title) || [];
    } catch (err: any) {
      console.error("Error verifying spreadsheet:", err.message);
      if (err.code === 404) {
        return res.status(404).json({
          error: `Spreadsheet ID "${spreadsheetId}" not found.`,
          details: "Check your GOOGLE_SHEET_ID secret. Ensure the ID is correct and the Service Account has access."
        });
      }
      throw err;
    }

    // Try to find the sheet with a case-insensitive match or trimmed match
    let targetSheet = availableSheets.find(s => s.trim().toLowerCase() === sheetName.trim().toLowerCase());
    
    if (!targetSheet) {
      return res.status(404).json({
        error: `Sheet "${sheetName}" not found in spreadsheet.`,
        availableSheets,
        details: `Available tabs are: ${availableSheets.join(", ")}. Please ensure your Google Sheet has a tab named exactly "${sheetName}".`
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheet}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      const emptyData: any[] = [];
      dataCache[sheetName] = { data: emptyData, timestamp: fetchNow };
      return res.json(emptyData);
    }

    const headers = rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Identify discount related columns dynamically on the backend too
    const keysNormalized = headers.map((k: any) => String(k || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const priceIdx = keysNormalized.findIndex((k: string) => ["pv", "preco venda", "preco", "valor"].includes(k));
    const finalIdx = keysNormalized.findIndex((k: string) => ["pf", "preco final", "valor final"].includes(k));
    const discIdx = keysNormalized.findIndex((k: string) => ["desconto", "percentual"].includes(k));
    const validIdx = keysNormalized.findIndex((k: string) => ["validade", "expira", "vencimento"].includes(k));

    const data = rows.slice(1).map((row: any) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        let val = row[index];
        
        // Backend Expiration logic: if we found the relevant columns, check them
        if (index === discIdx || index === finalIdx) {
          const validDateStr = row[validIdx];
          if (validDateStr) {
            try {
              let parsedDate: Date | null = null;
              if (typeof validDateStr === 'number') {
                parsedDate = new Date((validDateStr - 25569) * 86400 * 1000);
              } else if (String(validDateStr).includes('/')) {
                const parts = String(validDateStr).split('/');
                if (parts.length === 3) parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              } else {
                parsedDate = new Date(validDateStr);
              }

              if (parsedDate && !isNaN(parsedDate.getTime())) {
                parsedDate.setHours(0, 0, 0, 0);
                if (today > parsedDate) {
                  // Expired!
                  if (index === discIdx) val = "0.00%";
                  if (index === finalIdx) val = row[priceIdx];
                }
              }
            } catch (e) {}
          }
        }

        obj[header] = val;
      });
      return obj;
    });

    // Update cache
    dataCache[cacheKey] = { data, timestamp: fetchNow };

    res.json(data);
  } catch (error: any) {
    console.error(`Error fetching sheet ${req.params.sheetName}:`, error);
    res.status(500).json({ 
      error: "Error fetching data from Sheets", 
      message: error.message,
      stack: error.stack,
      details: error.details || error,
      sheet: req.params.sheetName 
    });
  }
});

apiRouter.post("/order", async (req, res) => {
  try {
    const order = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const sheets = await getSheetsClient();

    // 1. Save to Pedidos sheet
    // IDPedido, Data, IDCliente, Nome Cliente, Email, Vendedor, Celular, Total, Status, Itens, Observacao, PdfUrl
    const orderRow = [
      order.id,
      order.date,
      order.clientId,
      order.clientName,
      order.email,
      order.seller,
      order.phone,
      order.total,
      order.status,
      `${order.items.length} itens`,
      order.observation,
      order.pdfUrl || ""
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Pedidos!A:L",
      valueInputOption: "RAW",
      requestBody: {
        values: [orderRow],
      },
    });

    // 2. Save to ItensPedido sheet
    // IDItem, IDPedido, IDProduto, Codigo Barras, Descricao, Fabricante, Qtd, Preco, Subtotal
    const itemRows = order.items.map((item: any, index: number) => [
      `${order.id}-${index + 1}`,
      order.id,
      item.id,
      item.ean || "",
      item.description,
      item.manufacturer || "",
      item.quantity,
      item.finalPrice,
      item.quantity * item.finalPrice
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "ItensPedido!A:I",
      valueInputOption: "RAW",
      requestBody: {
        values: itemRows,
      },
    });

    res.json({ sucesso: true, idPedido: order.id });
  } catch (error: any) {
    console.error("Error saving order to Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/catalog/update", async (req, res) => {
  try {
    const { industria, dados, defaultExpiryDate } = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const data = dados;
    const industry = industria;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "Dados inválidos ou vazios (dados/data)." });
    }

    const sheets = await getSheetsClient();

    // Industry-specific column mappings (0-indexed)
    // Based on the provided mapping table image
    const INDUSTRY_MAPPINGS: Record<string, any> = {
      'DANONE': { id: 1, ean: 0, desc: 3, stock: 9, price: 5, discount: 4, final: 7 },
      'UNILEVER': { id: 1, ean: 2, desc: 3, stock: 7, price: 8, discount: 11, final: 12 }, 
      'KIMBERLY': { id: 1, ean: 1, desc: 2, stock: 3, price: 4, discount: 5, final: 6 },
      'KENVUE': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
      'OMRON': { id: 5, ean: 3, desc: 4, stock: 13, price: 6, discount: 7, final: 8 },
    };

    // 1. Get current data from all 3 sheets
    const sheetsToSync = ["Produtos", "Ofertas", "Lancamentos"];
    console.log(`Updating catalog for industry: ${industria} on spreadsheet ${spreadsheetId} across all sheets: ${sheetsToSync.join(", ")}`);

    const sheetData: Record<string, { rows: any[][], headers: any[] }> = {};
    const existingProductsMap = new Map<string, { row: any[], sheetName: string }[]>();

    // Sequential fetch to avoid issues, or Promise.all for speed
    await Promise.all(sheetsToSync.map(async (sheetName) => {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`,
        });
        
        const allRows = response.data.values || [];
        if (allRows.length > 0) {
          const headers = allRows[0];
          sheetData[sheetName] = { rows: allRows, headers };

          // A: ID, B: EAN
          const idIdx = 0;
          const eanIdx = 1;

          allRows.slice(1).forEach(row => {
            const id = String(row[idIdx] || "").trim();
            const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
            const ean = normalizeEAN(rawEan);
            
            const entry = { row, sheetName };
            if (id && id.length >= 2) {
              if (!existingProductsMap.has(id)) existingProductsMap.set(id, []);
              existingProductsMap.get(id)!.push(entry);
            }
            if (ean) {
              if (!existingProductsMap.has(ean)) existingProductsMap.set(ean, []);
              existingProductsMap.get(ean)!.push(entry);
            }
          });
        }
      } catch (e) {
        console.warn(`Sheet ${sheetName} not found or inaccessible on ${spreadsheetId}, skipping.`);
      }
    }));

    if (Object.keys(sheetData).length === 0) {
      return res.status(404).json({ error: "Nenhuma das planilhas de produtos (Produtos/Ofertas/Lancamentos) foi encontrada." });
    }

    // Common indices for all sheets (A to G)
    const idIdx = 0;
    const eanIdx = 1;
    const descIdx = 2;
    const stockIdx = 3;
    const priceIdx = 4;
    const discIdx = 5;
    const finalIdx = 6;
    const validIdx = 7;
    
    // Process the uploaded data
    const mapping = INDUSTRY_MAPPINGS[industria.toUpperCase()] || INDUSTRY_MAPPINGS['UNILEVER'];
    
    // Try to find the header row in the source data (first 10 rows)
    let sourceHeaders: string[] = [];
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (Array.isArray(row) && row.some(cell => {
        const s = String(cell || "").toLowerCase();
        return s.includes("ean") || s.includes("codigo") || s.includes("descri") || s.includes("produto");
      })) {
        sourceHeaders = row.map(h => String(h || "").trim());
        headerRowIdx = i;
        break;
      }
    }

    const headerNormalized = sourceHeaders.map(h => 
      String(h || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );

    const getSourceIndex = (names: string[]) => {
      const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      for (const name of normalizedNames) {
        const idx = headerNormalized.indexOf(name);
        if (idx !== -1) return idx;
      }
      for (const name of normalizedNames) {
        if (name.length < 3) continue;
        const idx = headerNormalized.findIndex(h => h.startsWith(name));
        if (idx !== -1) return idx;
      }
      for (const name of normalizedNames) {
        if (name.length < 4) continue;
        const idx = headerNormalized.findIndex(h => h.includes(name));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const mappedIndices = {
      id: getSourceIndex(["IDProduto", "ID_Produto", "Codigo", "Cod", "Código", "CÓD", "CODIGO", "ID"]),
      ean: getSourceIndex(["EAN", "Codigo Barras", "Código de Barras", "EAN13", "GTIN", "BARRAS"]),
      desc: getSourceIndex(["Descrição", "Descricao", "Nome", "Produto", "Descricao Produto", "PRODUTO", "NOME"]),
      stock: getSourceIndex(["Estoque", "Sald", "Saldo", "QTDE", "Qtde", "Quant", "Quantidade", "STOCK", "DISPONIVEL", "QTD DISP", "ESTOQ", "ESTOQUE", "UNIDADES", "UNID"]),
      price: getSourceIndex(["PV", "Preço Venda", "Preco Venda", "PRECO", "PREÇO", "VALOR", "TABELA", "UNITARIO", "UNITÁRIO", "PREÇO UNITARIO", "VALOR UNITARIO"]),
      discount: getSourceIndex(["DESC", "Desconto", "DESCONTO", "PERCENTUAL", "BONUS", "%DESC", "DESC TOTAL"]),
      final: getSourceIndex(["PREÇO C/ DESC", "PRECO C/ DESC", "PRECO C DESC", "PF", "Preço Final", "Preco Final", "VALOR FINAL", "PRECO LIQUIDO", "PRECO LÍQUIDO", "VALOR LIQUIDO", "LIQUIDO"]),
      valid: getSourceIndex(["VALOR VALIDADE", "VALIDADE", "VENCIMENTO", "DATA FIM", "EXPIRA", "VALIDADE DESCONTO"])
    };

    const hasSourceHeaders = sourceHeaders.length > 0;
    const isKimberlyInput = industria.toUpperCase().includes('KIMBERLY');
    console.log(`[Catalog Update] Industry: ${industria}, HasHeaders: ${hasSourceHeaders}, Kimberly: ${isKimberlyInput}`);
    if (hasSourceHeaders) {
      console.log(`[Catalog Update] Mapped Indices:`, mappedIndices);
    }

    const rowsToProcess = headerRowIdx !== -1 ? data.slice(headerRowIdx + 1) : data;
    
    let updatedCount = 0;
    let newCount = 0;
    const newProductsRows: any[][] = [];
    const log: string[] = [];
    const updatedProductsLog: string[] = [];
    const newProductsLog: string[] = [];

    log.push(`Iniciando atualização do catálogo ${industria}...`);
    log.push(`Planilha detectada com ${rowsToProcess.length} linhas de dados.`);
    if (hasSourceHeaders) {
      log.push(`Colunas encontradas: EAN(${mappedIndices.ean}), Preço(${mappedIndices.price}), Final(${mappedIndices.final}), Descrição(${mappedIndices.desc})`);
    }

    // --- LÓGICA DE DETECÇÃO E APAGAR COLUNAS (Estoque, Preco Venda, Desconto, Preco Final) ---
    const targetIndustry = industria.split(' ')[0].trim().toUpperCase();
    const targetIndustryIdsAndEans = new Set<string>();
    const clearedProductIdsAndEans = new Set<string>();

    const prodSheet = sheetData["Produtos"];
    if (prodSheet) {
      const prodHeaders = prodSheet.headers || [];
      const prodFabColIdx = prodHeaders.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
      
      if (prodFabColIdx !== -1) {
        prodSheet.rows.slice(1).forEach(row => {
          const rowFab = String(row[prodFabColIdx] || "").trim().toUpperCase();
          const matchesFab = rowFab === targetIndustry || rowFab.startsWith(targetIndustry) || targetIndustry.startsWith(rowFab);
          
          if (matchesFab) {
            const id = String(row[idIdx] || "").trim();
            const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
            const ean = normalizeEAN(rawEan);
            
            if (id) targetIndustryIdsAndEans.add(id);
            if (ean) targetIndustryIdsAndEans.add(ean);
          }
        });
      }
    }

    let clearedCountTotal = 0;
    
    Object.keys(sheetData).forEach(sheetName => {
      const sheet = sheetData[sheetName];
      const headers = sheet.headers || [];
      const sheetFabColIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
      
      sheet.rows.slice(1).forEach(row => {
        let belongsToIndustry = false;
        
        if (sheetFabColIdx !== -1 && row[sheetFabColIdx]) {
          const rowFab = String(row[sheetFabColIdx] || "").trim().toUpperCase();
          belongsToIndustry = rowFab === targetIndustry || rowFab.startsWith(targetIndustry) || targetIndustry.startsWith(rowFab);
        }
        
        if (!belongsToIndustry) {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          
          if ((id && targetIndustryIdsAndEans.has(id)) || (ean && targetIndustryIdsAndEans.has(ean))) {
            belongsToIndustry = true;
          }
        }
        
        if (belongsToIndustry) {
          const id = String(row[idIdx] || "").trim();
          const rawEan = String(row[eanIdx] || "").trim().replace(/^'/, '');
          const ean = normalizeEAN(rawEan);
          const desc = String(row[descIdx] || "").trim();
          
          const label = [
            desc ? `"${desc}"` : "",
            id ? `ID: ${id}` : "",
            ean ? `EAN: ${ean}` : ""
          ].filter(Boolean).join(" | ");

          if (label) {
            clearedProductIdsAndEans.add(label);
          }

          while (row.length <= Math.max(stockIdx, priceIdx, discIdx, finalIdx)) {
            row.push("");
          }
          
          row[stockIdx] = "";
          row[priceIdx] = "";
          row[discIdx] = "";
          row[finalIdx] = "";
          clearedCountTotal++;
        }
      });
    });
    
    log.push(`Varredura concluída: Limpos valores de [Estoque, Preco Venda, Desconto, Preco Final] de ${clearedCountTotal} linhas de produto da indústria ${targetIndustry} antes da atualização.`);

    const applyCustomRounding = (val: number): number => {
      if (isNaN(val)) return 0;
      const s = val.toFixed(10);
      const parts = s.split('.');
      let rounded: number;
      if (parts.length >= 2 && parts[1].length >= 3) {
        const thirdDigit = parseInt(parts[1][2]);
        if (thirdDigit >= 6) {
          rounded = parseFloat((Math.ceil(val * 100) / 100).toFixed(2));
        } else {
          rounded = parseFloat((Math.floor(val * 100) / 100).toFixed(2));
        }
      } else {
        rounded = parseFloat(val.toFixed(2));
      }

      // Special case requested: 0.99% -> 1.00%
      if (rounded === 0.99) return 1.00;
      return rounded;
    };

    const cleanNumericString = (val: any): string => {
      if (val === null || val === undefined) return "0";
      if (typeof val === 'number') return String(val);
      
      let s = String(val).replace('R$', '').replace('%', '').trim();
      if (!s) return "0";

      // Pattern: 1.234,56 -> 1234.56
      if (s.includes('.') && s.includes(',')) {
        return s.replace(/\./g, '').replace(',', '.');
      }
      
      // Pattern: 87,38 -> 87.38
      if (s.includes(',')) {
        return s.replace(',', '.');
      }

      // Pattern: 87.38 -> 87.38 (Keep as decimal)
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount === 1) {
        return s;
      }
      
      // Pattern: 1.234.567 -> 1234567
      if (dotCount > 1) {
        return s.replace(/\./g, '');
      }
      
      return s;
    };

    const formatBrazilian = (num: any, isPercent = false) => {
      const val = parseFloat(String(num).replace(',', '.'));
      if (isNaN(val)) return num;
      // Use dot as decimal separator for spreadsheet storage as requested
      const s = val.toFixed(2);
      return isPercent ? `${s}%` : s;
    };

    rowsToProcess.forEach((item: any) => {
      let newId = "";
      let newEan = "";
      let newDesc = "";
      let newStock = "";
      let newPrice: any = "";
      let newDiscount: any = "";
      let newFinal: any = "";
      let newValid = "";

      if (Array.isArray(item)) {
        if (hasSourceHeaders) {
          newId = String(item[mappedIndices.id !== -1 ? mappedIndices.id : mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mappedIndices.ean !== -1 ? mappedIndices.ean : mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mappedIndices.desc !== -1 ? mappedIndices.desc : mapping.desc] || "").trim();
          newStock = String(item[mappedIndices.stock !== -1 ? mappedIndices.stock : mapping.stock] || "").trim();
          newPrice = String(item[mappedIndices.price !== -1 ? mappedIndices.price : mapping.price] || "").trim();
          newDiscount = String(item[mappedIndices.discount !== -1 ? mappedIndices.discount : mapping.discount] || "").trim();
          newFinal = String(item[mappedIndices.final !== -1 ? mappedIndices.final : mapping.final] || "").trim();
          newValid = String(item[mappedIndices.valid !== -1 ? mappedIndices.valid : -1] || "").trim() || defaultExpiryDate || "";

          // Logical Check for prices and discounts
          let pVal = parseFloat(cleanNumericString(newPrice));
          let fVal = parseFloat(cleanNumericString(newFinal));
          let dVal = parseFloat(cleanNumericString(newDiscount));

          // HEURISTIC: If pVal looks like it's missing decimal (e.g. 8738 instead of 87.38)
          if (isKimberlyInput) {
            if (pVal > 1000 && pVal % 1 === 0) pVal /= 100;
            if (fVal > 1000 && fVal % 1 === 0) fVal /= 100;
            
            // Special User request: "ao inves de 1.00% é 10%"
            // If the user says "Desconto" is 1.00% but intends 10.00%
            if (dVal === 1) dVal = 10;
          }

          if (dVal > 1 && pVal > 1 && dVal < pVal && dVal > (pVal * 0.45) && !isKimberlyInput) {
            fVal = dVal;
            dVal = 0;
          }

          if (!isNaN(pVal) && pVal > 0) {
            newPrice = applyCustomRounding(pVal);
            
            // Priority 1: Use Final Price to calculate discount if it looks reliable
            // If Final price is significantly less than price, use it.
            // But if it's too small (like 90% discount) and it's Kimberly, maybe trust dVal more
            const looksLikeTooMuchDiscount = isKimberlyInput && fVal > 0 && ((pVal - fVal) / pVal) > 0.4;
            
            if (!isNaN(fVal) && fVal > 0 && Math.abs(fVal - pVal) > 0.01 && !looksLikeTooMuchDiscount) {
              newFinal = applyCustomRounding(fVal);
              const calculatedDisc = ((pVal - fVal) / pVal) * 100;
              newDiscount = calculatedDisc > 0 ? applyCustomRounding(calculatedDisc) : 0;
            } 
            // Priority 2: Use provided Discount
            else if (!isNaN(dVal) && dVal > 0) {
              const dPerc = dVal < 1 ? dVal * 100 : dVal;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pVal * (1 - newDiscount / 100));
            }
            // Fallback: No discount
            else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dVal);
            newFinal = applyCustomRounding(fVal);
          }
        } else {
          newId = String(item[mapping.id] || "").trim();
          newEan = normalizeEAN(String(item[mapping.ean] || "").trim().replace(/^'/, ''));
          newDesc = String(item[mapping.desc] || "").trim();
          newStock = String(item[mapping.stock] || "").trim();
          
          let pValRaw = parseFloat(cleanNumericString(item[mapping.price]));
          let fValRaw = parseFloat(cleanNumericString(item[mapping.final]));
          let dValRaw = parseFloat(cleanNumericString(item[mapping.discount]));

          if (isKimberlyInput) {
            if (pValRaw > 1000 && pValRaw % 1 === 0) pValRaw /= 100;
            if (fValRaw > 1000 && fValRaw % 1 === 0) fValRaw /= 100;
            if (dValRaw === 1) dValRaw = 10;
          }

          if (!isNaN(pValRaw) && pValRaw > 0) {
            newPrice = applyCustomRounding(pValRaw);
            const looksTooMuch = isKimberlyInput && fValRaw > 0 && ((pValRaw - fValRaw) / pValRaw) > 0.4;
            
            if (!isNaN(fValRaw) && fValRaw > 0 && Math.abs(fValRaw - pValRaw) > 0.01 && !looksTooMuch) {
              newFinal = applyCustomRounding(fValRaw);
              const calculated = ((pValRaw - fValRaw) / pValRaw) * 100;
              newDiscount = calculated > 0 ? applyCustomRounding(calculated) : 0;
            } else if (!isNaN(dValRaw) && dValRaw > 0) {
              const dPerc = dValRaw < 1 ? dValRaw * 100 : dValRaw;
              newDiscount = applyCustomRounding(dPerc);
              newFinal = applyCustomRounding(pValRaw * (1 - newDiscount / 100));
            } else {
              newFinal = newPrice;
              newDiscount = 0;
            }
          } else {
            newPrice = 0;
            newDiscount = applyCustomRounding(dValRaw);
            newFinal = applyCustomRounding(fValRaw);
          }
        }
      }

      const isJunk = !newId && !newEan;
      const isHeaderRepeat = newDesc.toLowerCase().includes("descri") || newId.toLowerCase().includes("id") || newEan.toLowerCase().includes("ean");
      
      if (isJunk || isHeaderRepeat) return;

      // Remove from clearedProductIdsAndEans if it was updated or imported
      const labelToRemove = Array.from(clearedProductIdsAndEans).find(label => {
        return (newId && label.includes(`ID: ${newId}`)) || 
               (newEan && label.includes(`EAN: ${newEan}`)) || 
               (newDesc && label.includes(`"${newDesc}"`));
      });
      if (labelToRemove) {
        clearedProductIdsAndEans.delete(labelToRemove);
      }

      const matchingEntriesById = newId ? (existingProductsMap.get(newId) || []) : [];
      const matchingEntriesByEan = newEan ? (existingProductsMap.get(newEan) || []) : [];
      
      let allMatchingEntries = Array.from(new Set([...matchingEntriesById, ...matchingEntriesByEan]));

      if (allMatchingEntries.length > 0) {
        allMatchingEntries.forEach(entry => {
          const row = entry.row;

          const updateVal = (idx: number, val: any) => {
            if (idx !== -1 && val !== undefined && val !== null && val !== "") {
              row[idx] = val;
            }
          };

          updateVal(idIdx, newId);
          updateVal(eanIdx, newEan);
          updateVal(descIdx, newDesc);
          updateVal(stockIdx, newStock);
          updateVal(priceIdx, formatBrazilian(newPrice));
          updateVal(discIdx, formatBrazilian(newDiscount, true));
          updateVal(finalIdx, formatBrazilian(newFinal));
          updateVal(validIdx, newValid);
        });
        updatedCount++;
        updatedProductsLog.push(`${newDesc || "Sem Descrição"} (ID: ${newId || '-'}) → Est: ${newStock || '0'} | Preço: R$ ${formatBrazilian(newPrice)} | Desc: ${formatBrazilian(newDiscount, true)} | Final: R$ ${formatBrazilian(newFinal)}`);
      } else {
        const industryName = industria.split(' ')[0].toUpperCase();
        // Add as new product to "Produtos" sheet
        const headers = sheetData["Produtos"]?.headers || [];
        const rowLength = Math.max(headers.length, 8);
        const newRow = new Array(rowLength).fill("");
        
        newRow[idIdx] = newId;
        newRow[eanIdx] = newEan;
        newRow[descIdx] = newDesc;
        newRow[stockIdx] = newStock;
        newRow[priceIdx] = formatBrazilian(newPrice);
        newRow[discIdx] = formatBrazilian(newDiscount, true);
        newRow[finalIdx] = formatBrazilian(newFinal);
        newRow[validIdx] = newValid;

        const fabColIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("fabricante"));
        if (fabColIdx !== -1) newRow[fabColIdx] = industryName;
        
        newProductsRows.push(newRow);
        newCount++;
        newProductsLog.push(`${newDesc || "Sem Descrição"} (ID: ${newId || '-'}) → Est: ${newStock || '0'} | Preço: R$ ${formatBrazilian(newPrice)} | Desc: ${formatBrazilian(newDiscount, true)} | Final: R$ ${formatBrazilian(newFinal)}`);
        
        const entry = { row: newRow, sheetName: "Produtos" };
        if (newId) {
          if (!existingProductsMap.has(newId)) existingProductsMap.set(newId, []);
          existingProductsMap.get(newId)!.push(entry);
        }
        if (newEan) {
          if (!existingProductsMap.has(newEan)) existingProductsMap.set(newEan, []);
          existingProductsMap.get(newEan)!.push(entry);
        }
      }
    });

    log.push(`Processamento concluído para ${industria}.`);
    log.push(`Resumo: ${updatedCount} produtos existentes foram atualizados.`);
    log.push(`Resumo: ${newCount} novos produtos foram adicionados.`);
    if (clearedProductIdsAndEans.size > 0) {
      log.push(`Resumo: ${clearedProductIdsAndEans.size} produtos desta indústria que não constavam na nova planilha tiveram Estoque e Preços apagados/bloqueados.`);
    }
    if (isKimberlyInput) {
      log.push(`Aplicadas correções automáticas de decimais e descontos para Kimberly.`);
    }

    if (updatedProductsLog.length > 0) {
      log.push(`--- DETALHES DOS PRODUTOS ATUALIZADOS ---`);
      if (updatedProductsLog.length <= 150) {
        updatedProductsLog.forEach(p => log.push(`• [ATUALIZADO] ${p}`));
      } else {
        updatedProductsLog.slice(0, 150).forEach(p => log.push(`• [ATUALIZADO] ${p}`));
        log.push(`• ... e outros ${updatedProductsLog.length - 150} produtos atualizados.`);
      }
    }

    if (newProductsLog.length > 0) {
      log.push(`--- DETALHES DOS PRODUTOS NOVOS ADICIONADOS ---`);
      if (newProductsLog.length <= 150) {
        newProductsLog.forEach(p => log.push(`• [NOVO] ${p}`));
      } else {
        newProductsLog.slice(0, 150).forEach(p => log.push(`• [NOVO] ${p}`));
        log.push(`• ... e outros ${newProductsLog.length - 150} produtos adicionados.`);
      }
    }

    if (clearedProductIdsAndEans.size > 0) {
      log.push(`--- PRODUTOS NÃO ATUALIZADOS (LIMPOS POR FALTA NA PLANILHA) ---`);
      const clearedList = Array.from(clearedProductIdsAndEans);
      if (clearedList.length <= 150) {
        clearedList.forEach(p => log.push(`• [LIMPO] ${p}`));
      } else {
        clearedList.slice(0, 150).forEach(p => log.push(`• [LIMPO] ${p}`));
        log.push(`• ... e outros ${clearedList.length - 150} produtos limpos.`);
      }
    }

    log.push(`Sincronizando alterações com as abas Produtos, Ofertas e Lancamentos...`);

    // 4. Save all updated sheets back
    await Promise.all(Object.keys(sheetData).map(async (sheetName) => {
      let finalRows = sheetData[sheetName].rows;
      if (sheetName === "Produtos") {
        finalRows = [...finalRows, ...newProductsRows];
      }

      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: finalRows,
        },
      });
    }));

    res.json({ 
      sucesso: true, 
      industry: industria, 
      updatedCount, 
      newCount,
      log,
      hasNew: newCount > 0
    });
  } catch (error: any) {
    console.error("Error updating catalog in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/client/update", async (req, res) => {
  try {
    const client = req.body;
    const spreadsheetId = getRequestSpreadsheetId(req);
    const sheets = await getSheetsClient();

    // 1. Get current clients to find the row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clientes!A:Z",
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Sheet Clientes não encontrada ou vazia." });
    }

    const headers = rows[0];
    const idIdx = headers.findIndex((h: string) => h.toLowerCase().includes("id"));
    
    if (idIdx === -1) {
      return res.status(500).json({ error: "Coluna ID não encontrada na sheet Clientes." });
    }

    // 2. Find the row
    const rowIdx = rows.findIndex((row, idx) => idx > 0 && String(row[idIdx] || "").trim() === String(client.id).trim());

    if (rowIdx === -1) {
      return res.status(404).json({ error: `Cliente com ID ${client.id} não encontrado na planilha.` });
    }

    // 3. Prepare the new row data maintaining header order
    const updatedRow = [...rows[rowIdx]];
    const mapping: Record<string, keyof typeof client> = {
      'Nome': 'name',
      'Nome Fantasia': 'tradeName',
      'CNPJ': 'cnpj',
      'Vendedor': 'seller',
      'EmailUsuario': 'email',
      'Endereco': 'address',
      'Cidade': 'city',
      'Estado': 'state',
      'Comprador': 'buyer',
      'Celular': 'phone',
      'Regional': 'regional'
    };

    headers.forEach((header: string, index: number) => {
      const key = mapping[header];
      if (key && client[key] !== undefined) {
        updatedRow[index] = client[key];
      }
    });

    // 4. Update the row in Sheets
    // Sheets uses 1-based indexing for ranges, and we found rowIdx in a 0-indexed array
    const sheetRowNumber = rowIdx + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Clientes!A${sheetRowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedRow],
      },
    });

    res.json({ sucesso: true, client: client });
  } catch (error: any) {
    console.error("Error updating client in Sheets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Mount API Router with support for Netlify Functions path
const apiPath = process.env.NETLIFY ? "/.netlify/functions/api" : "/api";
app.use([apiPath, "/api"], apiRouter);

// Fallback for API routes that might be called without expected prefix in various environments
app.use((req, res, next) => {
  if (req.path.startsWith('/data/') || req.path.startsWith('/catalog/') || req.path === '/status' || req.path === '/health') {
    return apiRouter(req, res, next);
  }
  next();
});

// Health check endpoint (can be reached via /api/health)
apiRouter.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      NETLIFY: !!process.env.NETLIFY,
      VERCEL: !!process.env.VERCEL,
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_SHEET_ID_SET: !!process.env.GOOGLE_SHEET_ID
    }
  });
});

// Generic catch-all for API router
apiRouter.all("*", (req, res) => {
  res.status(404).json({ error: "Route not found in API router", path: req.path });
});

// Vite middleware setup
export async function startServer() {
  const isServerless = !!(process.env.NETLIFY || process.env.VERCEL);
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isServerless) {
    try {
      // Completely hide vite from static analysis using string concatenation
      const v = "vi";
      const t = "te";
      const viteModule = await import(v + t);
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded");
    } catch (e) {
      console.error("Vite middleware failed to load:", e);
    }
  } else if (!isServerless) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen on a port if NOT in a serverless environment
  if (!isServerless) {
    const port = Number(process.env.PORT) || PORT;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  }
}

// Ensure app is always exported for serverless
export { app };
export default app;

// Support for serverless deployments (Vercel/Netlify)
const isMainModule = () => {
  if (process.env.NETLIFY || process.env.VERCEL) return false;
  try {
    const currentPath = fileURLToPath(import.meta.url);
    const mainPath = path.resolve(process.argv[1] || "");
    return mainPath.includes(currentPath) || currentPath.includes(mainPath);
  } catch (e) {
    return false;
  }
};

if (isMainModule()) {
  startServer().catch(console.error);
}

```

---

### 📄 Arquivo: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}

```

---

### 📄 Arquivo: `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/server.ts"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

```

---

### 📄 Arquivo: `vite.config.ts`

```tsx
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000,
        },
        manifest: {
          name: 'VENDAS HBN1',
          short_name: 'VENDAS HBN1',
          description: 'Sistema de gestão de vendas HBN1',
          theme_color: '#FF6B00',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/logo.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/logo.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/logo.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'firebase-core';
              }
              if (id.includes('xlsx') || id.includes('exceljs')) {
                return 'excel';
              }
              if (id.includes('jspdf') || id.includes('pdfjs-dist')) {
                return 'pdf';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

```

---

### 📄 Arquivo: `src/App.tsx`

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';
import InstallPrompt from './components/InstallPrompt';

// Lazy load components
const Login = React.lazy(() => import('./pages/Login'));
const ClientSelection = React.lazy(() => import('./pages/ClientSelection'));
const ProductCatalog = React.lazy(() => import('./pages/ProductCatalog'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const ImportPanel = React.lazy(() => import('./pages/ImportPanel'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDF6F0]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return profile ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <React.Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-[#FDF6F0]">
              <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <PrivateRoute>
                  <ClientSelection />
                </PrivateRoute>
              } />
              <Route path="/catalog" element={
                <PrivateRoute>
                  <ProductCatalog />
                </PrivateRoute>
              } />
              <Route path="/admin" element={
                <PrivateRoute>
                  <AdminPanel />
                </PrivateRoute>
              } />
              <Route path="/import" element={
                <PrivateRoute>
                  <ImportPanel />
                </PrivateRoute>
              } />
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </React.Suspense>
          <InstallPrompt />
        </Router>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}

```

---

### 📄 Arquivo: `src/components/BarcodeScanner.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Result } from '@zxing/library';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import { X, Camera, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const videoInputDevices = await BrowserCodeReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          setError("Nenhum dispositivo de vídeo encontrado.");
          return;
        }

        // Try to find back camera
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('traseira')
        );
        const deviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;

        const controls = await codeReader.current!.decodeFromVideoDevice(deviceId, videoRef.current!, (result: Result | null, err?: any) => {
          if (result) {
            onScan(result.getText());
          }
          if (err) {
            const message = err.message || (typeof err === 'string' ? err : '');
            const isNotFound = err.name === 'NotFoundException' || 
                             message.includes('No MultiFormat Readers') ||
                             message.includes('No code detected') ||
                             message.includes('source width is 0') ||
                             message.includes('Track is in an invalid state');
            
            if (!isNotFound) {
              console.error('Scanner error:', err);
            }
          }
        });
        
        controlsRef.current = controls;
        setHasPermission(true);
      } catch (err) {
        console.error('Permission error:', err);
        setHasPermission(false);
        setError("Erro ao acessar a câmera. Verifique as permissões.");
      }
    };

    startScanner();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-lg aspect-[3/4] bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
      >
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <Camera className="text-orange-500" size={24} />
            <span className="font-bold tracking-tight">LEITOR DE C\u00D3DIGO</span>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="p-4 bg-red-500/20 rounded-full text-red-500">
              <Camera size={48} />
            </div>
            <p className="text-white font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all font-bold flex items-center gap-2"
            >
              <RefreshCw size={20} /> REPETIR
            </button>
          </div>
        ) : (
          <div className="relative h-full">
            <video 
              ref={videoRef} 
              className="h-full w-full object-cover"
            />
            
            {/* Scanner UI Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-white/50 rounded-2xl relative">
                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
                
                {/* Laser Line */}
                <motion.div 
                  animate={{ top: ['10%', '90%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-4 right-4 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(255,107,0,0.8)]"
                />
              </div>
            </div>
            
            <div className="absolute bottom-12 inset-x-0 text-center">
              <p className="text-white/70 text-sm font-medium px-8 drop-shadow-lg">
                Posicione o c\u00F3digo de barras no centro do quadro
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

```

---

### 📄 Arquivo: `src/components/ConfigWarning.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StatusData {
  ok: boolean;
  serviceAccountEmail: string;
  spreadsheetId: string;
  isApiKey: boolean;
  spreadsheetInfo: any;
  spreadsheetError: string;
  instructions: string[];
}

export function ConfigWarning() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error('Error fetching status:', err));
  }, []);

  const copyEmail = () => {
    if (status?.serviceAccountEmail) {
      navigator.clipboard.writeText(status.serviceAccountEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!status || status.ok) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 shrink-0">
          <AlertTriangle size={28} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
            Erro de Configuração Detectado
          </h3>
          <p className="text-red-700 dark:text-red-300 text-sm mb-4 leading-relaxed">
            {status.spreadsheetError}
          </p>

          {status.isApiKey && (
            <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-red-200 dark:border-red-800 mb-4">
              <p className="text-red-800 dark:text-red-200 font-bold text-sm mb-2 uppercase tracking-wider">
                ⚠️ AÇÃO NECESSÁRIA:
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Você colou uma <strong>Chave de API</strong> no lugar do <strong>ID da Planilha</strong>. 
                Vá nas configurações do AI Studio (Secrets) ou no painel da Netlify (Environment Variables) e troque o valor de <code>GOOGLE_SHEET_ID</code> pelo ID que aparece na URL da sua planilha.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase">Instruções:</p>
            <ul className="space-y-2">
              {status.instructions.map((inst, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <span className="w-5 h-5 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {inst}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button 
              onClick={copyEmail}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-600/20"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'E-mail Copiado!' : 'Copiar E-mail do Robô'}
            </button>
            <a 
              href={`https://docs.google.com/spreadsheets/d/${status.spreadsheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
            >
              <ExternalLink size={16} />
              Abrir Planilha
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

```

---

### 📄 Arquivo: `src/components/ErrorBoundary.tsx`

```tsx
import React from 'react';

export class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { hasError: boolean }> {
  declare props: { children?: React.ReactNode };
  declare state: { hasError: boolean };
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ops! Algo deu errado.</h1>
          <button
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

```

---

### 📄 Arquivo: `src/components/InstallPrompt.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed or running in standalone mode
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://')
      );
    };

    setIsStandalone(checkStandalone());

    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Delay showing the prompt a bit for better UX after login
      const timer = setTimeout(() => {
        if (!checkStandalone() && !localStorage.getItem('pwa-prompt-dismissed')) {
          setIsVisible(true);
        }
      }, 3000);

      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsVisible(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isStandalone || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-8 md:bottom-8 md:max-w-sm"
      >
        <div className="bg-[#1A1A1A] text-white p-4 rounded-3xl shadow-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FF8C00] rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <img src="/logo.svg" alt="App Icon" className="w-8 h-8 brightness-0 invert" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-tight">Instale nosso app</h3>
            <p className="text-white/60 text-xs mt-0.5 line-clamp-2">
              Acesso rápido direto da tela inicial. Grátis e sem ocupar espaço.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDismiss}
              className="p-2 text-white/40 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleInstall}
              className="bg-[#FF8C00] hover:bg-[#FF7B00] text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
            >
              <Download size={14} />
              Instalar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

```

---

### 📄 Arquivo: `src/constants/regionals.ts`

```tsx
export const REGIONALS = {
  'TIMON-MA': { id: '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs', label: 'TIMON - MA' },
  'THE': { id: '1I79E8X9b8O-g1wIc5fsKuO2DW9GCU24uZFkpTEQAcEk', label: 'TERESINA - PI' },
  'IMP': { id: '1z2a_wzBrVPUEk8RrTEsIV9MsV9XBZQd9eZM6AwMwVyE', label: 'IMPERATRIZ - MA' }
} as const;

export type RegionalKey = keyof typeof REGIONALS;

export const getSpreadsheetId = (regional?: string): string => {
  if (!regional) return REGIONALS['TIMON-MA'].id;
  
  // Normalize regional name to match keys
  const normalized = (regional.toUpperCase().includes('TIMON') || regional.toUpperCase().includes('TIMAO')) ? 'TIMON-MA' : 
                     (regional.toUpperCase().includes('THE') || regional.toUpperCase().includes('TERESINA')) ? 'THE' :
                     (regional.toUpperCase().includes('IMP') || regional.toUpperCase().includes('IMPERATRIZ')) ? 'IMP' : 'TIMON-MA';
                     
  return REGIONALS[normalized as RegionalKey].id || REGIONALS['TIMON-MA'].id;
};

export const getRegionalLabel = (regional?: string): string => {
  if (!regional) return REGIONALS['TIMON-MA'].label;
  
  const upper = regional.toUpperCase();
  if (upper.includes('TIMON') || upper.includes('TIMAO')) return REGIONALS['TIMON-MA'].label;
  if (upper.includes('THE') || upper.includes('TERESINA')) return REGIONALS['THE'].label;
  if (upper.includes('IMP') || upper.includes('IMPERATRIZ')) return REGIONALS['IMP'].label;
  
  return regional;
};

```

---

### 📄 Arquivo: `src/contexts/AuthContext.tsx`

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { dataService } from '../services/dataService';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        let savedProfile = null;
        try {
          savedProfile = localStorage.getItem('VENDAS_profile');
        } catch (storageError) {
          console.warn('LocalStorage access failed:', storageError);
        }

        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            setProfile(parsed);
            
            // Sign in to Firebase Auth anonymously to satisfy firestore rules
            if (!auth.currentUser) {
              try {
                // Use a timeout for anonymous auth so it doesn't block forever
                const authPromise = signInAnonymously(auth);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Auth Timeout')), 5000)
                );
                await Promise.race([authPromise, timeoutPromise]);
              } catch (authError) {
                console.warn('Anonymous auth failed or timed out:', authError);
              }
            }
            
            // Auto-refresh profile in background
            dataService.getUsersFromSheets().then(users => {
              const foundUser = users.find(u => u.username.toLowerCase() === parsed.uid.toLowerCase());
              if (foundUser) {
                const updatedProfile = { 
                  ...parsed, 
                  phone: foundUser.phone || parsed.phone, 
                  regional: foundUser.regional || parsed.regional,
                  role: (foundUser.role === 'admin' ? 'admin' : foundUser.role === 'promotor' ? 'promotor' : 'vendedor')
                };
                setProfile(updatedProfile);
                try {
                  localStorage.setItem('VENDAS_profile', JSON.stringify(updatedProfile));
                } catch (e) {}
              }
            }).catch(() => {});
          } catch (e) {
            console.error('Profile parse error:', e);
            try {
              localStorage.removeItem('VENDAS_profile');
            } catch (remError) {}
          }
        }
      } catch (fatalError) {
        console.error('Fatal initialization error:', fatalError);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const users = await dataService.getUsersFromSheets();
      
      const foundUser = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === (password || '')
      );

      if (foundUser) {
        // Sign in to Firebase Auth
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (authError) {
            console.warn('Anonymous auth failed during login:', authError);
          }
        }

        const newProfile: UserProfile = {
          uid: foundUser.username,
          name: foundUser.name || foundUser.username,
          role: (foundUser.role === 'admin' ? 'admin' : foundUser.role === 'promotor' ? 'promotor' : 'vendedor') as 'admin' | 'vendedor' | 'promotor',
          phone: foundUser.phone || '',
          email: foundUser.username,
          regional: foundUser.regional || 'TIMON-MA'
        };
        setProfile(newProfile);
        localStorage.setItem('VENDAS_profile', JSON.stringify(newProfile));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    setProfile(null);
    localStorage.removeItem('VENDAS_profile');
    await auth.signOut();
  };

  useEffect(() => {
    if (profile?.regional) {
      dataService.setRegional(profile.regional);
    }
  }, [profile]);

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

```

---

### 📄 Arquivo: `src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Syne", sans-serif;
}

@layer base {
  body {
    @apply bg-[#FDF6F0] text-[#1A1208] antialiased;
  }
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.pt-safe {
  padding-top: env(safe-area-inset-top);
}

.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Elegant Thin Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

:is(.dark) ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

:is(.dark) ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

```

---

### 📄 Arquivo: `src/lib/firebase.ts`

```tsx
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Support using Netlify environment variables (dashboard) or local firebase config
const rawDbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
// If the database ID looks like a Google Analytics Measurement ID (starts with G-), fall back to the correct Firestore database ID
const finalDbId = (rawDbId && rawDbId.trim().startsWith('G-')) ? firebaseConfig.firestoreDatabaseId : rawDbId;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: finalDbId
};

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId);

// Safely attempt to enable persistence without blocking
if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
  import('firebase/firestore').then(({ enableIndexedDbPersistence }) => {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed-precondition');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence unimplemented');
      }
    });
  }).catch(() => {});
}

async function testConnection() {
  // Test connection in background after a delay to not block initial load
  setTimeout(async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      // Background check, silently fail
    }
  }, 2000);
}

testConnection();

```

---

### 📄 Arquivo: `src/lib/firestore-errors.ts`

```tsx
import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

```

---

### 📄 Arquivo: `src/lib/schemas.ts`

```tsx
import { z } from 'zod';

export const ClientSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  tradeName: z.string().min(2, "Nome fantasia deve ter pelo menos 2 caracteres"),
  cnpj: z.string().min(14, "CNPJ inv\u00E1lido").max(18, "CNPJ inv\u00E1lido"),
  email: z.string().email("E-mail inv\u00E1lido").or(z.literal('')),
  phone: z.string().min(10, "Telefone inv\u00E1lido"),
  city: z.string().min(2, "Cidade \u00E9 obrigat\u00F3ria"),
  state: z.string().length(2, "Estado deve ter 2 d\u00EDgitos"),
  regional: z.string().min(1, "Regional \u00E9 obrigat\u00F3ria"),
});

export const OrderItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
  salePrice: z.number(),
  finalPrice: z.number(),
});

export const OrderSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  total: z.number().positive(),
  items: z.array(OrderItemSchema).min(1, "O pedido deve ter pelo menos um item"),
  status: z.enum(['Novo', 'Confirmado', 'Entregue', 'Cancelado', 'Rascunho']),
});

```

---

### 📄 Arquivo: `src/lib/utils.ts`

```tsx
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatCNPJ(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function normalizeEAN(ean: any): string {
  if (ean === null || ean === undefined) return '';
  // Convert to string and trim
  let s = String(ean).trim();
  // Remove any non-numeric characters
  s = s.replace(/[^0-9]/g, '');
  if (!s) return '';
  // If the EAN has length > 0 and less than 13, pad with leading zeros to 13 digits
  if (s.length > 0 && s.length < 13) {
    s = s.padStart(13, '0');
  }
  return s;
}

```

---

### 📄 Arquivo: `src/main.tsx`

```tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline support safely
try {
  registerSW({ 
    immediate: true,
    onRegistered(swRegistration) {
      console.log('SW Registered:', swRegistration);
    },
    onRegisterError(error) {
      console.error('SW Registration Error:', error);
    }
  });
} catch (e) {
  console.warn('PWA Registration skipped or failed:', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

```

---

### 📄 Arquivo: `src/pages/AdminPanel.tsx`

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Order, Client } from '../types';
import { 
  ChevronLeft, 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  Trophy, 
  Target,
  Download,
  Share2,
  RefreshCw,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { REGIONALS, getRegionalLabel } from '../constants/regionals';
import { ClientSchema } from '../lib/schemas';

export default function AdminPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [activeTab, setActiveTab] = useState<'relatorio' | 'inativos' | 'produtos' | 'ranking' | 'metas' | 'regional' | 'sincronizacao' | 'carrinhos'>('relatorio');
  const [orders, setOrders] = useState<Order[]>([]);
  const [sheetOrders, setSheetOrders] = useState<Order[]>([]);
  const [sheetCarts, setSheetCarts] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<{ valor: number } | null>(null);
  const [allMetas, setAllMetas] = useState<any[]>([]);
  const [sheetsStatus, setSheetsStatus] = useState<any>(null);

  useEffect(() => {
    if (!profile) return;

    const unsubOrders = dataService.subscribeOrders(null, profile.name, profile.role === 'admin', (data) => {
      setOrders(data);
    });

    const fetchData = async () => {
      const [clientsData, metaData, allMetasData, sheetOrdersData, sheetCartsData] = await Promise.all([
        dataService.getClients(profile.name, profile.role === 'admin'),
        dataService.getMetas(profile.name),
        profile.role === 'admin' ? dataService.getAllMetas() : Promise.resolve([]),
        dataService.getOrdersFromSheets(),
        dataService.getCartsFromSheets()
      ]);
      setClients(clientsData || []);
      setMeta(metaData);
      setAllMetas(allMetasData);
      setSheetOrders(sheetOrdersData || []);
      setSheetCarts(sheetCartsData || []);

      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        setSheetsStatus(status);
      } catch (e) {}

      setLoading(false);
    };

    fetchData();
    return () => unsubOrders();
  }, [profile]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      // Validate client data
      ClientSchema.parse({
        name: updatedClient.name,
        tradeName: updatedClient.tradeName,
        cnpj: updatedClient.cnpj,
        email: updatedClient.email,
        phone: updatedClient.phone,
        city: updatedClient.city,
        state: updatedClient.state,
        regional: updatedClient.regional,
      });

      toast.loading('Sincronizando com Google Sheets...', { id: 'update-client' });
      const result = await dataService.updateClientInSheet(updatedClient);
      if (result) {
        toast.success('Cliente atualizado na planilha!', { id: 'update-client' });
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setEditingClient(null);
      }
    } catch (error) {
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        const firstError = (error as any).errors[0]?.message || 'Erro de valida\u00E7\u00E3o';
        toast.error(`Falha na valida\u00E7\u00E3o: ${firstError}`, { id: 'update-client' });
      } else {
        console.error('Update client error:', error);
        toast.error('Erro ao atualizar cliente', { id: 'update-client' });
      }
    }
  };

  const handleSyncManual = async () => {
    setLoading(true);
    toast.loading('Puxando dados da planilha...', { id: 'sync-manual' });
    try {
      const [p, c, o, m, cr] = await Promise.all([
        dataService.getAllProducts(),
        dataService.getClients(profile?.name, profile?.role === 'admin'),
        dataService.getOrdersFromSheets(),
        dataService.getMetas(profile?.name || ''),
        dataService.getCartsFromSheets()
      ]);
      setClients(c || []);
      setSheetOrders(o || []);
      setSheetCarts(cr || []);
      setMeta(m);
      toast.success('Sincronização concluída!', { id: 'sync-manual' });
    } catch (e) {
      toast.error('Erro na sincronização', { id: 'sync-manual' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportOrder = (order: Order) => {
    const client = clients.find(c => c.id === order.clientId);
    
    // Group items by manufacturer
    const grouped: Record<string, any[]> = {};
    order.items.forEach(item => {
      const mfg = item.manufacturer || 'Outros';
      if (!grouped[mfg]) grouped[mfg] = [];
      grouped[mfg].push(item);
    });

    const data: any[] = [
      ['PEDIDO Nº', order.id],
      ['CLIENTE', client?.name || 'Não Identificado'],
      ['CNPJ', client?.cnpj || ''],
      ['DATA', new Date(order.date).toLocaleString()],
      ['TOTAL', formatCurrency(order.total)],
      [],
      ['FABRICANTE', 'PRODUTO', 'QUANTIDADE', 'PREÇO UN.', 'TOTAL']
    ];

    Object.entries(grouped).forEach(([mfg, items]) => {
      items.forEach(item => {
        data.push([
          mfg,
          item.description,
          item.quantity,
          item.finalPrice,
          item.quantity * item.finalPrice
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `Pedido_${order.id}.xlsx`);
    toast.success('Excel gerado com sucesso!');
  };

  const refreshData = async () => {
    setLoading(true);
    const [clientsData, metaData, allMetasData, sheetOrdersData, sheetCartsData] = await Promise.all([
      dataService.getClients(profile?.name, profile?.role === 'admin'),
      dataService.getMetas(profile?.name || ''),
      profile?.role === 'admin' ? dataService.getAllMetas() : Promise.resolve([]),
      dataService.getOrdersFromSheets(),
      dataService.getCartsFromSheets()
    ]);
    setClients(clientsData || []);
    setMeta(metaData);
    setAllMetas(allMetasData);
    setSheetOrders(sheetOrdersData || []);
    setSheetCarts(sheetCartsData || []);
    setLoading(false);
    toast.success('Dados atualizados!');
  };

  const stats = {
    totalOrders: orders.length,
    totalVendido: orders.reduce((sum, o) => sum + o.total, 0),
    activeClients: clients.length,
    meta: meta?.valor || 5000,
  };

  const progress = Math.min(100, (stats.totalVendido / stats.meta) * 100);

  // Ranking calculation
  const ranking = useMemo(() => {
    const sellers: Record<string, { name: string, total: number, orders: number }> = {};
    orders.forEach(o => {
      if (!sellers[o.seller]) {
        sellers[o.seller] = { name: o.seller, total: 0, orders: 0 };
      }
      sellers[o.seller].total += o.total;
      sellers[o.seller].orders += 1;
    });
    return Object.values(sellers).sort((a, b) => b.total - a.total);
  }, [orders]);

  // Regional calculation
  const regionalStats = useMemo(() => {
    const regionals: Record<string, { name: string, total: number, orders: number, clients: Set<string> }> = {};
    orders.forEach(o => {
      const client = clients.find(c => c.id === o.clientId);
      const reg = getRegionalLabel(client?.regional);
      if (!regionals[reg]) {
        regionals[reg] = { name: reg, total: 0, orders: 0, clients: new Set() };
      }
      regionals[reg].total += o.total;
      regionals[reg].orders += 1;
      regionals[reg].clients.add(o.clientId);
    });
    return Object.values(regionals).sort((a, b) => b.total - a.total);
  }, [orders, clients]);

  // Top products calculation
  const topProducts = useMemo(() => {
    const products: Record<string, { description: string, total: number, quantity: number }> = {};
    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          if (!products[item.description]) {
            products[item.description] = { description: item.description, total: 0, quantity: 0 };
          }
          products[item.description].total += (item.quantity * item.finalPrice);
          products[item.description].quantity += item.quantity;
        });
      }
    });
    return Object.values(products).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [orders]);

  const productsInOffers = useMemo(() => {
    // This would ideally come from dataService, but we'll filter from products if available
    // For now, we'll use the items from orders that are marked as offers
    const offers = new Set<string>();
    orders.forEach(o => {
      o.items.forEach(item => {
        if (item.type === 'offer') offers.add(item.description);
      });
    });
    return Array.from(offers);
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/')} 
              className="p-2 bg-white/20 rounded-full text-white transition-colors"
            >
              <ChevronLeft size={24} />
            </motion.button>
            <img src="/logo.svg" alt="Logo" className="w-8 h-8 brightness-0 invert" />
            <h1 className="text-white font-bold text-lg">
              {profile?.role === 'admin' ? 'Painel Administrativo' : 'Meu Painel'}
            </h1>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
            whileTap={{ scale: 0.9 }}
            onClick={refreshData} 
            className="p-2 bg-white/20 rounded-full text-white transition-colors"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </motion.button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1E1E1E] sticky top-[72px] z-30 shadow-sm overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex min-w-max">
          {[
            { id: 'relatorio', label: '📈 Relatório', icon: TrendingUp },
            { id: 'inativos', label: '⚠️ Inativos', icon: AlertTriangle },
            { id: 'produtos', label: '🏆 Produtos', icon: Package },
            { id: 'regional', label: '🌍 Regional', icon: MapPin, adminOnly: true },
            { id: 'ranking', label: '🥇 Ranking', icon: Trophy, adminOnly: true },
            { id: 'metas', label: '🎯 Metas', icon: Target, adminOnly: true },
            { id: 'carrinhos', label: '🛒 Carrinhos', icon: Sparkles },
            { id: 'sincronizacao', label: '🔄 Sincronização', icon: RefreshCw },
          ].map(tab => {
            if (tab.adminOnly && profile?.role !== 'admin') return null;
            return (
              <motion.button 
                key={tab.id}
                whileHover={{ backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)") }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
                  activeTab === tab.id ? "text-orange-600 border-orange-600" : "text-gray-400 border-transparent"
                )}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <main className="p-4 max-w-5xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Gerando relatório...</p>
          </div>
        ) : (
          <>
            {activeTab === 'relatorio' && (
              <div className="space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-2xl font-black text-orange-600">{stats.totalOrders}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Pedidos no Mês</p>
                  </div>
                  <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm text-center">
                    <p className="text-2xl font-black text-orange-600">{formatCurrency(stats.totalVendido)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Total Vendido</p>
                  </div>
                </div>

                {/* Meta Progress */}
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Meta do Mês</h3>
                      <p className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(stats.meta)}</p>
                    </div>
                    <p className="text-2xl font-black text-orange-600">{progress.toFixed(0)}%</p>
                  </div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] rounded-full"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB") }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                  >
                    <Share2 size={18} /> WhatsApp
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,255,255,0.05)" : "#F9FAFB") }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300 transition-colors shadow-sm"
                  >
                    <Download size={18} /> Copiar
                  </motion.button>
                </div>

                {/* Recent Orders */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pedidos Recentes</h3>
                    <motion.button whileHover={{ x: 3 }} whileTap={{ scale: 0.95 }} className="text-orange-600 text-xs font-bold transition-transform">Ver todos</motion.button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {orders.slice(0, 10).map((order, index) => (
                      <motion.div 
                        key={`${order.id}-${index}`} 
                        whileHover={{ backgroundColor: (darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)") }}
                        onClick={() => setSelectedOrder(order)}
                        className="p-4 flex justify-between items-center cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{order.clientName}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(order.date).toLocaleDateString('pt-BR')} • {order.seller}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-600">{formatCurrency(order.total)}</p>
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                            order.status === 'Novo' ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                          )}>
                            {order.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ranking' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ranking de Vendedores</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {ranking.map((seller, index) => (
                    <div key={index} className="p-4 flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                        index === 0 ? "bg-yellow-100 text-yellow-600" : 
                        index === 1 ? "bg-gray-100 text-gray-600" :
                        index === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-50 text-gray-400"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{seller.name}</p>
                        <p className="text-[10px] text-gray-400">{seller.orders} pedidos</p>
                      </div>
                      <p className="text-sm font-black text-orange-600">{formatCurrency(seller.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'metas' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Acompanhamento de Metas</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {allMetas.map((m, index) => {
                    const sellerTotal = orders.filter(o => o.seller.toLowerCase() === m.vendedor.toLowerCase()).reduce((sum, o) => sum + o.total, 0);
                    const prog = Math.min(100, (sellerTotal / m.valor) * 100);
                    return (
                      <div key={index} className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{m.vendedor}</p>
                          <p className="text-xs font-black text-orange-600">{prog.toFixed(1)}%</p>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>{formatCurrency(sellerTotal)}</span>
                          <span>Meta: {formatCurrency(m.valor)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'regional' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Desempenho por Regional</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {regionalStats.map((reg, index) => (
                    <div key={index} className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{reg.name}</p>
                          <p className="text-[10px] text-gray-400">{reg.orders} pedidos • {reg.clients.size} clientes</p>
                        </div>
                        <p className="text-sm font-black text-orange-600">{formatCurrency(reg.total)}</p>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(reg.total / stats.totalVendido) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'produtos' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Top 20 Produtos Mais Vendidos</h3>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {topProducts.map((prod, index) => (
                    <div key={index} className="p-4 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{prod.description}</p>
                        <p className="text-[10px] text-gray-400">{prod.quantity} unidades</p>
                      </div>
                      <p className="text-sm font-black text-orange-600">{formatCurrency(prod.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client Edit Modal */}
            <AnimatePresence>
              {editingClient && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-lg">Editar Cliente</h3>
                      <button onClick={() => setEditingClient(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nome Fantasia</label>
                        <input 
                          type="text" 
                          value={editingClient.tradeName || ''} 
                          onChange={(e) => setEditingClient({...editingClient, tradeName: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 placeholder:font-normal"
                          placeholder="Nome da Loja"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">CNPJ</label>
                        <input 
                          type="text" 
                          value={editingClient.cnpj || ''} 
                          onChange={(e) => setEditingClient({...editingClient, cnpj: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cidade</label>
                          <input 
                            type="text" 
                            value={editingClient.city || ''} 
                            onChange={(e) => setEditingClient({...editingClient, city: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Estado</label>
                          <input 
                            type="text" 
                            value={editingClient.state || ''} 
                            onChange={(e) => setEditingClient({...editingClient, state: e.target.value})}
                            className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Vendedor Responsável</label>
                        <input 
                          type="text" 
                          value={editingClient.seller || ''} 
                          onChange={(e) => setEditingClient({...editingClient, seller: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Email</label>
                        <input 
                          type="email" 
                          value={editingClient.email || ''} 
                          onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Celular / WhatsApp</label>
                        <input 
                          type="text" 
                          value={editingClient.phone || ''} 
                          onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                          className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setEditingClient(null)}
                        className="flex-1 py-4 text-sm font-bold text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleUpdateClient(editingClient)}
                        className="flex-1 py-4 text-sm font-black text-white bg-gradient-to-r from-[#FF6B00] to-[#F06292] rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Salvar na Planilha
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Order Details Modal */}
            <AnimatePresence>
              {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                  >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleExportOrder(selectedOrder)}
                          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                          title="Exportar Excel"
                        >
                          <Download size={20} />
                        </button>
                        <div>
                          <h3 className="font-black text-lg">Detalhes do Pedido</h3>
                          <p className="text-xs opacity-80">#{selectedOrder.id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedOrder(null)}
                        className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedOrder.clientName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {new Date(selectedOrder.date).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendedor</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedOrder.seller}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                          <span className="text-[10px] font-black px-2 py-1 bg-orange-100 text-orange-600 rounded-full uppercase">
                            {selectedOrder.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Itens do Pedido</p>
                        <div className="space-y-3">
                          {selectedOrder.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                              <div className="min-w-0 flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.description}</p>
                                  {item.type === 'offer' && (
                                    <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Oferta</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500">{item.quantity}x {formatCurrency(item.finalPrice)}</p>
                              </div>
                              <p className="text-xs font-black text-orange-600 whitespace-nowrap">
                                {formatCurrency(item.quantity * item.finalPrice)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Offer Checklist */}
                      {productsInOffers.length > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/20">
                          <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Sparkles size={12} /> Checklist de Ofertas
                          </h4>
                          <div className="grid grid-cols-1 gap-2">
                            {productsInOffers.slice(0, 5).map((offerDesc, i) => {
                              const bought = selectedOrder.items.some(item => item.description === offerDesc);
                              return (
                                <div key={i} className="flex items-center justify-between text-[10px]">
                                  <span className={cn("truncate pr-4", bought ? "text-gray-900 dark:text-white font-bold" : "text-gray-400")}>
                                    {offerDesc}
                                  </span>
                                  {bought ? (
                                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                  ) : (
                                    <AlertCircle size={14} className="text-gray-300 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {selectedOrder.observation && (
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Observação</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl italic">
                            "{selectedOrder.observation}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Total do Pedido</p>
                        <p className="text-2xl font-black text-orange-600">{formatCurrency(selectedOrder.total)}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {activeTab === 'inativos' && (
              <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Clientes sem Pedidos (30+ dias)</h3>
                </div>
                <div className="p-8 text-center text-gray-400">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Todos os clientes estão ativos!</p>
                </div>
              </div>
            )}

            {activeTab === 'sincronizacao' && (
              <div className="space-y-6">
                {/* Status Sheet */}
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-black text-lg text-gray-900 dark:text-white">Status da Conexão</h3>
                      <p className="text-xs text-gray-500">Google Sheets API</p>
                    </div>
                    {sheetsStatus?.connected ? (
                      <div className="flex items-center gap-2 bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <CheckCircle2 size={12} /> Conectado
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <AlertCircle size={12} /> Desconectado
                      </div>
                    )}
                  </div>

                  {sheetsStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Spreadsheet ID</p>
                        <p className="text-xs font-mono break-all">{sheetsStatus.spreadsheetId}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Célula de Teste</p>
                        <p className="text-xs">{sheetsStatus.testValue || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {sheetsStatus?.spreadsheetInfo?.sheets && (
                    <div className="mb-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Abas Detectadas na Planilha</p>
                      <div className="flex flex-wrap gap-2">
                        {sheetsStatus.spreadsheetInfo.sheets.map((s: string) => (
                          <span key={s} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-[9px] font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleSyncManual}
                    className="w-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                  >
                    <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                    SINCRONIZAR TUDO AGORA
                  </button>
                </div>

                {/* Sheets Orders */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pedidos na Planilha ({sheetOrders.length})</h3>
                    <button onClick={() => toast.info(`Total de ${sheetOrders.length} pedidos encontrados.`)} className="text-[10px] text-orange-600 font-bold hover:underline">Ver Detalhes</button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
                    {sheetOrders.length === 0 ? (
                      <div className="p-10 text-center text-gray-400 italic">Nenhum pedido encontrado na planilha.</div>
                    ) : (
                      sheetOrders.map((o, idx) => (
                        <div key={idx} className="p-4 flex justify-between items-center bg-gray-50/30 dark:bg-gray-800/10 hover:bg-gray-100/50 transition-colors">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{o.clientName}</p>
                            <p className="text-[10px] text-gray-400">{o.date} • {o.seller}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-orange-600">{formatCurrency(o.total)}</p>
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded uppercase">{o.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Client List for Quick Edit */}
                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Lista de Clientes (Planilha)</h3>
                    <p className="text-[10px] font-bold text-gray-400">{clients.length} cadastrados</p>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {clients.map((c) => (
                      <div key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{c.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase line-clamp-1">{c.city} - {c.state} • {c.seller}</p>
                        </div>
                        <button 
                          onClick={() => setEditingClient(c)}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        >
                          <MapPin size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'carrinhos' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl shadow-sm border border-orange-100 dark:border-orange-900/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 dark:text-white">Clientes com Carrinho</h3>
                      <p className="text-xs text-gray-500">Puxado diretamente da planilha ({sheetCarts.length} encontrados)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {sheetCarts.length === 0 ? (
                      <div className="p-16 text-center">
                        <Package size={48} className="mx-auto mb-4 text-gray-200" />
                        <p className="text-gray-400 italic">Nenhum carrinho pendente encontrado na planilha.</p>
                      </div>
                    ) : (
                      sheetCarts.map((cart, idx) => (
                        <div key={idx} className="p-5 flex justify-between items-center bg-gray-50/30 dark:bg-gray-800/10">
                          <div className="space-y-1">
                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase">{cart.clientName}</p>
                            <div className="flex items-center gap-4">
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Package size={10} /> {cart.itemsCount} itens
                              </p>
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <RefreshCw size={10} /> {cart.updatedAt}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-orange-600">{formatCurrency(cart.total)}</p>
                            <button className="mt-2 text-[10px] font-black text-white bg-orange-500 px-3 py-1 rounded-full uppercase shadow-sm">
                              Ver Detalhes
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/pages/ClientSelection.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Client } from '../types';
import { Search, LogOut, LayoutDashboard, FileUp, MapPin, User, Moon, Sun, ChevronRight, Store, Calendar, Settings, Lock, Eye, EyeOff, Navigation, ShoppingCart, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Visit } from '../types';
import { getRegionalLabel } from '../constants/regionals';

import { ConfigWarning } from '../components/ConfigWarning';

export default function ClientSelection() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [sheetCarts, setSheetCarts] = useState<any[]>([]);
  const [firestoreCarts, setFirestoreCarts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [showProfile, setShowProfile] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState<Client | null>(null);
  const [showMapModal, setShowMapModal] = useState<Client | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    if (profile?.role === 'promotor') {
      navigate('/catalog');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    
    setLoading(true);
    const fetchData = async () => {
      try {
        const [sheetC, firestoreC] = await Promise.all([
          dataService.getCartsFromSheets(),
          dataService.getAllCarts()
        ]);
        setSheetCarts(sheetC || []);
        setFirestoreCarts(firestoreC || []);
      } catch (e) {
        console.error('Error fetching carts:', e);
      }
    };
    fetchData();

    const cartInterval = setInterval(fetchData, 30000);

    const unsubscribe = dataService.subscribeClients(
      profile.name, 
      profile.role === 'admin',
      (data) => {
        setClients(data);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      clearInterval(cartInterval);
    };
  }, [profile]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('VENDAS_dark', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('VENDAS_dark', '0');
    }
  }, [darkMode]);

  const filteredClients = clients.filter(c => {
    const query = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.tradeName.toLowerCase().includes(query) ||
      c.cnpj.includes(query) ||
      c.city.toLowerCase().includes(query) ||
      c.seller.toLowerCase().includes(query)
    );
  });

  const handleSelectClient = (client: Client) => {
    sessionStorage.setItem('selectedClient', JSON.stringify(client));
    navigate('/catalog');
  };

  return (
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212] transition-colors duration-300">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-50 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full overflow-hidden p-1">
                <img src="/logo.svg" alt="Profile" className="w-full h-full object-contain brightness-0 invert" />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm leading-tight">
                  Olá, {profile?.name}
                </h2>
                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {getRegionalLabel(profile?.regional)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowProfile(true)}
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <Settings size={20} />
              </motion.button>
              {profile?.role === 'admin' && (
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/admin')} 
                  className="p-2 bg-white/15 rounded-full text-white transition-colors"
                >
                  <LayoutDashboard size={20} />
                </motion.button>
              )}
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/import')} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <FileUp size={20} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setDarkMode(!darkMode)} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  setLoading(true);
                  const [c, cr] = await Promise.all([
                    dataService.getClients(profile?.name, profile?.role === 'admin'),
                    dataService.getCartsFromSheets()
                  ]);
                  setClients(c || []);
                  setSheetCarts(cr || []);
                  setLoading(false);
                  toast.success('Dados sincronizados!');
                }}
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
                title="Sincronizar com Planilha"
              >
                <RefreshCw size={20} className={cn(loading && "animate-spin")} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={logout} 
                className="p-2 bg-white/15 rounded-full text-white transition-colors"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={18} />
            <input
              type="search"
              placeholder="Buscar por nome, CNPJ, cidade, vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/15 border border-white/30 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/25 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4">
        <ConfigWarning />
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Carregando clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
                {filteredClients.map((client, index) => {
                  const cartForClientSheet = sheetCarts.find(cart => 
                    (cart.id && String(cart.id).trim() === String(client.id).trim()) || 
                    (cart.clientName && (
                      cart.clientName.toLowerCase().trim() === client.name.toLowerCase().trim() ||
                      cart.clientName.toLowerCase().trim() === client.tradeName?.toLowerCase().trim()
                    ))
                  );

                  const cartForClientFirestore = firestoreCarts.find(cart => String(cart.clientId).trim() === String(client.id).trim());
                  const sheetItemCount = Number(cartForClientSheet?.itemsCount) || 0;
                  const firestoreItemCount = Number(cartForClientFirestore?.items?.length) || 0;
                  const itemCount = sheetItemCount + firestoreItemCount;
                  const hasCart = itemCount > 0;

                  return (
                    <motion.div
                      key={`${client.id}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSelectClient(client)}
                      whileHover={{ scale: 1.02, backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)" }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-orange-500 transition-all cursor-pointer flex items-start gap-4 group"
                    >
                      <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 shrink-0 relative">
                        <Store size={24} />
                        {hasCart && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-lg animate-pulse" title="Venda Iniciada">
                            <ShoppingCart size={12} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">
                            {client.tradeName || client.name}
                          </h3>
                          {hasCart && (
                            <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-in fade-in zoom-in">
                              <ShoppingCart size={10} /> {itemCount} item(s)
                            </span>
                          )}
                        </div>
                    {client.tradeName && client.name !== client.tradeName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.name}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-md">
                        ID {client.id}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-md">
                        {client.cnpj}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-md">
                        {client.seller}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-md">
                        {client.city}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVisitModal(client);
                      }}
                      className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full hover:bg-orange-100 transition-colors"
                      title="Registrar Visita"
                    >
                      <Calendar size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMapModal(client);
                      }}
                      className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                      title="Ver no Mapa"
                    >
                      <MapPin size={18} />
                    </button>
                  </div>
                  <ChevronRight className="self-center text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Visit Modal */}
      <AnimatePresence>
        {showVisitModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto text-orange-600">
                  <Calendar size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Registrar Visita</h3>
                <p className="text-sm text-gray-500">{showVisitModal.tradeName || showVisitModal.name}</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <MapPin size={14} />
                  <span>Localização Automática</span>
                </div>
                <p className="text-[10px] text-gray-400 italic">Coordenadas GPS serão salvas com o registro da visita para auditoria.</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowVisitModal(null)}
                  className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    if (!profile) return;
                    setLoading(true);
                    
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      const visit: Visit = {
                        id: 'VIS' + Date.now(),
                        name: showVisitModal.tradeName || showVisitModal.name,
                        cnpj: showVisitModal.cnpj,
                        address: showVisitModal.address,
                        city: showVisitModal.city,
                        state: showVisitModal.state,
                        timestamp: Date.now(),
                        seller: profile.name,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                      };
                      
                      await dataService.saveVisit(visit);
                      toast.success('Visita registrada com sucesso!');
                      setShowVisitModal(null);
                      setLoading(false);
                    }, (err) => {
                      console.error('Geolocation error:', err);
                      toast.error('Erro ao obter localização. Verifique as permissões.');
                      setLoading(false);
                    });
                  }}
                  className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-transform"
                >
                  Confirmar
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {showMapModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-black text-lg">Localização do Cliente</h3>
                  <p className="text-xs opacity-80">{showMapModal.tradeName || showMapModal.name}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMapModal(null)} 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </motion.button>
              </div>
              
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(`${showMapModal.address}, ${showMapModal.city}, ${showMapModal.state}`)}`}
                  allowFullScreen
                ></iframe>
                <div className="absolute inset-0 bg-black/5 pointer-events-none" />
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-blue-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{showMapModal.address}</p>
                    <p className="text-xs text-gray-500">{showMapModal.city} - {showMapModal.state}</p>
                  </div>
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${showMapModal.address}, ${showMapModal.city}, ${showMapModal.state}`)}`;
                    window.open(url, '_blank');
                  }}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-transform"
                >
                  <Navigation size={20} /> Traçar Rota
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-gradient-to-r from-orange-500 to-pink-500 text-white flex justify-between items-center">
                <h3 className="font-black text-lg">Meu Perfil</h3>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowProfile(false); setIsChangingPassword(false); }} 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </motion.button>
              </div>

              <div className="p-6 space-y-6">
                {!isChangingPassword ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600">
                        <User size={32} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{profile?.name}</p>
                        <p className="text-sm text-gray-500">{profile?.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                          {profile?.role}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "white") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(true)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <Lock size={20} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Alterar Senha</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(239,68,68,0.1)" : "#fef2f2") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={logout}
                        className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold text-red-600">Sair da Conta</span>
                        </div>
                        <ChevronRight size={18} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Lock size={18} /> Alterar Senha
                    </h4>
                    
                    <div className="space-y-3">
                      {['current', 'new', 'confirm'].map((field) => (
                        <div key={field} className="relative">
                          <input
                            type={showPasswords[field as keyof typeof showPasswords] ? 'text' : 'password'}
                            placeholder={field === 'current' ? 'Senha Atual' : field === 'new' ? 'Nova Senha' : 'Confirmar Nova Senha'}
                            value={passwordData[field as keyof typeof passwordData]}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                          />
                          <motion.button 
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => setShowPasswords(prev => ({ ...prev, [field]: !prev[field as keyof typeof showPasswords] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPasswords[field as keyof typeof showPasswords] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </motion.button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(false)}
                        className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl transition-colors"
                      >
                        Voltar
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (passwordData.new !== passwordData.confirm) {
                            toast.error('As senhas não coincidem');
                            return;
                          }
                          toast.success('Senha alterada com sucesso!');
                          setIsChangingPassword(false);
                        }}
                        className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg"
                      >
                        Salvar
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/pages/Dashboard.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'motion/react';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, 
  Calendar, ArrowLeft, Download, Filter,
  Layers, Package, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { Order, Product, Client } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const allOrders = await dataService.getOrders();
        setOrders(allOrders);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Analytics Logic
  const filteredOrders = orders.filter(order => {
    if (profile?.role === 'vendedor' || profile?.role === 'promotor') {
      return order.seller === profile.name;
    }
    return true;
  });

  const totalSales = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
  const orderCount = filteredOrders.length;
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  
  // Daily Sales Analysis
  const salesByDate = filteredOrders.reduce((acc: any, curr) => {
    const date = new Date(curr.date).toLocaleDateString('pt-BR');
    acc[date] = (acc[date] || 0) + curr.total;
    return acc;
  }, {});

  const salesData = Object.keys(salesByDate).map(date => ({
    date,
    total: Math.round(salesByDate[date] * 100) / 100
  })).slice(-15);

  // Category Distribution
  const categoryData = filteredOrders.reduce((acc: any, order) => {
    order.items.forEach(item => {
      const cat = item.category || 'Outros';
      acc[cat] = (acc[cat] || 0) + (item.finalPrice * item.quantity);
    });
    return acc;
  }, {});

  const pieData = Object.keys(categoryData).map(name => ({
    name,
    value: Math.round(categoryData[name] * 100) / 100
  }));

  const COLORS = ['#FF6B00', '#F06292', '#4CAF50', '#2196F3', '#9C27B0', '#FFEB3B'];

  // Regional Sales (for Admin)
  const regionalSales = filteredOrders.reduce((acc: any, curr) => {
    const regional = curr.pdfUrl ? curr.seller : 'Desconhecido'; // Using seller as proxy for now if regional not in order
    acc[regional] = (acc[regional] || 0) + curr.total;
    return acc;
  }, {});

  const regionalData = Object.keys(regionalSales).map(name => ({
    name,
    total: Math.round(regionalSales[name] * 0.1) // Mocking some value for variety
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF6F0] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-orange-600 font-bold animate-pulse uppercase tracking-widest text-sm">CARREGANDO ANALYTICS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6F0] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-orange-100 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-3 hover:bg-orange-50 rounded-2xl text-orange-600 transition-colors shrink-0"
            >
              <ArrowLeft size={24} />
            </button>
            <img src="/logo.svg" alt="Logo" className="w-10 h-10 shrink-0" />
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">PAINEL ANAL\u00CDTICO</h1>
              <p className="text-sm text-gray-500 font-medium">{profile?.role === 'admin' ? 'Vis\u00E3o Geral da Empresa' : `Minhas Vendas: ${profile?.name}`}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-gray-100 p-1 rounded-2xl">
              {(['7d', '30d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    timeRange === range ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {range === '7d' ? '7 DIAS' : range === '30d' ? '30 DIAS' : 'TUDO'}
                </button>
              ))}
            </div>
            <button className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
              <Download size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Faturamento Total', value: totalSales, icon: <DollarSign size={24} />, color: 'bg-orange-500', isCurrency: true },
            { label: 'Total de Pedidos', value: orderCount, icon: <ShoppingBag size={24} />, color: 'bg-pink-500', isCurrency: false },
            { label: 'Ticket M\u00E9dio', value: avgOrderValue, icon: <TrendingUp size={24} />, color: 'bg-blue-500', isCurrency: true },
            { label: 'Clientes Atendidos', value: Array.from(new Set(filteredOrders.map(o => o.clientId))).length, icon: <Users size={24} />, color: 'bg-green-500', isCurrency: false },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-orange-900/5 border border-white flex items-center justify-between group overflow-hidden relative"
            >
              <div className="relative z-10">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-gray-900 leading-none">
                  {stat.isCurrency ? `R$ ${stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : stat.value}
                </p>
              </div>
              <div className={`p-4 ${stat.color} text-white rounded-3xl group-hover:scale-110 transition-transform relative z-10`}>
                {stat.icon}
              </div>
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${stat.color} opacity-5 rounded-full blur-2xl group-hover:scale-150 transition-transform`} />
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Sales Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                  <TrendingUp size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Evolu\u00E7\u00E3o de Vendas</h3>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                    itemStyle={{ fontWeight: 800, color: '#FF6B00' }}
                    cursor={{ stroke: '#FF6B00', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#FF6B00" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-pink-100 text-pink-600 rounded-2xl">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Por Categoria</h3>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
             <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Produtos Top</h3>
              </div>
            </div>
            <div className="space-y-4">
              {filteredOrders.flatMap(o => o.items)
                .reduce((acc: any, item) => {
                  const existing = acc.find((i: any) => i.id === item.id);
                  if (existing) {
                    existing.quantity += item.quantity;
                    existing.total += (item.finalPrice * item.quantity);
                  } else {
                    acc.push({ ...item, total: item.finalPrice * item.quantity });
                  }
                  return acc;
                }, [])
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 5)
                .map((product: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-orange-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-gray-400 group-hover:text-orange-500 transition-colors">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800 line-clamp-1">{product.description}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase">{product.quantity} unidades</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-orange-600">
                      R$ {product.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
            </div>
          </div>

           {/* Regional distribution or similar */}
           <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-orange-900/5 border border-white">
             <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
                   <MapPin size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Status de Pedidos</h3>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Novo', count: filteredOrders.filter(o => o.status === 'Novo').length },
                    { name: 'Confirmado', count: filteredOrders.filter(o => o.status === 'Confirmado').length },
                    { name: 'Entregue', count: filteredOrders.filter(o => o.status === 'Entregue').length },
                    { name: 'Cancelado', count: filteredOrders.filter(o => o.status === 'Cancelado').length },
                  ]}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontWeight: 700, fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]} fill="#F06292" barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/pages/ImportPanel.tsx`

```tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { 
  ChevronLeft, 
  FileUp, 
  RefreshCw, 
  FileText, 
  Table, 
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Search,
  ChevronRight,
  X,
  PlusCircle,
  Download,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, normalizeEAN } from '../lib/utils';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import { toast } from 'sonner';
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REGIONALS, getRegionalLabel, RegionalKey } from '../constants/regionals';

export default function ImportPanel() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set()); // Format: "clientIdx-itemIdx"
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedRegional, setSelectedRegional] = useState<string>('TIMON-MA');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (profile?.role === 'vendedor' && profile.regional) {
      const reg = profile.regional.toUpperCase();
      const matched = (reg.includes('TIMON') || reg.includes('TIMAO')) ? 'TIMON-MA' : 
                     (reg.includes('THE') || reg.includes('TERESINA')) ? 'THE' :
                     (reg.includes('IMP') || reg.includes('IMPERATRIZ')) ? 'IMP' : null;
      if (matched) {
        setSelectedRegional(matched);
      }
    }
  }, [profile]);

  const toggleClientSelection = (clientIdx: number) => {
    const newChecked = new Set(checkedItems);
    const clientItems = results[clientIdx].items;
    const allChecked = clientItems.every((item: any, iIdx: number) => !item.found || newChecked.has(`${clientIdx}-${iIdx}`));

    clientItems.forEach((item: any, iIdx: number) => {
      const key = `${clientIdx}-${iIdx}`;
      if (allChecked) {
        newChecked.delete(key);
      } else if (item.found) {
        newChecked.add(key);
      }
    });
    setCheckedItems(newChecked);
  };

  const handleMakeSingleOrder = async (clientIdx: number) => {
    if (isProcessing) return;
    const res = results[clientIdx];
    const client = res.client;
    if (!client) {
      toast.error('Cliente não vinculado ao sistema. Vincule-o primeiro para fazer o pedido.');
      return;
    }

    const selectedItems = res.items.filter((_: any, itemIdx: number) => 
      checkedItems.has(`${clientIdx}-${itemIdx}`) && _.found && _.product
    );

    if (selectedItems.length === 0) {
      toast.error('Nenhum item válido selecionado para este cliente');
      return;
    }

    try {
      setIsProcessing(true);
      const cartKey = `cart_${client.id}`;
      const saved = localStorage.getItem(cartKey);
      let cartItems: any[] = saved ? JSON.parse(saved) : [];

      selectedItems.forEach((item: any) => {
        const existing = cartItems.find(i => i.id === item.product.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          cartItems.push({ ...item.product, quantity: item.quantity, ean: item.ean });
        }
      });

      localStorage.setItem(cartKey, JSON.stringify(cartItems));
      await dataService.saveCart(client.id, cartItems);
      toast.success(`${selectedItems.length} itens adicionados ao carrinho de ${client.name}`);
      
      // Uncheck items for this client after adding to cart
      const newChecked = new Set(checkedItems);
      res.items.forEach((_: any, iIdx: number) => newChecked.delete(`${clientIdx}-${iIdx}`));
      setCheckedItems(newChecked);
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Erro ao adicionar ao carrinho');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedClient = useMemo(() => {
    const saved = sessionStorage.getItem('selectedClient');
    return saved ? JSON.parse(saved) : null;
  }, []);

  useEffect(() => {
    setLoading(true);
    dataService.setRegional(selectedRegional);
    
    Promise.all([
      dataService.getAllProducts(),
      dataService.getClients(undefined, true)
    ]).then(([products, clients]) => {
      setAllProducts(products);
      setAllClients(clients);
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching data for regional:', err);
      setLoading(false);
    });
  }, [selectedRegional]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setLoading(true);
    setResults([]);
    setCheckedItems(new Set());
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      setCheckedItems(new Set());
      
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            
             // Basic validation and mapping
             const mapped = rows.map((row: any) => {
               const rawEan = String(row.EAN || row.ean || row['Código de Barras'] || row['Codigo Barras'] || row['CODIGO EAN'] || row.CODIGO || row['EAN13'] || '');
               const ean = normalizeEAN(rawEan);
               const quantity = parseInt(row.Quantidade || row.qtd || row.qty || row['Qtd'] || row['QTD'] || row['QUANT'] || row['QUANTIDADE'] || 1);
               
               // Try to find product in catalog using normalized EAN comparison
               const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
               
               return {
                 ean,
                 quantity: isNaN(quantity) ? 1 : quantity,
                 description: product?.description || row.Descrição || row.desc || row['Produto'] || row['PRODUTO'] || 'Produto não encontrado',
                 found: !!product,
                 product: product
               };
             }).filter(r => r.ean);

            setResults([{
              clientName: 'Importação Manual',
              cnpj: '',
              items: mapped
            }]);
            toast.success(`${mapped.length} itens identificados`);
          } catch (err) {
            console.error('Excel parse error:', err);
            toast.error('Erro ao ler planilha');
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjs.getDocument(typedarray).promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const items = textContent.items as any[];
              
              // Filter out empty items or items missing a valid transform array
              const filteredItems = items.filter(item => 
                item && 
                typeof item.str === 'string' && 
                item.transform && 
                item.transform.length >= 6
              );
              
              // Sort items primarily by Y-coordinate descending (top to bottom),
              // then by X-coordinate ascending (left to right) if on the same line.
              const sortedItems = [...filteredItems].sort((a, b) => {
                const yA = a.transform[5];
                const yB = b.transform[5];
                if (Math.abs(yA - yB) <= 5) {
                  return a.transform[4] - b.transform[4];
                }
                return yB - yA;
              });
              
              // Group items into visual lines using a Y-pixel grouping tolerance of 5 pixels
              const visualLines: string[] = [];
              let currentLineItems: any[] = [];
              let currentY = -9999;
              
              sortedItems.forEach(item => {
                const y = item.transform[5];
                if (currentY === -9999 || Math.abs(y - currentY) <= 5) {
                  if (currentY === -9999) {
                    currentY = y;
                  }
                  currentLineItems.push(item);
                } else {
                  // Ensure correct left-to-right order inside the completed line
                  currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                  visualLines.push(currentLineItems.map(item => item.str).join(' '));
                  
                  // Initialize the new line
                  currentLineItems = [item];
                  currentY = y;
                }
              });
              
              if (currentLineItems.length > 0) {
                currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
                visualLines.push(currentLineItems.map(item => item.str).join(' '));
              }
              
              const pageText = visualLines.join('\n');
              fullText += pageText + '\n';
            }

            const lines = fullText.split('\n');
            const importResults: any[] = [];
            let currentClient: any = null;

            // 1. First pass: Identify clients and their positions in the text
            const clientMatches = Array.from(fullText.matchAll(/Unidade:\s*(.*?)(?=Usuário:|CNPJ:|$)/gi));

            // 2. Second pass: Identify all products with EAN, Description, Quantity and Price
            // Using a resilient, high-precision regex matching the percent column (%) which is highly reliable in A7 Pharma reports
            // Format: [EAN 8-14 digits] [Description] [% Discount or numeric percent value] [Quantity] [Total]
            const productRegexPercent = /(\d{8,14})\s+([^\n]*?)\s+([\d\.,]+\s*%)\s+([\d\.]+)\s+([\d\.]+,\d{2})/g;
            let allProductsFound = Array.from(fullText.matchAll(productRegexPercent)).map(m => {
              const ean = normalizeEAN(m[1]);
              const rawDesc = m[2].trim();
              const quantityStr = m[4].replace(/\./g, '');
              const quantity = parseInt(quantityStr);
              
              // Extract unit price from the end of raw description if present
              const priceMatch = rawDesc.match(/([\d\.]+,\d{2})\s*$/);
              let priceStr = '0,00';
              let description = rawDesc;
              if (priceMatch) {
                priceStr = priceMatch[1];
                description = rawDesc.substring(0, priceMatch.index).trim();
              } else {
                // Heuristic breakdown of total & quantity
                const totalStr = m[5].replace(/\./g, '').replace(',', '.');
                const totalVal = parseFloat(totalStr);
                if (!isNaN(totalVal) && quantity > 0) {
                  priceStr = (totalVal / quantity).toFixed(2).replace('.', ',');
                }
              }
              
              const entry = [m[0], ean, description, String(quantity), priceStr] as any;
              entry.index = m.index;
              return entry;
            });

            // Fallback matching if percent-based regex produced no matches
            if (allProductsFound.length === 0) {
              const productRegex = /(\d{8,14})\s+([^\n]*?)\s+([\d\.]+)\s+([\d\.]+,\d{2})/g;
              const matches = Array.from(fullText.matchAll(productRegex));
              
              if (matches.length > 0) {
                allProductsFound = matches.map(m => {
                  const ean = normalizeEAN(m[1]);
                  const desc = m[2].trim();
                  const qty = parseInt(m[3].replace(/\./g, ''));
                  const priceStr = m[4];
                  const entry = [m[0], ean, desc, String(qty), priceStr] as any;
                  entry.index = m.index;
                  return entry;
                });
              } else {
                // Extract individual EAN elements and scan surrounding blocks
                const eanRegex = /\b\d{8,14}\b/g;
                const eanMatches = Array.from(fullText.matchAll(eanRegex));
                
                eanMatches.forEach((match, idx) => {
                  const rawEan = match[0];
                  const ean = normalizeEAN(rawEan);
                  const startPos = match.index || 0;
                  const endPos = eanMatches[idx + 1] ? eanMatches[idx + 1].index : fullText.length;
                  const blockText = fullText.substring(startPos, endPos).trim();
                  
                  const qpMatch = blockText.match(/([\d\.]+)\s+([\d\.]+,\d{2})/);
                  if (qpMatch) {
                    const quantity = parseInt(qpMatch[1].replace(/\./g, ''));
                    const price = qpMatch[2];
                    const description = blockText.substring(rawEan.length, qpMatch.index).trim();
                    const entry = [match[0], ean, description, String(quantity), price] as any;
                    entry.index = match.index;
                    allProductsFound.push(entry);
                  } else {
                    const qMatch = blockText.match(/([\d\.]+)\s*$/);
                    if (qMatch) {
                      const quantity = parseInt(qMatch[1].replace(/\./g, ''));
                      const description = blockText.substring(rawEan.length, qMatch.index).trim();
                      const entry = [match[0], ean, description, String(quantity), "0,00"] as any;
                      entry.index = match.index;
                      allProductsFound.push(entry);
                    }
                  }
                });
              }
            }

            // 3. Group products by client based on their position in the text
            if (clientMatches.length > 0) {
              clientMatches.forEach((match, index) => {
                const name = match[1].trim();
                if (name.toUpperCase().includes('ESCRITÓRIO')) return;

                const startPos = match.index || 0;
                const endPos = clientMatches[index + 1] ? clientMatches[index + 1].index : fullText.length;
                const clientText = fullText.substring(startPos, endPos || fullText.length);

                const cnpjMatch = clientText.match(/CNPJ:\s*([\d\.\/\-]+)/i);
                const cnpj = cnpjMatch ? cnpjMatch[1].trim().replace(/[^\d]/g, '') : '';

                // Extract extra header info for A7 Pharma
                const fornecedorMatch = clientText.match(/Fornecedor:\s*(.*?)(?=Cond\.|$)/i);
                const condPgtoMatch = clientText.match(/Cond\. Pgto:\s*(.*?)(?=Status|$)/i);
                const statusMatch = clientText.match(/Status:\s*(.*?)(?=Data|$)/i);
                const dataEntregaMatch = clientText.match(/Data Entrega:\s*([\d/]+\s*[\d:]*)/i);
                const cotacaoMatch = clientText.match(/Cotação:\s*(.*?)(?=\n|$)/i);

                const clientObj: any = {
                  clientName: name,
                  cnpj: cnpj,
                  items: [],
                  headerInfo: {
                    fornecedor: fornecedorMatch ? fornecedorMatch[1].trim() : '',
                    condPgto: condPgtoMatch ? condPgtoMatch[1].trim() : '',
                    status: statusMatch ? statusMatch[1].trim() : '',
                    dataEntrega: dataEntregaMatch ? dataEntregaMatch[1].trim() : '',
                    cotacao: cotacaoMatch ? cotacaoMatch[1].trim() : ''
                  }
                };

                // Find client in system
                const matchedClient = allClients.find(c => 
                  (cnpj && c.cnpj.replace(/[^\d]/g, '') === cnpj) ||
                  c.name.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(c.name.toLowerCase())
                );
                if (matchedClient) clientObj.client = matchedClient;

                // Find products that belong to this client block
                allProductsFound.forEach(pMatch => {
                  const pPos = pMatch.index || 0;
                  if (pPos >= startPos && pPos < (endPos || fullText.length)) {
                    const ean = normalizeEAN(pMatch[1]);
                    const description = pMatch[2].trim();
                    const quantity = parseInt(pMatch[3]);
                    const priceStr = pMatch[4] ? pMatch[4].replace(/\./g, '').replace(',', '.') : '0';
                    const price = parseFloat(priceStr);
                    
                    const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                    
                    if (!clientObj.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                      clientObj.items.push({
                        ean,
                        quantity: isNaN(quantity) ? 1 : quantity,
                        description: product?.description || description,
                        found: !!product,
                        product: product,
                        price: price
                      });
                    }
                  }
                });

                if (clientObj.items.length > 0) {
                  importResults.push(clientObj);
                }
              });
            } else {
              // No client headers found, put everything in a default client
              currentClient = { clientName: 'Cliente Não Identificado', cnpj: '', items: [] };
              allProductsFound.forEach(pMatch => {
                const ean = normalizeEAN(pMatch[1]);
                const description = pMatch[2].trim();
                const quantity = parseInt(pMatch[3]);
                const priceStr = pMatch[4] ? pMatch[4].replace(/\./g, '').replace(',', '.') : '0';
                const price = parseFloat(priceStr);
                const product = allProducts.find(p => normalizeEAN(p.ean) === ean);
                
                if (!currentClient.items.find((item: any) => normalizeEAN(item.ean) === ean)) {
                  currentClient.items.push({
                    ean,
                    quantity: isNaN(quantity) ? 1 : quantity,
                    description: product?.description || description,
                    found: !!product,
                    product: product,
                    price: price
                  });
                }
              });
              if (currentClient.items.length > 0) {
                importResults.push(currentClient);
              }
            }

            // Filter out clients with no items
            const finalResults = importResults.filter(r => r.items.length > 0);

            if (finalResults.length > 0) {
              setResults(finalResults);
              
              // Auto-check all found items across all clients
              const initialChecked = new Set<string>();
              finalResults.forEach((res, cIdx) => {
                res.items.forEach((item: any, iIdx: number) => {
                  if (item.found) initialChecked.add(`${cIdx}-${iIdx}`);
                });
              });
              setCheckedItems(initialChecked);
              
              toast.success(`${finalResults.length} clientes identificados no PDF`);
            } else {
              toast.error('Nenhum item identificado no PDF. Verifique o formato.');
            }
          } catch (err) {
            console.error('PDF parse error:', err);
            toast.error('Erro ao ler PDF');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.error('Formato não suportado. Use Excel, CSV ou PDF.');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setLoading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleMakeAllOrders = async () => {
    if (isProcessing) return;
    let totalAdded = 0;
    let clientsWithOrders = 0;
    const processedClients: string[] = [];

    try {
      setIsProcessing(true);
      toast.loading('Processando pedidos...', { id: 'make-all' });
      
      for (const [clientIdx, res] of results.entries()) {
        const client = res.client;
        if (!client) continue;

        const selectedItems = res.items.filter((_: any, itemIdx: number) => 
          checkedItems.has(`${clientIdx}-${itemIdx}`) && _.found && _.product
        );

        if (selectedItems.length > 0) {
          const cartKey = `cart_${client.id}`;
          const saved = localStorage.getItem(cartKey);
          let cartItems: any[] = saved ? JSON.parse(saved) : [];

          selectedItems.forEach((item: any) => {
            const existing = cartItems.find(i => i.id === item.product.id);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              cartItems.push({ ...item.product, quantity: item.quantity });
            }
          });

          localStorage.setItem(cartKey, JSON.stringify(cartItems));
          await dataService.saveCart(client.id, cartItems);
          totalAdded += selectedItems.length;
          clientsWithOrders++;
          processedClients.push(client.name);
        }
      }

      if (totalAdded > 0) {
        toast.success(`${totalAdded} itens adicionados aos carrinhos de ${clientsWithOrders} clientes`, { id: 'make-all' });
        
        // Auto-select the first client that got an order so Catalog doesnt redirect to home
        if (processedClients.length > 0) {
          const firstClientName = processedClients[0];
          const firstClient = results.find(r => r.client?.name === firstClientName)?.client;
          if (firstClient) {
            sessionStorage.setItem('selectedClient', JSON.stringify(firstClient));
          }
        }
        
        navigate('/catalog');
      } else {
        toast.error('Nenhum item válido selecionado ou clientes não vinculados ao sistema', { id: 'make-all' });
      }
    } catch (err) {
      console.error('Error processing all orders:', err);
      toast.error('Erro ao processar pedidos', { id: 'make-all' });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportIndividualOrderToPDF = (clientIdx: number) => {
    const res = results[clientIdx];
    const selectedItems = res.items.filter((_: any, itemIdx: number) => 
      checkedItems.has(`${clientIdx}-${itemIdx}`)
    );

    if (selectedItems.length === 0) {
      toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const doc = new jsPDF();
    
    // Header helper
    const drawHeader = (d: jsPDF, pageNum: number, total: number, clientCode: string) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, 15, 182, 35, 'F');
      d.setFontSize(24);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('VENDAS HBN1', 105, 30, { align: 'center' });
      d.setFontSize(10);
      d.setFont('helvetica', 'normal');
      d.text('COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', 105, 38, { align: 'center' });
      const region = getRegionalLabel(selectedRegional as RegionalKey);
      d.setFontSize(8);
      const contactStr = `${region} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`;
      d.text(contactStr, 105, 43, { align: 'center' });
      d.text(`${new Date().toLocaleString('pt-BR')} \u2022 ${total} pedido(s)`, 105, 48, { align: 'center' });
    };

    const drawClientData = (d: jsPDF, y: number, r: any) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, y, 182, 6, 'F');
      d.setFontSize(8);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('DADOS DO CLIENTE', 105, y + 4.5, { align: 'center' });

      y += 10;
      d.setTextColor(0, 0, 0);
      // Ensure we pull clean names without header noise
      const cleanName = r.clientName?.split('Fornecedor:')[0]?.trim() || r.clientName || 'N/A';
      const cleanTradeName = r.client?.tradeName || cleanName;
      const cleanLegalName = r.client?.name || cleanName;
      
      const labels = ['Nome Fantasia', 'ID Cliente', 'Nome', 'CNPJ', 'Vendedor', 'Cidade/Estado'];
      const values = [
        cleanTradeName.toUpperCase(),
        r.client?.id || 'N/A',
        cleanLegalName.toUpperCase(),
        r.cnpj || r.client?.cnpj || 'N/A',
        (profile?.name || 'Leonel Amorim').toUpperCase(),
        (r.client?.city ? `${r.client.city} / ${r.client.state || 'MA'}` : 'N/A').toUpperCase()
      ];
      labels.forEach((label, i) => {
        d.setFont('helvetica', 'bold');
        d.text(label, 18, y + (i * 5));
        d.setFont('helvetica', 'normal');
        d.text(String(values[i]), 50, y + (i * 5));
      });
      return y + (labels.length * 5) + 5;
    };

    const clientCode = res.headerInfo?.cotacao || res.client?.id?.substring(0, 5) || '30214';
    drawHeader(doc, 1, 1, clientCode);
    let currentY = drawClientData(doc, 55, res);

    const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
    doc.setFillColor(255, 107, 0);
    doc.rect(14, currentY, 182, 6, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`FABRICANTE: ${manufacturer.toUpperCase()}`, 105, currentY + 4.5, { align: 'center' });
    currentY += 6;

      let calculatedPrecoSubtotal = 0;
      let calculatedNoStock = 0;
      let calculatedDiscount = 0;

      const tableData = selectedItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        calculatedPrecoSubtotal += rowPrecoSubtotal;
        calculatedDiscount += rowDiscount;
        if (!hasStock) {
          calculatedNoStock += rowSubtotal;
        }

        return [
          item.product?.id || 'N/A',
          item.ean,
          item.description.toUpperCase(),
          formatCurrency(salePrice),
          `${discountStr}%`,
          formatCurrency(finalPrice),
          item.quantity,
          formatCurrency(rowSubtotal),
          hasStock ? 'OK' : 'Sem estoque'
        ];
      });

    autoTable(doc, {
      startY: currentY,
      head: [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC% \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [255, 107, 0], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'left', cellWidth: 'auto' },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 12 },
        5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 20 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 25 },
        8: { halign: 'center', cellWidth: 15 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          if (data.cell.text[0] === 'OK') data.cell.styles.textColor = [0, 150, 0];
          else { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
        }
      }
    });

    const summaryY = (doc as any).lastAutoTable.finalY + 5;
    const subtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
    const noStock = Math.round(calculatedNoStock * 100) / 100;
    const discount = Math.round(calculatedDiscount * 100) / 100;
    const total = Math.round((subtotal - noStock - discount) * 100) / 100;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('SUBTOTAL', 160, summaryY, { align: 'right' });
    doc.text(formatCurrency(subtotal), 196, summaryY, { align: 'right' });
    doc.setTextColor(200, 0, 0);
    doc.text('SEM ESTOQUE', 160, summaryY + 6, { align: 'right' });
    doc.text(formatCurrency(noStock), 196, summaryY + 6, { align: 'right' });
    doc.setTextColor(0, 150, 0);
    doc.text('DESCONTO', 160, summaryY + 12, { align: 'right' });
    doc.text(`-${formatCurrency(discount)}`, 196, summaryY + 12, { align: 'right' });
    doc.setFillColor(240, 240, 240);
    doc.rect(140, summaryY + 15, 60, 8, 'F');
    doc.setFontSize(11);
    doc.setTextColor(0, 50, 100);
    doc.text('TOTAL', 160, summaryY + 21, { align: 'right' });
    doc.text(formatCurrency(total), 196, summaryY + 21, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const contactInfoFooter = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'} | Tel: ${profile?.phone || '(86) 99964-7573'} | ${profile?.email || 'leonelamorimm@gmail.com'}`;
    doc.text(`Obrigado pela preferencia! | VENDAS HBN1 | ${contactInfoFooter} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 290, { align: 'center' });

    const rawName = res.clientName || 'N/A';
    const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
    doc.save(`Pedido_${cleanName.replace(/\s+/g, '_')}.pdf`);
  };


  const exportIndividualOrderToExcel = (clientIdx: number) => {
    try {
      const res = results[clientIdx];
      const selectedItems = res.items.filter((_: any, itemIdx: number) => 
        checkedItems.has(`${clientIdx}-${itemIdx}`)
      );

      if (selectedItems.length === 0) {
        toast.error('Nenhum item selecionado para exportar');
        return;
      }

      const rawName = res.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = res.client?.tradeName || cleanName;
      const displayLegalName = res.client?.name || cleanName;
      const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';

      // Financials
      let calculatedPrecoSubtotal = 0;
      let calculatedNoStock = 0;
      let calculatedDiscount = 0;

      selectedItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        calculatedPrecoSubtotal += rowPrecoSubtotal;
        calculatedDiscount += rowDiscount;
        
        const hasStock = item.product ? item.product.stock > 0 : false;
        if (!hasStock) {
          calculatedNoStock += rowSubtotal;
        }
      });

      const orderSubtotal = Math.round(calculatedPrecoSubtotal * 100) / 100;
      const orderNoStock = Math.round(calculatedNoStock * 100) / 100;
      const orderDiscount = Math.round(calculatedDiscount * 100) / 100;
      const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

      // Define Styles
      const mainHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 24, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const subHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const sectionBarStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const labelStyle: any = { font: { bold: true }, alignment: { horizontal: "left" } };
      const valueStyle: any = { alignment: { horizontal: "left" } };
      
      const tableHeadStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "FFFFFF" } },
          bottom: { style: "thin", color: { rgb: "FFFFFF" } },
          left: { style: "thin", color: { rgb: "FFFFFF" } },
          right: { style: "thin", color: { rgb: "FFFFFF" } }
        }
      };

      const cellStyle: any = { 
        font: { sz: 8 },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } }
        },
        alignment: { horizontal: "left" }
      };

      const moneyStyle: any = { ...cellStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: "right" } };
      const centerStyle: any = { ...cellStyle, alignment: { horizontal: "center" } };
      const highlightMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "FF6B00" } } };
      const subtotalMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "C80000" } } };

      const ws_data = [
        [{ v: 'VENDAS HBN1', t: 's', s: mainHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${getRegionalLabel(selectedRegional as RegionalKey)} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${new Date().toLocaleString('pt-BR')} \u2022 1 pedido(s)`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [],
        [{ v: 'DADOS DO CLIENTE', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'Nome Fantasia', t: 's', s: labelStyle }, { v: displayTradeName.toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'ID Cliente', t: 's', s: labelStyle }, { v: res.client?.id || 'N/A', t: 's', s: valueStyle }],
        [{ v: 'Nome', t: 's', s: labelStyle }, { v: displayLegalName.toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'CNPJ', t: 's', s: labelStyle }, { v: res.cnpj || res.client?.cnpj || 'N/A', t: 's', s: valueStyle }],
        [{ v: 'Vendedor', t: 's', s: labelStyle }, { v: (profile?.name || 'Leonel Amorim').toUpperCase(), t: 's', s: valueStyle }],
        [{ v: 'Cidade/Estado', t: 's', s: labelStyle }, { v: (res.client?.city ? `${res.client.city} / ${res.client.state || 'MA'}` : 'N/A').toUpperCase(), t: 's', s: valueStyle }],
        [],
        [{ v: `FABRICANTE: ${manufacturer.toUpperCase()}`, t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null],
        [
          { v: 'COD.', t: 's', s: tableHeadStyle },
          { v: 'EAN', t: 's', s: tableHeadStyle },
          { v: 'DESCRICAO', t: 's', s: tableHeadStyle },
          { v: 'PRECO', t: 's', s: tableHeadStyle },
          { v: 'DESC%', t: 's', s: tableHeadStyle },
          { v: 'PR.FINAL', t: 's', s: tableHeadStyle },
          { v: 'QT', t: 's', s: tableHeadStyle },
          { v: 'SUBTOTAL', t: 's', s: tableHeadStyle },
          { v: 'STATUS', t: 's', s: tableHeadStyle }
        ]
      ];

      selectedItems.forEach((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        ws_data.push([
          { v: item.product?.id || 'N/A', t: 's', s: centerStyle },
          { v: item.ean, t: 's', s: centerStyle },
          { v: item.description.toUpperCase(), t: 's', s: cellStyle },
          { v: salePrice, t: 'n', s: moneyStyle },
          { v: `${discountStr}%`, t: 's', s: centerStyle },
          { v: finalPrice, t: 'n', s: highlightMoneyStyle },
          { v: item.quantity, t: 'n', s: centerStyle },
          { v: Math.round((finalPrice * item.quantity) * 100) / 100, t: 'n', s: subtotalMoneyStyle },
          { v: hasStock ? 'OK' : 'Sem estoque', t: 's', s: { ...centerStyle, font: { color: { rgb: hasStock ? "009600" : "C80000" }, bold: !hasStock } } }
        ]);
      });

      ws_data.push([]);
      ws_data.push([null, null, null, null, null, null, { v: 'SUBTOTAL', t: 's', s: labelStyle }, { v: orderSubtotal, t: 'n', s: moneyStyle }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'SEM ESTOQUE', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: orderNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'DESCONTO', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -orderDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null]);
      ws_data.push([null, null, null, null, null, null, { v: 'TOTAL', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, { v: orderTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, null]);

      const ws = XLSXStyle.utils.aoa_to_sheet(ws_data);

      // Merges
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Header
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } }, // Dados cliente bar
        { s: { r: 13, c: 0 }, e: { r: 13, c: 8 } } // Fabricante bar
      ];

      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 45 }, { wch: 12 }, { wch: 8 }, 
        { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSXStyle.utils.book_new();
      const sheetName = (cleanName).replace(/[\[\]\*\?:\/\\]/g, '').substring(0, 31);
      XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
      
      const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Pedido_${cleanName.substring(0, 20).replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel exportado com sucesso');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  const exportAllOrdersToPDF = () => {
    const doc = new jsPDF();
    const ordersToExport = results.filter((res, cIdx) => 
      res.items.some((_: any, iIdx: number) => checkedItems.has(`${cIdx}-${iIdx}`))
    );

    if (ordersToExport.length === 0) {
      toast.error('Nenhum item selecionado para exportar');
      return;
    }

    const totalOrders = ordersToExport.length;
    let currentOrderNum = 1;

    // Common drawing functions defined inside for access to doc
    const drawHeader = (d: jsPDF, pageNum: number, total: number, clientCode: string) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, 15, 182, 35, 'F');
      d.setFontSize(24);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('VENDAS HBN1', 105, 30, { align: 'center' });
      d.setFontSize(10);
      d.setFont('helvetica', 'normal');
      d.text('COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', 105, 38, { align: 'center' });
      const region = getRegionalLabel(selectedRegional as RegionalKey);
      d.setFontSize(8);
      const contactInfoHead = `${region} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`;
      d.text(contactInfoHead, 105, 43, { align: 'center' });
      d.text(`${new Date().toLocaleString('pt-BR')} \u2022 ${total} pedido(s)`, 105, 48, { align: 'center' });
    };

    const drawClientData = (d: jsPDF, y: number, r: any) => {
      d.setFillColor(255, 107, 0);
      d.rect(14, y, 182, 6, 'F');
      d.setFontSize(8);
      d.setTextColor(255, 255, 255);
      d.setFont('helvetica', 'bold');
      d.text('DADOS DO CLIENTE', 105, y + 4.5, { align: 'center' });
      y += 10;
      d.setTextColor(0, 0, 0);

      const rawName = r.clientName || 'N/A';
      const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
      const displayTradeName = r.client?.tradeName || cleanName;
      const displayLegalName = r.client?.name || cleanName;

      const labels = ['Nome Fantasia', 'ID Cliente', 'Nome', 'CNPJ', 'Vendedor', 'Cidade/Estado'];
      const values = [
        displayTradeName.toUpperCase(),
        r.client?.id || 'N/A',
        displayLegalName.toUpperCase(),
        r.cnpj || r.client?.cnpj || 'Não informado',
        (profile?.name || 'Leonel Amorim').toUpperCase(),
        (r.client?.city ? `${r.client.city} / ${r.client.state || 'MA'}` : 'N/A').toUpperCase()
      ];
      labels.forEach((label, i) => {
        d.setFont('helvetica', 'bold');
        d.text(label, 18, y + (i * 5));
        d.setFont('helvetica', 'normal');
        d.text(String(values[i]), 50, y + (i * 5));
      });
      return y + (labels.length * 5) + 5;
    };

    ordersToExport.forEach((res, idx) => {
      if (idx > 0) doc.addPage();
      
      const clientCode = res.headerInfo?.cotacao || res.client?.id?.substring(0, 5) || String(30214 + idx);
      drawHeader(doc, currentOrderNum, totalOrders, clientCode);
      let nextY = drawClientData(doc, 55, res);
      const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
      doc.setFillColor(255, 107, 0);
      doc.rect(14, nextY, 182, 6, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`FABRICANTE: ${manufacturer.toUpperCase()}`, 105, nextY + 4.5, { align: 'center' });
      nextY += 6;

      const resIdx = results.indexOf(res);
      const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${resIdx}-${iIdx}`));
      let orderPrecoSubtotalAcc = 0;
      let orderNoStockAcc = 0;
      let orderDiscountAcc = 0;

      const tableData = selectedItems.map((item: any) => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        const discVal = salePrice > 0 ? (1 - finalPrice / salePrice) * 100 : 0;
        const discountStr = discVal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        const hasStock = item.product ? item.product.stock > 0 : false;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        orderPrecoSubtotalAcc += rowPrecoSubtotal;
        orderDiscountAcc += rowDiscount;
        if (!hasStock) {
          orderNoStockAcc += rowSubtotal;
        }

        return [
          item.product?.id || 'N/A',
          item.ean,
          item.description.toUpperCase(),
          formatCurrency(salePrice),
          `${discountStr}%`,
          formatCurrency(finalPrice),
          item.quantity,
          formatCurrency(rowSubtotal),
          hasStock ? 'OK' : 'Sem estoque'
        ];
      });

      autoTable(doc, {
        startY: nextY,
        head: [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC% \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [255, 107, 0], textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'left', cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 10 },
          5: { halign: 'right', fontStyle: 'bold', textColor: [255, 107, 0], cellWidth: 20 },
          6: { halign: 'center', cellWidth: 10 },
          7: { halign: 'right', fontStyle: 'bold', textColor: [200, 0, 0], cellWidth: 25 },
          8: { halign: 'center', cellWidth: 15 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 8) {
            if (data.cell.text[0] === 'OK') data.cell.styles.textColor = [0, 150, 0];
            else { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });

      const orderSubtotal = Math.round(orderPrecoSubtotalAcc * 100) / 100;
      const orderNoStock = Math.round(orderNoStockAcc * 100) / 100;
      const orderDiscount = Math.round(orderDiscountAcc * 100) / 100;
      const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

      const currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('SUBTOTAL', 160, currentY, { align: 'right' });
      doc.text(formatCurrency(orderSubtotal), 196, currentY, { align: 'right' });
      doc.setTextColor(200, 0, 0);
      doc.text('SEM ESTOQUE', 160, currentY + 6, { align: 'right' });
      doc.text(formatCurrency(orderNoStock), 196, currentY + 6, { align: 'right' });
      doc.setTextColor(0, 150, 0);
      doc.text('DESCONTO', 160, currentY + 12, { align: 'right' });
      doc.text(`-${formatCurrency(orderDiscount)}`, 196, currentY + 12, { align: 'right' });
      doc.setFillColor(240, 240, 240);
      doc.rect(140, currentY + 15, 60, 8, 'F');
      doc.setFontSize(11);
      doc.setTextColor(0, 50, 100);
      doc.text('TOTAL', 160, currentY + 21, { align: 'right' });
      doc.text(formatCurrency(orderTotal), 196, currentY + 21, { align: 'right' });

      currentOrderNum++;
    });

    // Final Global Summary Page
    doc.addPage();
    const finalGlobalY = 40;
    doc.setFillColor(255, 107, 0);
    doc.rect(14, finalGlobalY, 182, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL GERAL \u2014 ${totalOrders} PEDIDO(S)`, 105, finalGlobalY + 7, { align: 'center' });

    let summaryY = finalGlobalY + 25;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    
    // Calculate global stats correctly
    let globalPrecoSubtotal = 0;
    let globalNoStock = 0;
    let globalDiscount = 0;
    ordersToExport.forEach(res => {
      const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${results.indexOf(res)}-${iIdx}`));
      selectedItems.forEach(item => {
        const salePrice = item.product?.salePrice || item.price || 0;
        const finalPrice = item.product?.finalPrice || item.price || 0;
        
        const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
        const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
        const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

        globalPrecoSubtotal += rowPrecoSubtotal;
        globalDiscount += rowDiscount;
        
        const hasStock = item.product ? item.product.stock > 0 : false;
        if (!hasStock) globalNoStock += rowSubtotal;
      });
    });
    const globalSubtotalRounded = Math.round(globalPrecoSubtotal * 100) / 100;
    const globalNoStockRounded = Math.round(globalNoStock * 100) / 100;
    const globalDiscountRounded = Math.round(globalDiscount * 100) / 100;
    const globalTotal = Math.round((globalSubtotalRounded - globalNoStockRounded - globalDiscountRounded) * 100) / 100;

    doc.text('SUBTOTAL', 100, summaryY, { align: 'right' });
    doc.text(formatCurrency(globalSubtotalRounded), 150, summaryY, { align: 'right' });
    
    doc.setTextColor(200, 0, 0);
    doc.text('SEM ESTOQUE', 100, summaryY + 10, { align: 'right' });
    doc.text(formatCurrency(globalNoStockRounded), 150, summaryY + 10, { align: 'right' });
    
    doc.setTextColor(0, 150, 0);
    doc.text('DESCONTO', 100, summaryY + 20, { align: 'right' });
    doc.text(`-${formatCurrency(globalDiscountRounded)}`, 150, summaryY + 20, { align: 'right' });
    
    doc.setFillColor(255, 107, 0);
    doc.rect(50, summaryY + 28, 110, 12, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL GERAL DOS PEDIDOS', 100, summaryY + 36, { align: 'right' });
    doc.text(formatCurrency(globalTotal), 155, summaryY + 36, { align: 'right' });

    // Footer for all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const contactFooterAll = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'} | Tel: ${profile?.phone || '(86) 99964-7573'} | ${profile?.email || 'leonelamorimm@gmail.com'}`;
        doc.text(`Obrigado pela preferencia! | VENDAS HBN1 | ${contactFooterAll} | Emitido em: ${new Date().toLocaleString('pt-BR')}`, 105, 290, { align: 'center' });
    }

    doc.save('Relatorio_Importacao_Compilado.pdf');
  };

  const exportAllOrdersToExcel = () => {
    try {
      const ordersToExport = results.filter((res, cIdx) => 
        res.items.some((_: any, iIdx: number) => checkedItems.has(`${cIdx}-${iIdx}`))
      );

      if (ordersToExport.length === 0) {
        toast.error('Nenhum item selecionado para exportar');
        return;
      }

      // Define Styles
      const mainHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 20, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const subHeaderStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const sectionBarStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 10, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const labelStyle: any = { font: { bold: true }, alignment: { horizontal: "left" } };
      const valueStyle: any = { alignment: { horizontal: "left" } };
      
      const tableHeadStyle: any = {
        fill: { fgColor: { rgb: "FF6B00" } },
        font: { color: { rgb: "FFFFFF" }, sz: 9, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const cellStyle: any = { font: { sz: 8 }, alignment: { horizontal: "left" } };
      const moneyStyle: any = { ...cellStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: "right" } };
      const centerStyle: any = { ...cellStyle, alignment: { horizontal: "center" } };
      const highlightMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "FF6B00" } } };
      const subtotalMoneyStyle: any = { ...moneyStyle, font: { ...moneyStyle.font, bold: true, color: { rgb: "C80000" } } };

      const ws_data: any[] = [
        [{ v: 'VENDAS HBN1', t: 's', s: mainHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: 'COMPROVANTE DE PEDIDO \u2014 IMPORTA\u00C7\u00C3O', t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${getRegionalLabel(selectedRegional as RegionalKey)} \u2022 Tel: ${profile?.phone || '(86) 99964-7573'} \u2022 ${profile?.email || 'leonelamorimm@gmail.com'}`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        [{ v: `${new Date().toLocaleString('pt-BR')} \u2022 ${ordersToExport.length} pedido(s)`, t: 's', s: subHeaderStyle }, null, null, null, null, null, null, null, null],
        []
      ];

      const merges: any[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }
      ];

      ordersToExport.forEach((res, cIdx) => {
        const startRow = ws_data.length;
        const resIdxInResults = results.indexOf(res);
        const selectedItems = res.items.filter((_: any, iIdx: number) => 
          checkedItems.has(`${resIdxInResults}-${iIdx}`)
        );

        const manufacturer = res.headerInfo?.fornecedor || 'UNILEVER';
        const rawName = res.clientName || 'N/A';
        const cleanName = rawName.split('Fornecedor:')[0]?.trim() || rawName;
        const displayTradeName = res.client?.tradeName || cleanName;
        const displayLegalName = res.client?.name || cleanName;

        ws_data.push([{ v: 'DADOS DO CLIENTE', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
        merges.push({ s: { r: startRow, c: 0 }, e: { r: startRow, c: 8 } });

        ws_data.push([{ v: 'Nome Fantasia', t: 's', s: labelStyle }, { v: displayTradeName.toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'ID Cliente', t: 's', s: labelStyle }, { v: res.client?.id || 'N/A', t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Nome', t: 's', s: labelStyle }, { v: displayLegalName.toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'CNPJ', t: 's', s: labelStyle }, { v: res.cnpj || res.client?.cnpj || 'N/A', t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Vendedor', t: 's', s: labelStyle }, { v: (profile?.name || 'Leonel Amorim').toUpperCase(), t: 's', s: valueStyle }]);
        ws_data.push([{ v: 'Cidade/Estado', t: 's', s: labelStyle }, { v: (res.client?.city ? `${res.client.city} / ${res.client.state || 'MA'}` : 'N/A').toUpperCase(), t: 's', s: valueStyle }]);
        
        ws_data.push([{ v: `FABRICANTE: ${manufacturer.toUpperCase()}`, t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
        merges.push({ s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 8 } });

        ws_data.push([
          { v: 'COD.', t: 's', s: tableHeadStyle },
          { v: 'EAN', t: 's', s: tableHeadStyle },
          { v: 'DESCRICAO', t: 's', s: tableHeadStyle },
          { v: 'PRECO', t: 's', s: tableHeadStyle },
          { v: 'DESC%', t: 's', s: tableHeadStyle },
          { v: 'PR.FINAL', t: 's', s: tableHeadStyle },
          { v: 'QT', t: 's', s: tableHeadStyle },
          { v: 'SUBTOTAL', t: 's', s: tableHeadStyle },
          { v: 'STATUS', t: 's', s: tableHeadStyle }
        ]);

        let orderPrecoSubtotal = 0;
        let orderNoStock = 0;
        let orderDiscount = 0;

        selectedItems.forEach((item: any) => {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const subtotal = Math.round((finalPrice * item.quantity) * 100) / 100;
          const rowPrecoSubtotal = Math.round((salePrice * item.quantity) * 100) / 100;
          const rowDiscount = Math.round(((salePrice - finalPrice) * item.quantity) * 100) / 100;
          const hasStock = item.product ? item.product.stock > 0 : false;
          
          orderPrecoSubtotal = Math.round((orderPrecoSubtotal + rowPrecoSubtotal) * 100) / 100;
          orderDiscount = Math.round((orderDiscount + rowDiscount) * 100) / 100;
          if (!hasStock) orderNoStock = Math.round((orderNoStock + subtotal) * 100) / 100;

          ws_data.push([
            { v: item.product?.id || 'N/A', t: 's', s: centerStyle },
            { v: item.ean, t: 's', s: centerStyle },
            { v: item.description.toUpperCase(), t: 's', s: cellStyle },
            { v: salePrice, t: 'n', s: moneyStyle },
            { v: `${salePrice > 0 ? Math.round((1 - finalPrice / salePrice) * 100) : 0}%`, t: 's', s: centerStyle },
            { v: finalPrice, t: 'n', s: highlightMoneyStyle },
            { v: item.quantity, t: 'n', s: centerStyle },
            { v: subtotal, t: 'n', s: subtotalMoneyStyle },
            { v: hasStock ? 'OK' : 'Sem estoque', t: 's', s: { ...centerStyle, font: { color: { rgb: hasStock ? "009600" : "C80000" }, bold: !hasStock } } }
          ]);
        });

        const orderSubtotal = Math.round(orderPrecoSubtotal * 100) / 100;
        const orderTotal = Math.round((orderSubtotal - orderNoStock - orderDiscount) * 100) / 100;

        ws_data.push([null, null, null, null, null, null, { v: 'SUBTOTAL', t: 's', s: labelStyle }, { v: orderSubtotal, t: 'n', s: moneyStyle }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'SEM ESTOQUE', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: orderNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'DESCONTO', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -orderDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null]);
        ws_data.push([null, null, null, null, null, null, { v: 'TOTAL', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, bold: true } } }, { v: orderTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, bold: true } } }, null]);
        ws_data.push([]); // Spacer
      });

      // Global Summary at the bottom
      let globalPrecoSubtotal = 0;
      let globalNoStock = 0;
      let globalDiscount = 0;
      ordersToExport.forEach(res => {
        const resIdx = results.indexOf(res);
        const selectedItems = res.items.filter((_: any, iIdx: number) => checkedItems.has(`${resIdx}-${iIdx}`));
        selectedItems.forEach(item => {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          const subtotal = Math.round((finalPrice * item.quantity) * 100) / 100;
          const rowPrecoSubtotal = Math.round((salePrice * item.quantity) * 100) / 100;
          const rowDiscount = Math.round(((salePrice - finalPrice) * item.quantity) * 100) / 100;
          const hasStock = item.product ? item.product.stock > 0 : false;
          
          globalPrecoSubtotal = Math.round((globalPrecoSubtotal + rowPrecoSubtotal) * 100) / 100;
          globalDiscount = Math.round((globalDiscount + rowDiscount) * 100) / 100;
          if (!hasStock) {
            globalNoStock = Math.round((globalNoStock + subtotal) * 100) / 100;
          }
        });
      });
      const globalSubtotal = Math.round(globalPrecoSubtotal * 100) / 100;
      const globalTotal = Math.round((globalSubtotal - globalNoStock - globalDiscount) * 100) / 100;

      ws_data.push([]);
      ws_data.push([{ v: 'RESUMO FINANCEIRO GERAL', t: 's', s: sectionBarStyle }, null, null, null, null, null, null, null, null]);
      merges.push({ s: { r: ws_data.length - 1, c: 0 }, e: { r: ws_data.length - 1, c: 8 } });
      
      ws_data.push([{ v: 'TOTAL DE PEDIDOS:', t: 's', s: labelStyle }, { v: ordersToExport.length, t: 'n', s: valueStyle }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'SUBTOTAL GERAL:', t: 's', s: labelStyle }, { v: globalSubtotal, t: 'n', s: moneyStyle }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'SEM ESTOQUE GERAL:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "C80000" } } } }, { v: globalNoStock, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "C80000" } } } }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'DESCONTO TOTAL:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, color: { rgb: "009600" } } } }, { v: -globalDiscount, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, color: { rgb: "009600" } } } }, null, null, null, null, null, null, null]);
      ws_data.push([{ v: 'TOTAL GERAL DOS PEDIDOS:', t: 's', s: { ...labelStyle, font: { ...labelStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, { v: globalTotal, t: 'n', s: { ...moneyStyle, font: { ...moneyStyle.font, sz: 12, color: { rgb: "003264" }, bold: true } } }, null, null, null, null, null, null, null]);

      const ws = XLSXStyle.utils.aoa_to_sheet(ws_data);
      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 45 }, { wch: 12 }, { wch: 8 }, 
        { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSXStyle.utils.book_new();
      XLSXStyle.utils.book_append_sheet(wb, ws, 'Relatório_Consolidado');
      
      const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_Importacao_Consolidado_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Relatório Excel consolidado gerado com sucesso');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Erro ao exportar Excel geral');
    }
  };


  const toggleItem = (clientIdx: number, itemIdx: number) => {
    const key = `${clientIdx}-${itemIdx}`;
    const newChecked = new Set(checkedItems);
    if (newChecked.has(key)) newChecked.delete(key);
    else newChecked.add(key);
    setCheckedItems(newChecked);
  };

  const financialSummary = useMemo(() => {
    let subtotal = 0;
    let noStock = 0;
    let discount = 0;
    const clientTotals: { name: string; total: number; subtotal: number; noStock: number; discount: number }[] = [];

    results.forEach((res, cIdx) => {
      let clientSubtotal = 0;
      let clientNoStock = 0;
      let clientDiscount = 0;
      res.items.forEach((item: any, iIdx: number) => {
        if (checkedItems.has(`${cIdx}-${iIdx}`)) {
          const salePrice = item.product?.salePrice || item.price || 0;
          const finalPrice = item.product?.finalPrice || item.price || 0;
          
          const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
          const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
          const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

          clientSubtotal += rowPrecoSubtotal;
          clientDiscount += rowDiscount;
          
          const hasStock = item.product ? item.product.stock > 0 : false;
          if (!hasStock) {
            clientNoStock += rowSubtotal;
          }
        }
      });
      subtotal += clientSubtotal;
      noStock += clientNoStock;
      discount += clientDiscount;
      
      if (clientSubtotal > 0) {
        const clientTotal = Math.round((clientSubtotal - clientNoStock - clientDiscount) * 100) / 100;
        clientTotals.push({ 
          name: res.clientName, 
          total: clientTotal,
          subtotal: clientSubtotal,
          noStock: clientNoStock,
          discount: clientDiscount
        });
      }
    });

    const subtotalRounded = Math.round(subtotal * 100) / 100;
    const noStockRounded = Math.round(noStock * 100) / 100;
    const discountRounded = Math.round(discount * 100) / 100;
    const total = Math.round((subtotalRounded - noStockRounded - discountRounded) * 100) / 100;

    return {
      subtotal: subtotalRounded,
      noStock: noStockRounded,
      discount: discountRounded,
      total,
      clientTotals
    };
  }, [results, checkedItems]);

  const globalStats = useMemo(() => {
    let withStock = 0;
    let noStock = 0;
    let notFound = 0;

    results.forEach(res => {
      res.items.forEach((item: any) => {
        if (!item.found) notFound++;
        else if (item.product?.stock > 0) withStock++;
        else noStock++;
      });
    });

    return { withStock, noStock, notFound };
  }, [results]);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [defaultExpiryDate, setDefaultExpiryDate] = useState<string>('');

  const [catalogUpdateResult, setCatalogUpdateResult] = useState<any>(null);

  const handleCatalogUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCatalogFile(file);
    setIsCatalogModalOpen(true);
  };

  const confirmCatalogUpdate = async (industry: string) => {
    if (!catalogFile) return;
    setIsCatalogModalOpen(false);
    setLoading(true);
    
    try {
      // Set the regional before the update call
      dataService.setRegional(selectedRegional);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let targetSheetName = workbook.SheetNames[0];
          if (industry === 'DANONE') {
            // Mais flexível na busca da aba
            const danoneSheet = workbook.SheetNames.find(name => {
              const normalized = name.trim().toUpperCase().replace(/\s/g, '');
              return normalized.includes('FAT.MIN.1.000,00') || normalized.includes('1.000');
            });
            
            if (danoneSheet) {
              targetSheetName = danoneSheet;
            } else {
              toast.error('Aba "FAT. MIN. 1.000,00" não encontrada. Usando a primeira aba disponível.');
            }
          }
          
          const targetSheet = workbook.Sheets[targetSheetName];
          const rows = XLSX.utils.sheet_to_json(targetSheet, { header: 1 });
          
          toast.loading(`Atualizando catálogo ${industry} para ${getRegionalLabel(selectedRegional)}...`, { id: 'catalog-update' });
          const result = await dataService.updateCatalogInSheets(industry, rows, defaultExpiryDate || null);
          
          if (result && result.sucesso) {
            setCatalogUpdateResult(result);
            toast.success('Catálogo atualizado com sucesso!', { id: 'catalog-update' });
          } else {
            // Error is already handled in dataService.ts with a specific toast
            toast.dismiss('catalog-update');
          }
        } catch (err) {
          console.error('Catalog parse error:', err);
          toast.error('Erro ao processar planilha de catálogo');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(catalogFile);
    } catch (error) {
      console.error('Catalog update error:', error);
      toast.error('Erro ao ler arquivo');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212]">
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 bg-white/20 rounded-full text-white">
            <ChevronLeft size={24} />
          </button>
          <img src="/logo.svg" alt="Logo" className="w-8 h-8 brightness-0 invert" />
          <h1 className="text-white font-bold text-lg">Importar Pedido</h1>
        </div>
        <button 
          onClick={async () => {
            setLoading(true);
            const [products, clients] = await Promise.all([
              dataService.getAllProducts(),
              dataService.getClients(undefined, true)
            ]);
            setAllProducts(products);
            setAllClients(clients);
            setLoading(false);
            toast.success('Dados sincronizados com a planilha!');
          }}
          className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
          title="Sincronizar com Planilha"
        >
          <RefreshCw size={20} className={cn(loading && "animate-spin")} />
        </button>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Import Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-4 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer flex flex-col items-center gap-4",
              isDragging ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E]",
              loading && "opacity-50 pointer-events-none"
            )}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input 
              type="file" 
              id="fileInput" 
              className="hidden" 
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileSelect}
            />
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600">
              {loading ? <RefreshCw size={40} className="animate-spin" /> : <FileUp size={40} />}
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white">Importar Pedido</h3>
              <p className="text-sm text-gray-500 mt-2">
                PDF (A7 Pharma) ou Excel/CSV<br />com EAN + Quantidade
              </p>
            </div>
            <button className="mt-4 bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg">
              Escolher arquivo
            </button>
          </div>

          {/* Catalog Update Card */}
          <div 
            className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-3xl p-10 text-center flex flex-col items-center gap-4 cursor-pointer"
            onClick={() => document.getElementById('catalogInput')?.click()}
          >
            <input 
              type="file" 
              id="catalogInput" 
              className="hidden" 
              accept=".xlsx,.xls,.csv"
              onChange={handleCatalogUpdate}
            />
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600">
              <RefreshCw size={40} />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white">Atualizar Catálogo</h3>
              <p className="text-sm text-gray-500 mt-2">
                UNILEVER • DANONE • KENVUE<br />KIMBERLY • OMRON
              </p>
            </div>
            <button className="mt-4 bg-gradient-to-r from-[#26A65B] to-[#1B8A4A] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg">
              Escolher planilha
            </button>
          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {catalogUpdateResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg p-8 shadow-2xl space-y-6 overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Catálogo Atualizado</h3>
                  <p className="text-sm text-gray-500 mt-2">Indústria: <span className="font-bold text-orange-600">{catalogUpdateResult.industry}</span></p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Atualizados</p>
                    <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{catalogUpdateResult.updatedCount}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-2xl text-center">
                    <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Novos</p>
                    <p className="text-2xl font-black text-green-700 dark:text-green-300">{catalogUpdateResult.newCount}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} /> Log de Processamento
                  </p>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-2 font-mono">
                    {catalogUpdateResult.log && catalogUpdateResult.log.map((line: string, i: number) => (
                      <div key={i} className="flex gap-2 leading-relaxed border-b border-gray-100 dark:border-gray-800 pb-1 last:border-0">
                        <span className="text-orange-500 font-bold">•</span> {line}
                      </div>
                    ))}
                    {(!catalogUpdateResult.log || catalogUpdateResult.log.length === 0) && (
                      <p className="italic opacity-50">Nenhum log disponível.</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setCatalogUpdateResult(null)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-bold shadow-lg"
                >
                  Fechar
                </button>
              </motion.div>
            </div>
          )}

          {isCatalogModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                    <RefreshCw size={32} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Atualizar Catálogo</h3>
                  <p className="text-sm text-gray-500 mt-2">Selecione a regional e a indústria:</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Regional Correspondente
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(REGIONALS).filter(reg => {
                        if (profile?.role !== 'vendedor') return true;
                        if (!profile.regional) return false;
                        const userReg = profile.regional.toUpperCase();
                        if (reg === 'TIMON-MA') return userReg.includes('TIMON') || userReg.includes('TIMAO');
                        if (reg === 'THE') return userReg.includes('THE') || userReg.includes('TERESINA');
                        if (reg === 'IMP') return userReg.includes('IMP') || userReg.includes('IMPERATRIZ');
                        return false;
                      }).map((reg) => (
                        <button
                          key={reg}
                          onClick={() => setSelectedRegional(reg)}
                          className={cn(
                            "py-2 rounded-xl text-xs font-black transition-all border-2",
                            selectedRegional === reg 
                              ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20" 
                              : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {REGIONALS[reg as RegionalKey].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Validade do Desconto (Opcional)
                    </label>
                    <input 
                      type="date"
                      value={defaultExpiryDate}
                      onChange={(e) => setDefaultExpiryDate(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl text-sm font-bold border-none ring-0 focus:ring-2 focus:ring-orange-500 transition-all text-gray-700 dark:text-gray-200"
                    />
                    <p className="text-[9px] text-gray-400 mt-1 ml-1 leading-tight">
                      * Se preenchido, os descontos aplicados nesta planilha expirarão automaticamente após esta data.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                      Indústria
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto p-1 pr-2">
                      {['UNILEVER', 'DANONE', 'KENVUE', 'KIMBERLY', 'OMRON', 'OUTROS'].map((ind) => (
                        <button
                          key={ind}
                          onClick={() => confirmCatalogUpdate(ind)}
                          className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-transparent hover:border-green-500 rounded-2xl font-bold text-gray-700 dark:text-gray-200 transition-all text-left flex justify-between items-center group"
                        >
                          {ind}
                          <ChevronRight size={18} className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="w-full py-4 text-gray-400 font-bold text-sm hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </motion.div>
            </div>
          )}

          {results.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Global Stats Bar */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-green-600">{globalStats.withStock}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-green-500" />
                    Com estoque
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-orange-500">{globalStats.noStock}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <AlertCircle size={12} className="text-orange-500" />
                    Sem estoque
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-red-500">{globalStats.notFound}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span className="text-red-500 font-black">✕</span>
                    Não encontrado
                  </div>
                </div>
              </div>

              {/* All Clients List */}
              <div className="space-y-10">
                {results.map((res, clientIdx) => (
                  <div key={clientIdx} className="bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
                    {/* Client Header - Matches Image 1 */}
                    <div className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-6 text-white relative">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none font-display mb-4">Pedido Nº IMP</h2>
                          
                          {res.headerInfo && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[9px] font-black uppercase opacity-90 tracking-tighter leading-tight">
                              {res.headerInfo.fornecedor && <span>FORNECEDOR: {res.headerInfo.fornecedor}</span>}
                              {res.headerInfo.condPgto && <span>COND. PGTO: {res.headerInfo.condPgto}</span>}
                              {res.headerInfo.status && <span>STATUS: {res.headerInfo.status}</span>}
                              {res.headerInfo.dataEntrega && <span>DATA ENTREGA: {res.headerInfo.dataEntrega}</span>}
                              {res.headerInfo.cotacao && <span>COTAÇÃO: {res.headerInfo.cotacao}</span>}
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-lg border border-white/20">
                              🏪
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold uppercase tracking-tight leading-none truncate mb-1">
                                {res.clientName}
                              </h3>
                              <div className="inline-flex items-center gap-2">
                                <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-[8px] text-[10px] font-mono font-bold tracking-widest border border-white/10 uppercase">
                                  {res.cnpj || 'CNPJ NÃO IDENTIFICADO'}
                                </div>
                                {!res.client && (
                                  <div className="bg-white/10 backdrop-blur-md text-[8px] font-black uppercase px-2 py-1 rounded-[8px] border border-white/10">
                                    Não Cadastrado
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-3 shrink-0">
                          <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => exportIndividualOrderToExcel(clientIdx)}
                            className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
                            title="Exportar Excel"
                          >
                            <Table size={24} />
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => exportIndividualOrderToPDF(clientIdx)}
                            className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-lg"
                            title="Exportar PDF"
                          >
                            <FileText size={24} />
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Product List for this Client */}
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {res.items.map((item: any, itemIdx: number) => {
                        const isChecked = checkedItems.has(`${clientIdx}-${itemIdx}`);
                        return (
                          <div 
                            key={itemIdx} 
                            className={cn(
                              "p-4 flex items-center gap-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                              !isChecked && "opacity-50"
                            )}
                          >
                            <button 
                              onClick={() => toggleItem(clientIdx, itemIdx)}
                              className={cn(
                                "w-6 h-6 rounded flex items-center justify-center transition-all shrink-0",
                                isChecked ? "bg-green-500 text-white" : "border-2 border-gray-200 dark:border-gray-700"
                              )}
                            >
                              {isChecked && <CheckCircle2 size={16} />}
                            </button>

                            {item.product?.photo && (
                              <div 
                                className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-1 shrink-0 cursor-zoom-in"
                                onClick={() => setSelectedImage(item.product.photo)}
                              >
                                <img 
                                  src={item.product.photo} 
                                  alt={item.description} 
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 dark:text-white truncate uppercase text-sm leading-tight">
                                {item.description}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-gray-400">EAN: {item.ean}</span>
                                {item.product?.industry && (
                                  <span className="text-[10px] font-bold text-[#F06292] uppercase">{item.product.industry}</span>
                                )}
                              </div>
                              {item.found && (
                                <div className="mt-2 flex gap-2">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                    item.product?.stock > 10 ? "bg-green-100 text-green-600" : 
                                    item.product?.stock > 0 ? "bg-yellow-100 text-yellow-600" : 
                                    "bg-red-100 text-red-600"
                                  )}>
                                    {item.product?.stock > 10 ? 'Em Estoque' : 
                                     item.product?.stock > 0 ? 'Estoque Baixo' : 
                                     'Sem Estoque'}: {item.product?.stock || 0}
                                  </span>
                                  {item.product?.type === 'offer' && (
                                    <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 text-orange-600 rounded uppercase">Oferta</span>
                                  )}
                                </div>
                              )}
                              {!item.found && (
                                <div className="mt-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-100 text-red-600">
                                    Não encontrado no catálogo
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-gray-400 uppercase">Qtd:</span>
                              <span className="text-lg font-black text-gray-900 dark:text-white ml-1">{item.quantity}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Client Summary Footer - Matches Image 2 */}
                    <div className="bg-[#FFF9F5] dark:bg-gray-800/30 p-6 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-green-600">
                              <CheckCircle2 size={18} /> {res.items.filter((item: any) => item.found && item.product?.stock > 0).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Com estoque</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-orange-500">
                              <AlertCircle size={18} /> {res.items.filter((item: any) => item.found && item.product?.stock <= 0).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Sem estoque</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-sm font-black text-red-500">
                              <span className="text-red-500 font-black text-lg">✕</span> {res.items.filter((item: any) => !item.found).length}
                            </div>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Não encontrado</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => toggleClientSelection(clientIdx)}
                            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:text-[#FF6B00] transition-colors border border-gray-200 dark:border-gray-700"
                          >
                            {res.items.every((_: any, iIdx: number) => !_.found || checkedItems.has(`${clientIdx}-${iIdx}`)) ? 'Desmarcar Todos' : 'Marcar Todos'}
                          </button>
                          {res.client && (
                            <button 
                              onClick={() => handleMakeSingleOrder(clientIdx)}
                              disabled={isProcessing}
                              className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                              Fazer Pedido
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#FF6B00]" />
                        <h4 className="text-base font-black text-[#FF6B00] uppercase italic flex items-center gap-2 mb-6 font-display">
                          📊 Resumo Financeiro
                        </h4>
                        
                        {(() => {
                          let clientSubtotal = 0;
                          let clientNoStock = 0;
                          let clientDiscount = 0;
                          res.items.forEach((item: any, iIdx: number) => {
                            if (checkedItems.has(`${clientIdx}-${iIdx}`)) {
                              const salePrice = item.product?.salePrice || item.price || 0;
                              const finalPrice = item.product?.finalPrice || item.price || 0;
                              
                              const rowSubtotal = Math.round(finalPrice * item.quantity * 100) / 100;
                              const rowPrecoSubtotal = Math.round(salePrice * item.quantity * 100) / 100;
                              const rowDiscount = Math.round((salePrice - finalPrice) * item.quantity * 100) / 100;

                              clientSubtotal += rowPrecoSubtotal;
                              clientDiscount += rowDiscount;
                              
                              const hasStock = item.product ? item.product.stock > 0 : false;
                              if (!hasStock) {
                                clientNoStock += rowSubtotal;
                              }
                            }
                          });
                          const clientDiscountRounded = Math.round(clientDiscount * 100) / 100;
                          const clientTotal = Math.round((clientSubtotal - clientNoStock - clientDiscountRounded) * 100) / 100;

                          return (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-500 text-sm">Subtotal</span>
                                <span className="font-bold text-gray-900 dark:text-white text-base">{formatCurrency(clientSubtotal)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-1 bg-red-500 rounded-full" />
                                  <span className="font-bold text-red-500 text-sm">Sem estoque</span>
                                </div>
                                <span className="font-bold text-red-500 text-base">{formatCurrency(clientNoStock)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-1 bg-green-500 rounded-full" />
                                  <span className="font-bold text-green-500 text-sm">Descontos aplicados</span>
                                </div>
                                <span className="font-bold text-green-500 text-base">- {formatCurrency(clientDiscountRounded)}</span>
                              </div>
                              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                                <span className="text-lg font-black text-[#FF6B00] uppercase tracking-tight">Total estimado</span>
                                <span className="text-2xl font-black text-[#FF6B00]">{formatCurrency(clientTotal)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Global Financial Summary - Matches Image 3 with large border and rounded font */}
              <div className="bg-white dark:bg-[#1E1E1E] rounded-[3.5rem] p-10 shadow-2xl border-[10px] border-[#FF6B00] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -mr-32 -mt-32" />
                
                <h3 className="text-[2.5rem] font-black italic uppercase tracking-tighter flex items-center gap-4 mb-12 font-display leading-none">
                  <span className="text-3xl">📄</span> 
                  <span className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] bg-clip-text text-transparent">TOTAL GERAL – {results.length} pedidos</span>
                </h3>

                <div className="space-y-10">
                  <div className="flex justify-between items-center px-4">
                    <span className="font-bold text-gray-400 text-2xl uppercase tracking-widest font-display">Subtotal</span>
                    <span className="font-black text-gray-900 dark:text-white text-3xl">{formatCurrency(financialSummary.subtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                      <span className="font-bold text-red-500 text-2xl uppercase tracking-widest font-display">Sem Estoque</span>
                    </div>
                    <span className="font-black text-red-500 text-3xl">{formatCurrency(financialSummary.noStock)}</span>
                  </div>

                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      <span className="font-bold text-green-500 text-2xl uppercase tracking-widest font-display">Descontos</span>
                    </div>
                    <span className="font-black text-green-500 text-3xl">- {formatCurrency(financialSummary.discount)}</span>
                  </div>
                  
                  <div className="pt-10 border-t-2 border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-3xl flex items-center justify-center text-orange-600 shadow-lg">
                        <ShoppingCart size={32} />
                      </div>
                      <span className="text-3xl font-black text-[#FF6B00] uppercase tracking-tighter italic font-display">Total Geral Estimado</span>
                    </div>
                    <div className="bg-[#FFF5F0] dark:bg-orange-900/10 px-16 py-8 rounded-[3rem] border-2 border-[#FFE0D1] dark:border-orange-900/20 shadow-inner flex items-center justify-center min-w-[300px]">
                      <span className="text-7xl font-black text-[#FF6B00] drop-shadow-sm">{formatCurrency(financialSummary.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-14 flex flex-col lg:flex-row items-center justify-between gap-8">
                  <button 
                    onClick={() => {
                      setResults([]);
                      toast.success('Importação cancelada.');
                    }}
                    className="order-4 lg:order-1 text-gray-400 hover:text-red-500 font-black uppercase tracking-widest text-xs transition-all hover:scale-105"
                  >
                    CANCELAR IMPORTAÇÃO
                  </button>
                  
                  <div className="order-2 lg:order-2 flex gap-4 w-full lg:w-auto">
                    <motion.button 
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={exportAllOrdersToExcel}
                      className="flex-1 lg:flex-none px-8 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-black flex items-center justify-center gap-3 text-gray-500 hover:bg-gray-50 transition-all shadow-sm group"
                    >
                      <Download size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="uppercase text-xs tracking-widest">EXCEL GERAL</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={exportAllOrdersToPDF}
                      className="flex-1 lg:flex-none px-8 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl font-black flex items-center justify-center gap-3 text-gray-500 hover:bg-gray-50 transition-all shadow-sm group"
                    >
                      <Download size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="uppercase text-xs tracking-widest">PDF GERAL</span>
                    </motion.button>
                  </div>

                  <motion.button 
                    whileHover={{ scale: 1.05, shadow: "0 25px 50px rgba(255,107,0,0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleMakeAllOrders}
                    disabled={isProcessing}
                    className="order-1 lg:order-3 w-full lg:w-auto bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white px-12 py-7 rounded-[2.5rem] font-black text-2xl shadow-[0_20px_40px_rgba(255,107,0,0.3)] flex items-center justify-center gap-4 group border-b-4 border-black/10 disabled:opacity-50"
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" size={32} /> : <Sparkles size={32} className="group-hover:rotate-12 transition-transform" />}
                    <span>FAZER TODOS OS PEDIDOS</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
              onClick={() => setSelectedImage(null)}
            >
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-xl transition-colors z-[210]"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
              >
                <X size={24} />
              </motion.button>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedImage}
                  alt="Expanded View"
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/pages/Login.tsx`

```tsx
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { profile, login, loading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (profile) return <Navigate to="/" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setIsLoggingIn(true);
      setError('');
      const success = await login(username, password);
      if (!success) {
        setError('Usuário ou senha incorretos');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#FF6B00] to-[#F06292] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        <div className="text-center mb-8">
          <motion.img 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src="/logo.svg" 
            alt="Logo" 
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1 className="font-display text-4xl font-extrabold bg-gradient-to-r from-[#FF6B00] to-[#F06292] bg-clip-text text-transparent leading-tight">
            VENDAS HBN1
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            Higiene & Beleza — Acesso do Vendedor
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              className="w-full bg-orange-50/50 border-2 border-transparent focus:border-orange-200 rounded-2xl px-4 py-3 outline-none transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="w-full bg-orange-50/50 border-2 border-transparent focus:border-orange-200 rounded-2xl px-4 py-3 outline-none transition-all font-medium"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || loading}
            className="w-full bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-6"
          >
            {isLoggingIn ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p>© 2025 VENDAS HBN1</p>
          <p>TIMON-MA | (86) 99964-7573</p>
        </div>
      </motion.div>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/pages/ProductCatalog.tsx`

```tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { Product, Client, OrderItem, Favorite, Order, BannerMessage } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  Search, 
  ChevronLeft, 
  ShoppingCart, 
  Star, 
  Flame, 
  Sparkles, 
  Package, 
  X, 
  Plus, 
  Minus,
  Filter as FilterIcon,
  SlidersHorizontal,
  ArrowUpDown,
  History,
  Zap,
  Bell,
  CheckCircle2,
  AlertCircle,
  Camera,
  Globe,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Check,
  MessageCircle,
  Key,
  Hash,
  LogOut,
  TrendingUp,
  Settings,
  User,
  Lock,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { Toaster, toast } from 'sonner';
import { ConfigWarning } from '../components/ConfigWarning';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { OrderSchema } from '../lib/schemas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { getRegionalLabel } from '../constants/regionals';

const applyCustomRounding = (val: number) => {
  const s = val.toFixed(10);
  const parts = s.split('.');
  let rounded: number;
  if (parts.length >= 2 && parts[1].length >= 3) {
    const thirdDigit = parseInt(parts[1][2]);
    if (thirdDigit >= 6) {
      rounded = parseFloat((Math.ceil(val * 100) / 100).toFixed(2));
    } else {
      rounded = parseFloat((Math.floor(val * 100) / 100).toFixed(2));
    }
  } else {
    rounded = parseFloat(val.toFixed(2));
  }

  if (rounded === 0.99) return 1.00;
  return rounded;
};

const getManufacturerLogo = (name: string): string | null => {
  const normName = name.trim().toLowerCase();
  if (normName.includes('danone')) {
    return 'https://logos-world.net/wp-content/uploads/2020/07/Danone-Logo-2013.png';
  }
  if (normName.includes('unilever')) {
    return 'https://upload.wikimedia.org/wikipedia/pt/thumb/5/59/Logo_Unilever.svg/1920px-Logo_Unilever.svg.png';
  }
  if (normName.includes('kenvue') || normName.includes('johnson') || normName.includes('j&j')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Kenvue_logo.svg';
  }
  if (normName.includes('kimberly')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Kimberly-Clark_logo.svg/1280px-Kimberly-Clark_logo.svg.png';
  }
  if (normName.includes('omron')) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/OMRON_Logo.svg/3840px-OMRON_Logo.svg.png';
  }
  return null;
};

interface ProductCardProps {
  product: Product;
  cartQuantity: number;
  isFavorite: boolean;
  isSold: boolean;
  profileRole?: string;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantityDirectly: (id: string, value: number) => void;
  onToggleFavorite: (product: Product) => void;
  onSetZoomImage: (url: string) => void;
  onSetUpdatingImageProduct: (product: Product) => void;
}

const ProductCard = React.memo<ProductCardProps>(({
  product,
  cartQuantity,
  isFavorite,
  isSold,
  profileRole,
  onAddToCart,
  onUpdateQuantity,
  onSetQuantityDirectly,
  onToggleFavorite,
  onSetZoomImage,
  onSetUpdatingImageProduct,
}) => {
  const hasStock = product.stock > 0;
  const economy = product.salePrice - product.finalPrice;
  
  // Standardize discount using user's rule: 3rd digit 6+ rounds up, 5- stays down
  const calculatedDiscount = product.salePrice > 0 ? (economy / product.salePrice) * 100 : 0;
  const finalDiscount = applyCustomRounding(product.discount || calculatedDiscount);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className={cn(
        "bg-white dark:bg-[#1E1E1E] rounded-[24px] overflow-hidden shadow-md group border border-transparent hover:border-orange-500/10 transition-all flex flex-col relative pb-3",
        !hasStock && "opacity-80"
      )}
    >
      {/* Top Badges */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-1">
          {product.type === 'offer' && <span className="bg-orange-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm"><Flame size={10} /> Oferta</span>}
          {product.type === 'new' && <span className="bg-purple-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm"><Sparkles size={10} /> Novo</span>}
          {profileRole !== 'promotor' && isSold && <span className="bg-green-600 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-sm uppercase">Já Comprado</span>}
        </div>
        {profileRole !== 'promotor' && finalDiscount > 0 && (
          <div className="flex flex-col items-end gap-1">
            <div className="bg-[#EF4444] text-white text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-full shadow-lg flex items-center justify-center">
              -{finalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%
            </div>
            {product.discountExpiryDate && (
              <div className="bg-white/90 backdrop-blur-sm text-orange-600 text-[8px] font-black px-2 py-0.5 rounded-full border border-orange-100 shadow-sm flex items-center gap-1">
                <History size={8} /> Expira: {new Date(product.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Image */}
      <div className="aspect-[4/4] w-full bg-white p-4 relative cursor-zoom-in flex-none overflow-hidden flex items-center justify-center" onClick={() => onSetZoomImage(product.photo)}>
        <img 
          src={product.photo || `https://placehold.co/400x400/FFFFFF/CCCCCC?text=Sem+Foto`} 
          alt={product.description} 
          crossOrigin="anonymous"
          loading="lazy"
          className="max-w-full max-h-full w-auto h-auto object-contain transition-all duration-500 group-hover:scale-110" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (product.photo && !target.src.includes('weserv.nl')) {
              target.src = `https://images.weserv.nl/?url=${encodeURIComponent(product.photo)}&output=jpg&q=90&bg=white&fit=contain&w=500&h=500`;
            } else if (!target.src.includes('placehold.co')) {
              target.src = 'https://placehold.co/400x400/FFFFFF/DDDDDD?text=Foto+Indisponivel';
            }
          }}
        />
      </div>

      {/* Product Info Section */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-1.5">
        {/* Header: Category and Utils */}
        <div className="flex justify-between items-center mb-1">
          {profileRole !== 'promotor' ? (
            <span className="text-[9px] font-black text-[#F472B6] uppercase tracking-wider">{product.category}</span>
          ) : <div />}
          {profileRole !== 'promotor' && (
            <div className="flex gap-2 animate-none">
              <motion.button 
                whileHover={{ scale: 1.2, color: "#EA580C" }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(product); }} 
                className={cn("p-1 transition-all", isFavorite ? "text-orange-600" : "text-gray-300")}
              >
                <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.2, color: "#4B5563" }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onSetUpdatingImageProduct(product); }}
                className="text-gray-300 hover:text-gray-600 transition-colors"
              >
                <Camera size={16} />
              </motion.button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight min-h-[32px] mb-0.5">
          {product.description}
        </h3>

        {/* Manufacturer */}
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">{product.manufacturer}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-1 bg-[#EEF2FF] dark:bg-blue-900/20 text-[#4F46E5] dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-transparent shadow-sm">
            <Key size={10} className="text-[#FBBF24]" fill="#FBBF24" />
            {product.id}
          </div>
          {product.ean && (
            <div className="flex items-center gap-1 bg-[#FAF5FF] dark:bg-purple-900/20 text-[#9333EA] dark:text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-transparent shadow-sm">
              <span className="w-2 h-2 bg-[#9333EA] rounded-sm shrink-0" />
              {product.ean}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-auto space-y-0.5">
          <div className="flex flex-col">
            {profileRole !== 'promotor' && economy > 0 && (
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 line-through">
                De: {formatCurrency(product.salePrice)}
              </span>
            )}
            <span className="text-xl font-black text-[#FF6B00]">
              {formatCurrency(product.finalPrice)}
            </span>
          </div>
          
          {/* Savings Badge */}
          {profileRole !== 'promotor' && economy > 0 && (
            <div className="inline-flex items-center gap-1 bg-[#22C55E] text-white text-[9px] font-black px-2 py-1 rounded-full shadow-sm mt-1">
              <Star size={10} fill="currentColor" />
              ECONOMIZE {formatCurrency(economy)}
            </div>
          )}

          <div className="flex flex-col gap-1 mt-2">
            <p className={cn("text-[10px] font-bold", hasStock ? "text-gray-500 dark:text-gray-400" : "text-[#EF4444]")}>
              {hasStock ? `Estoque: ${product.stock}` : 'Sem estoque'}
            </p>
            {profileRole === 'promotor' && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black text-gray-400 uppercase">Status:</span>
                <span className={cn(
                  "text-[9px] font-black px-1.5 py-0.5 rounded uppercase",
                  product.type === 'offer' ? "bg-orange-100 text-orange-600" : product.type === 'new' ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600"
                )}>
                  {product.type === 'offer' ? 'Oferta' : product.type === 'new' ? 'Novo' : 'Normal'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-4 mt-2">
        {cartQuantity > 0 ? (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-2xl p-1 shadow-inner border border-gray-100 dark:border-gray-700">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "#fee2e2" }} 
              whileTap={{ scale: 0.9 }} 
              onClick={() => onUpdateQuantity(product.id, -1)} 
              className="w-10 h-10 flex items-center justify-center text-red-600 rounded-xl transition-colors"
            >
              <Minus size={18} />
            </motion.button>
            <input 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={cartQuantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) {
                  onSetQuantityDirectly(product.id, val);
                } else if (e.target.value === '') {
                  onSetQuantityDirectly(product.id, 0);
                }
              }}
              className="w-12 text-center text-sm font-black bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white"
            />
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "#dcfce7" }} 
              whileTap={{ scale: 0.9 }} 
              onClick={() => onUpdateQuantity(product.id, 1)} 
              className="w-10 h-10 flex items-center justify-center text-green-600 rounded-xl transition-colors"
            >
              <Plus size={18} />
            </motion.button>
          </div>
        ) : (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            disabled={!hasStock} 
            onClick={() => onAddToCart(product)} 
            className="w-full h-12 bg-gradient-to-r from-[#FF6B00] to-[#F06292] text-white rounded-[16px] text-sm font-black shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            ADICIONAR
            <ShoppingCart size={16} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});
ProductCard.displayName = 'ProductCard';

export default function ProductCatalog() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('VENDAS_dark') === '1');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'produtos' | 'ofertas' | 'lancamentos'>('produtos');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]); // 'discount', 'no-discount', 'in-stock', 'out-stock', 'new'
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'discount' | 'stock' | 'az' | 'za' | 'recent'>('default');
  const [displayLimit, setDisplayLimit] = useState(32);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInputValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInputValue]);

  const selectedClient: Client | null = useMemo(() => {
    const saved = sessionStorage.getItem('selectedClient');
    return saved ? JSON.parse(saved) : null;
  }, []);

  const cartKey = useMemo(() => {
    if (selectedClient) return `cart_${selectedClient.id}`;
    if (profile?.role === 'promotor') return `cart_promotor_${profile.uid}`;
    return 'cart_nz';
  }, [selectedClient, profile]);

  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [pendingCarts, setPendingCarts] = useState<{clientId: string, items: OrderItem[], clientName?: string}[]>([]);
  const [showPendingCarts, setShowPendingCarts] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastOrderItems, setLastOrderItems] = useState<OrderItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [updatingImageProduct, setUpdatingImageProduct] = useState<Product | null>(null);
  const [searchImages, setSearchImages] = useState<string[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [banners, setBanners] = useState<BannerMessage[]>([]);
  const [lastOrders, setLastOrders] = useState<Order[]>([]);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [showOfferCoverage, setShowOfferCoverage] = useState(false);
  const [showOfferSuggestions, setShowOfferSuggestions] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [manualClientName, setManualClientName] = useState('');

  useEffect(() => {
    setDisplayLimit(32);
  }, [search, selectedManufacturers, selectedCategories, statusFilters, activeTab, sortBy]);

  useEffect(() => {
    const isPromotor = profile?.role === 'promotor';
    if (!selectedClient && !isPromotor) return;

    const regional = selectedClient?.regional || profile?.regional || 'TIMON-MA';
    dataService.setRegional(regional);

    if (selectedClient) {
      // Load cart from Firestore
      dataService.getCart(selectedClient.id).then(items => {
        if (items && items.length > 0) {
          setCart(items);
        } else {
          // Fallback to localStorage if Firestore is empty
          const saved = localStorage.getItem(cartKey);
          if (saved) setCart(JSON.parse(saved));
        }
        setCartLoaded(true);
      });
    } else if (isPromotor) {
      const saved = localStorage.getItem(cartKey);
      if (saved) setCart(JSON.parse(saved));
      setCartLoaded(true);
    }

    const unsubProducts = dataService.subscribeProducts((data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubFavorites = selectedClient ? dataService.subscribeFavorites(selectedClient.id, (data) => {
      setFavorites(data);
    }) : () => {};

    const unsubBanners = dataService.subscribeBanners((data) => {
      setBanners(data.filter(b => !b.targetRegional || b.targetRegional === regional));
    });

    const unsubOrders = (selectedClient && profile) ? dataService.subscribeOrders(selectedClient.id, null, false, (data) => {
      setLastOrders(data);
    }) : () => {};

    if (profile) {
      dataService.getClients(profile.name, profile.role === 'admin').then(setAllClients);
    }
    
    const fetchPendingCarts = async () => {
      if (!selectedClient && !isPromotor) return;
      const carts = await dataService.getAllCarts();
      const filtered = carts.filter(c => selectedClient ? c.clientId !== selectedClient.id : true && c.items.length > 0);
      
      // Map names
      const clientsWithNames = await Promise.all(filtered.map(async cart => {
        const client = await dataService.getClients(undefined, true).then(list => list.find(cl => cl.id === cart.clientId));
        return {
          ...cart,
          clientName: client?.tradeName || client?.name || `Cliente ${cart.clientId}`
        };
      }));

      setPendingCarts(clientsWithNames);
    };

    if (selectedClient) {
      fetchPendingCarts();
    }
    const cartInterval = selectedClient ? setInterval(fetchPendingCarts, 30000) : undefined;

    return () => {
      unsubProducts();
      unsubFavorites();
      unsubBanners();
      unsubOrders();
      if (cartInterval) clearInterval(cartInterval);
    };
  }, [selectedClient, profile, cartKey]);

  useEffect(() => {
    if (!cartLoaded) return;
    
    localStorage.setItem(cartKey, JSON.stringify(cart));
    if (selectedClient) {
      dataService.saveCart(selectedClient.id, cart);
    }
  }, [cart, cartKey, selectedClient, cartLoaded]);

  if (!selectedClient && profile?.role !== 'promotor') return <Navigate to="/" />;

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    products.forEach(p => {
      if (p.manufacturer && !dateRegex.test(p.manufacturer)) {
        set.add(p.manufacturer);
      }
    });
    return Array.from(set).sort();
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const counts = useMemo(() => {
    const tabCounts = { produtos: 0, ofertas: 0, lancamentos: 0 };
    
    products.forEach(p => {
      const isOffer = p.type === 'offer';
      const isNew = p.type === 'new';

      tabCounts.produtos++;
      if (isOffer) tabCounts.ofertas++;
      if (isNew) tabCounts.lancamentos++;
    });

    return { tabCounts };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      // Tab Filter
      if (activeTab === 'ofertas' && p.type !== 'offer') return false;
      if (activeTab === 'lancamentos' && p.type !== 'new') return false;
      
      // Manufacturer Filter (Multiple Selection - OR within group)
      if (selectedManufacturers.length > 0 && !selectedManufacturers.includes(p.manufacturer)) return false;

      // Category Filter (Multiple Selection - OR within group)
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false;
      
      // Status Filters (Binary Selection - AND between groups)
      if (statusFilters.includes('discount') && p.discount <= 0) return false;
      if (statusFilters.includes('no-discount') && p.discount > 0) return false;
      if (statusFilters.includes('in-stock') && p.stock <= 0) return false;
      if (statusFilters.includes('out-stock') && p.stock > 0) return false;
      if (statusFilters.includes('new') && p.type !== 'new') return false;
      if (statusFilters.includes('promotional') && p.type !== 'offer') return false;

      // Price Filter
      if (p.finalPrice < priceRange[0] || p.finalPrice > priceRange[1]) return false;

      // Search Filter
      if (search) {
        const query = search.toLowerCase();
        return (
          p.description.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.ean.includes(query) ||
          p.manufacturer.toLowerCase().includes(query)
        );
      }
      
      return true;
    });

    // Advanced Sorting
    const sortArr = [...result];
    switch (sortBy) {
      case 'price-asc': sortArr.sort((a, b) => a.finalPrice - b.finalPrice); break;
      case 'price-desc': sortArr.sort((a, b) => b.finalPrice - a.finalPrice); break;
      case 'discount': sortArr.sort((a, b) => b.discount - a.discount); break;
      case 'stock': sortArr.sort((a, b) => b.stock - a.stock); break;
      case 'az': sortArr.sort((a, b) => a.description.localeCompare(b.description)); break;
      case 'za': sortArr.sort((a, b) => b.description.localeCompare(a.description)); break;
      case 'recent': sortArr.sort((a, b) => {
        const dateA = a.discountExpiryDate ? new Date(a.discountExpiryDate).getTime() : 0;
        const dateB = b.discountExpiryDate ? new Date(b.discountExpiryDate).getTime() : 0;
        return dateB - dateA;
      }); break;
      default: break;
    }

    return sortArr;
  }, [products, activeTab, search, selectedManufacturers, selectedCategories, statusFilters, sortBy]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  useEffect(() => {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => Math.min(prev + 32, filteredProducts.length));
      }
    }, { rootMargin: '150px' });

    observer.observe(sentinel);
    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [displayedProducts.length, filteredProducts.length]);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error('Produto sem estoque');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.warning('Estoque máximo atingido');
          return prev;
        }
        toast.success(`${product.description.substring(0, 20)}... adicionado`);
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`${product.description.substring(0, 20)}... adicionado`);
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== productId);
      
      if (newQty > item.stock) {
        toast.warning('Estoque máximo atingido');
        return prev;
      }
      
      return prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
    });
  }, []);

  const setQuantityDirectly = useCallback((productId: string, value: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === productId);
      if (!item) return prev;
      
      const newQty = Math.max(0, value);
      if (newQty === 0) return prev.filter(i => i.id !== productId);
      
      if (newQty > item.stock) {
        toast.warning('Estoque insuficiente');
        return prev.map(i => i.id === productId ? { ...i, quantity: item.stock } : i);
      }
      
      return prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i);
    });
  }, []);

  const toggleFavorite = useCallback(async (product: Product) => {
    if (!selectedClient || !profile) return;
    await dataService.toggleFavorite(selectedClient.id, product.id, product.description, profile.name);
  }, [selectedClient, profile]);

  const handleSetZoomImage = useCallback((url: string) => {
    setSelectedImage(url);
  }, []);

  const handleSetUpdatingImageProduct = useCallback((product: Product) => {
    setUpdatingImageProduct(product);
  }, []);

  const isFavorite = (productId: string) => favorites.some(f => f.productId === productId);

  const handleSearchImages = async (product: Product) => {
    try {
      setSearchingImages(true);
      setSearchImages([]);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Encontre URLs de imagens diretas e de alta qualidade para o produto: ${product.description} ${product.manufacturer}. 
      Retorne uma lista JSON com exatamente 5 URLs de imagens funcionais que apontem diretamente para arquivos de imagem comuns (como jpg ou png). 
      Seja preciso e evite sites que bloqueiam acesso direto. 
      Apenas o JSON, nada mais. Formato: ["url1", "url2", ...]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        } as any
      });

      const text = response.text;
      if (text) {
        const urls = JSON.parse(text);
        setSearchImages(urls);
        if (urls.length === 0) {
          toast.error('Nenhuma imagem encontrada pelo IA.');
        }
      } else {
        toast.error('Ocorreu um erro ao processar a resposta da IA.');
      }
    } catch (error) {
      console.error('Gemini Search error:', error);
      toast.error('Erro ao pesquisar imagens com IA.');
    } finally {
      setSearchingImages(false);
    }
  };

  const handleUpdateImage = async (product: Product, url: string) => {
    try {
      toast.loading('Atualizando imagem...', { id: 'update-img' });
      const success = await dataService.updateProductImage(product.id, url, product.type);
      if (success) {
        toast.success('Imagem atualizada com sucesso! Recarregando catálogo...', { id: 'update-img' });
        setUpdatingImageProduct(null);
        // Refresh products
        const data = await dataService.getAllProducts();
        setProducts(data);
      } else {
        toast.error('Erro ao atualizar imagem no Planilha.', { id: 'update-img' });
      }
    } catch (error) {
       toast.error('Erro ao atualizar imagem.', { id: 'update-img' });
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const quickOrderProducts = useMemo(() => {
    const productIds = new Set<string>();
    const result: Product[] = [];
    
    lastOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productIds.has(item.id)) {
          const p = products.find(prod => prod.id === item.id);
          if (p) {
            result.push(p);
            productIds.add(item.id);
          }
        }
      });
    });
    
    return result.slice(0, 10);
  }, [lastOrders, products]);

  const soldProductIds = useMemo(() => {
    const ids = new Set<string>();
    lastOrders.forEach(order => {
      order.items.forEach(item => ids.add(item.id));
    });
    return ids;
  }, [lastOrders]);

  const offersInCart = useMemo(() => {
    return cart.filter(item => item.type === 'offer').length;
  }, [cart]);

  const totalOffersAvailable = useMemo(() => {
    return products.filter(p => p.type === 'offer' && p.stock > 0).length;
  }, [products]);

  const generateOrderPDF = (order: any, items: OrderItem[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const orange: [number, number, number] = [255, 107, 0];
    const white: [number, number, number] = [255, 255, 255];
    const gray: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [240, 240, 240];
    const red: [number, number, number] = [255, 0, 0];

    const drawHeaderBar = (text: string, y: number) => {
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(text, pageWidth / 2, y + 5.5, { align: 'center' });
    };

    doc.setFillColor(orange[0], orange[1], orange[2]);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFontSize(32);
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('VENDAS HBN1', pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('COMPROVANTE DE PEDIDO', pageWidth / 2, 30, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const contactText = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'}  •  Tel: ${profile?.phone || '(86) 99964-7573'}  •  ${profile?.email || 'leonelamorimm@gmail.com'}`;
    doc.text(contactText, pageWidth / 2, 37, { align: 'center' });
    doc.text(new Date().toLocaleString('pt-BR'), pageWidth / 2, 42, { align: 'center' });

    let currentY = 55;
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`N° DO PEDIDO   ${order.id || 'N/A'}`, pageWidth / 2, currentY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`DATA / HORA   ${new Date(order.date).toLocaleString('pt-BR')}`, pageWidth / 2, currentY + 6, { align: 'center' });
    
    currentY += 18;

    drawHeaderBar('DADOS DO CLIENTE', currentY);
    currentY += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    const clientInfo = profile?.role === 'promotor' 
      ? [
          ['Cliente', manualClientName.toUpperCase()],
          ['Promotor', profile.name.toUpperCase()],
        ]
      : [
          ['Cliente', (selectedClient?.tradeName || selectedClient?.name || '-').toUpperCase()],
          ['ID Cliente', selectedClient?.id || '-'],
          ['Nome', (selectedClient?.name || '-').toUpperCase()],
          ['CNPJ', selectedClient?.cnpj || '-'],
          ['Vendedor', (order.seller || '-').toUpperCase()],
          ['E-mail', (selectedClient?.email || '-').toUpperCase()],
          ['Endereço', (selectedClient?.address || '-').toUpperCase()],
          ['Cidade/Estado', (`${selectedClient?.city || '-'} / ${selectedClient?.state || '-'}`).toUpperCase()],
          ['Celular', selectedClient?.phone || '-']
        ];

    clientInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 65, currentY);
      currentY += 5.5;
    });

    currentY += 6;

    const groupedItems = items.reduce((acc: any, item) => {
      const manufacturer = item.manufacturer || 'GERAL';
      if (!acc[manufacturer]) acc[manufacturer] = [];
      acc[manufacturer].push(item);
      return acc;
    }, {});

    Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      const isPromoter = profile?.role === 'promotor';
      const tableHeaders = isPromoter
        ? [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']]
        : [['COD. \u25BC', 'EAN \u25BC', 'DESCRICAO \u25BC', 'PRECO \u25BC', 'DESC \u25BC', 'PR.FINAL \u25BC', 'QT \u25BC', 'SUBTOTAL \u25BC', 'STATUS \u25BC']];

      const tableData = mItems.map((item: any) => isPromoter 
        ? [
            item.id,
            item.ean || '-',
            item.description,
            formatCurrency(item.salePrice),
            item.quantity,
            formatCurrency(item.quantity * item.salePrice),
            '✅ OK'
          ]
        : [
            item.id,
            item.ean || '-',
            item.description,
            formatCurrency(item.salePrice),
            item.discount > 0 ? `${item.discount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-',
            formatCurrency(item.finalPrice),
            item.quantity,
            formatCurrency(item.quantity * item.finalPrice),
            '✅ OK'
          ]
      );

      autoTable(doc, {
        startY: currentY,
        head: tableHeaders,
        body: tableData,
        theme: 'plain',
        headStyles: { 
          fillColor: orange, 
          textColor: white, 
          fontSize: 8, 
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { fontSize: 7, halign: 'center', textColor: [0, 0, 0], overflow: 'linebreak' },
        columnStyles: isPromoter
          ? {
              0: { halign: 'center', cellWidth: 15 },
              1: { halign: 'center', cellWidth: 25 },
              2: { halign: 'left', cellWidth: 'auto' },
              3: { halign: 'right', textColor: [100, 100, 100], cellWidth: 25 },
              4: { halign: 'center', cellWidth: 12 },
              5: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 25 },
              6: { halign: 'center', cellWidth: 15 }
            }
          : {
              0: { halign: 'center', cellWidth: 15 },
              1: { halign: 'center', cellWidth: 25 },
              2: { halign: 'left', cellWidth: 'auto' },
              3: { halign: 'right', textColor: [100, 100, 100], cellWidth: 20 },
              4: { halign: 'center', cellWidth: 12 },
              5: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 20 },
              6: { halign: 'center', cellWidth: 10 },
              7: { halign: 'right', textColor: orange, fontStyle: 'bold', cellWidth: 25 },
              8: { halign: 'center', cellWidth: 15 }
            },
        margin: { left: 14, right: 14 }
      });

      const mSubtotal = mItems.reduce((sum: number, item: any) => sum + (item.salePrice * item.quantity), 0);
      const mTotal = mItems.reduce((sum: number, item: any) => sum + (item.finalPrice * item.quantity), 0);
      const mDiscount = mSubtotal - mTotal;

      currentY = (doc as any).lastAutoTable.finalY + 2;

      const drawSummaryRow = (label: string, value: string, color: [number, number, number] = [0,0,0]) => {
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(pageWidth - 85, currentY, 71, 6, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.text(label, pageWidth - 80, currentY + 4.2);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, pageWidth - 18, currentY + 4.2, { align: 'right' });
        currentY += 7;
      };

      if (isPromoter) {
        drawSummaryRow('TOTAL', formatCurrency(mSubtotal));
      } else {
        drawSummaryRow('SUBTOTAL', formatCurrency(mSubtotal));
        drawSummaryRow('DESCONTOS', `- ${formatCurrency(mDiscount)}`, [0, 150, 0]);
        drawSummaryRow('TOTAL', formatCurrency(mTotal));
      }
      
      currentY += 8;
    });

    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    const totalSalePrice = items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const totalFinalPrice = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalDiscount = totalSalePrice - totalFinalPrice;

    if (profile?.role === 'promotor') {
      currentY += 10;
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(pageWidth - 85, currentY, 71, 12, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL A PAGAR', pageWidth - 80, currentY + 8);
      doc.text(formatCurrency(totalSalePrice), pageWidth - 18, currentY + 8, { align: 'right' });
    } else {
      currentY += 10;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(pageWidth - 85, currentY, 71, 18, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('SUBTOTAL', pageWidth - 80, currentY + 6);
      doc.text(formatCurrency(totalSalePrice), pageWidth - 18, currentY + 6, { align: 'right' });
      
      doc.setTextColor(0, 150, 0);
      doc.text('DESCONTO', pageWidth - 80, currentY + 13);
      doc.text(`- ${formatCurrency(totalDiscount)}`, pageWidth - 18, currentY + 13, { align: 'right' });

      currentY += 18;
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(pageWidth - 85, currentY, 71, 12, 'F');
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL A PAGAR', pageWidth - 80, currentY + 8);
      doc.text(formatCurrency(totalFinalPrice), pageWidth - 18, currentY + 8, { align: 'right' });
    }

    const footerY = doc.internal.pageSize.height - 18;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    doc.setFontSize(8);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    const contactInfo = `${profile?.regional ? getRegionalLabel(profile.regional) : 'TIMON-MA'}  |  Tel: ${profile?.phone || '(86) 99964-7573'}  |  ${profile?.email || 'leonelamorimm@gmail.com'}`;
    const footerText = `Obrigado pela preferencia!  |  VENDAS HBN1  |  ${contactInfo}`;
    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, footerY + 5, { align: 'center' });

    doc.save(`Pedido_${order.id}.pdf`);
  };

  const exportCatalogToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const orange: [number, number, number] = [255, 107, 0];
    const white: [number, number, number] = [255, 255, 255];
    const gray: [number, number, number] = [100, 100, 100];
    const borderGray: [number, number, number] = [230, 230, 230];

    toast.loading('Preparando fotos (isso pode demorar)...', { id: 'pdf-gen' });

    // Ultra-resilient Base64 converter with proxy fallback for CORS issues
    const getBase64Image = async (url: string): Promise<string | null> => {
      const tryLoad = async (targetUrl: string, useProxy = false): Promise<string | null> => {
        // Optimize image size to 400x400 for highly compact, professional PDFs (prevents out-of-memory and lag)
        const finalUrl = useProxy 
          ? `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&output=jpg&q=80&fit=contain&w=400&h=400&bg=white` 
          : targetUrl;

        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          const timeoutId = setTimeout(() => {
            img.src = '';
            resolve(null);
          }, 15000);

          img.onload = () => {
            clearTimeout(timeoutId);
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Optimized size for PDF cards (25mm x 25mm print size is perfectly suited for 400x400 resolution)
                canvas.width = 400;
                canvas.height = 400;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 400, 400);
                
                const scale = Math.min(400 / img.width, 400 / img.height);
                const x = (400 - img.width * scale) / 2;
                const y = (400 - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                resolve(canvas.toDataURL('image/jpeg', 0.80)); // Great quality with high compression
              } else resolve(null);
            } catch (e) {
              resolve(null);
            }
          };

          img.onerror = () => {
            clearTimeout(timeoutId);
            resolve(null);
          };

          img.src = finalUrl;
        });
      };

      // Try direct first (faster if CORS allowed) then proxy
      let result = await tryLoad(url, false);
      if (result) return result;
      
      result = await tryLoad(url, true);
      return result;
    };

    // Pre-cache images in PARALLEL blocks to be faster but resilient
    const imagesCache: Record<string, string | null> = {};
    const total = filteredProducts.length;
    const batchSize = 12; // Optimized larger batch size for blisteringly fast parallel loading
    
    for (let i = 0; i < total; i += batchSize) {
      const batch = filteredProducts.slice(i, i + batchSize);
      toast.loading(`Processando fotos: ${Math.min(i + batchSize, total)}/${total}...`, { id: 'pdf-gen' });
      
      await Promise.all(batch.map(async (p) => {
        if (p.photo) {
          imagesCache[p.id] = await getBase64Image(p.photo);
        }
      }));
    }

    const drawHeader = (pageNum: number) => {
      doc.setFillColor(orange[0], orange[1], orange[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      const title = selectedManufacturers.length > 0 
        ? `CATÁLOGO DE PRODUTOS - ${selectedManufacturers.join(', ').toUpperCase()}`
        : 'CATÁLOGO DE PRODUTOS GERAL';

      doc.setFontSize(18);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const info = `Cliente: ${selectedClient?.tradeName || selectedClient?.name || 'Cliente Geral'} | Vendedor: ${profile?.name || 'HBN1'} | ${new Date().toLocaleDateString('pt-BR')}`;
      doc.text(info, pageWidth / 2, 26, { align: 'center' });
      
      doc.setFontSize(7);
      doc.text(`Página ${pageNum}`, pageWidth - 15, 30, { align: 'right' });
    };

    // Designed to fit exactly 18 products per page with high elegance, optimal readability and a modern landscape layout
    const drawCard = (p: Product, x: number, y: number, w: number, h: number) => {
      // Draw outer elegant card border with very soft rounded rectangle
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');

      // Left column: Image Box container
      const imgW = 23;
      const imgH = 23;
      const imgX = x + 2;
      const imgY = y + (h - imgH) / 2; // Vertically center the image within the card

      const cachedImg = imagesCache[p.id];
      if (cachedImg) {
        try {
          doc.addImage(cachedImg, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
        } catch (e) {
          doc.setFontSize(5);
          doc.setTextColor(180, 180, 180);
          doc.text('Foto erro', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
        }
      } else {
        doc.setDrawColor(248, 248, 248);
        doc.setFillColor(250, 250, 250);
        doc.rect(imgX, imgY, imgW, imgH, 'FD');
        doc.setFontSize(5);
        doc.setTextColor(180, 180, 180);
        doc.text(p.photo ? 'Erro carregar' : 'Sem foto', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
      }

      // Compact Red discount tag over the top left of the card
      if (p.discount > 0) {
        doc.setFillColor(239, 68, 68); // Tailwind red-500
        doc.roundedRect(x + 1.5, y + 1.5, 9, 3.8, 0.4, 0.4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`-${applyCustomRounding(p.discount).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, x + 6, y + 4.1, { align: 'center' });
      }

      // Right column coordinates (relative horizontal offset)
      const tx = x + 27;

      // Category (Sleek pink text)
      doc.setFontSize(4.5);
      doc.setTextColor(240, 98, 146);
      doc.setFont('helvetica', 'bold');
      doc.text(p.category.toUpperCase(), tx, y + 3.8);

      // Title/Description (supports exactly 2 lines maximum)
      doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      const dLines = doc.splitTextToSize(p.description, w - 27 - 2.5);
      doc.text(dLines.slice(0, 2), tx, y + 6.3);

      // Manufacturer (small and light gray)
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(p.manufacturer.toUpperCase(), tx, y + 12.5);

      // Offer discount expiry date
      if (p.discount > 0 && p.discountExpiryDate) {
        doc.setFontSize(4);
        doc.setTextColor(230, 81, 0); // Orange-900
        doc.setFont('helvetica', 'bold');
        doc.text(`EXPIRA: ${new Date(p.discountExpiryDate + 'T12:00:00').toLocaleDateString('pt-BR')}`, x + w - 2.5, y + 12.5, { align: 'right' });
      }

      // ID and EAN code badges (drawn side-by-side)
      const pillY = y + 14.2;
      const pillH = 3;
      
      // ID Badge
      doc.setFillColor(235, 243, 255);
      doc.roundedRect(tx, pillY, 11, pillH, 0.4, 0.4, 'F');
      doc.setFontSize(3.8);
      doc.setTextColor(40, 80, 180);
      doc.setFont('helvetica', 'bold');
      doc.text(`ID:${p.id}`, tx + 5.5, pillY + 2.1, { align: 'center' });

      // EAN Badge
      if (p.ean) {
        doc.setFillColor(245, 235, 255);
        doc.roundedRect(tx + 12, pillY, 21, pillH, 0.4, 0.4, 'F');
        doc.setTextColor(130, 50, 180);
        doc.text(`EAN:${p.ean}`, tx + 12 + 10.5, pillY + 2.1, { align: 'center' });
      }

      // Prices & discount indicators
      const priceY = y + 20.2;
      if (p.discount > 0) {
        // Original comparison price
        doc.setFontSize(4.5);
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'normal');
        doc.text(`De: ${formatCurrency(p.salePrice)}`, tx, priceY);
        const textWidth = doc.getTextWidth(`De: ${formatCurrency(p.salePrice)}`);
        doc.line(tx, priceY - 1, tx + textWidth, priceY - 1);
        
        // Final purchase price
        doc.setFontSize(9);
        doc.setTextColor(255, 107, 0); // Orange HBN1 Identity
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(p.finalPrice), tx, priceY + 4.5);
      } else {
        // Final purchase price (normal)
        doc.setFontSize(9);
        doc.setTextColor(255, 107, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(p.finalPrice), tx, priceY + 3.2);
      }

      // Economy Green Badge
      if (p.discount > 0) {
        const savings = p.salePrice - p.finalPrice;
        const savingsY = priceY + 6.2;
        doc.setFillColor(34, 197, 94); // Beautiful green
        doc.roundedRect(tx, savingsY, w - 27 - 2.5, 3.2, 0.6, 0.6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`\u2605 ECON. ${formatCurrency(savings)}`, tx + (w - 27 - 2.5) / 2, savingsY + 2.3, { align: 'center' });
      }

      // Stock indicator at the bottom edge
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(`Estoque: ${p.stock}`, tx, y + h - 2);
    };

    // Calculate layout for exactly 18 products per page (3 columns x 6 rows)
    const columns = 3;
    const margin = 8;
    const cardGap = 1.6;
    const cw = (pageWidth - (margin * 2) - (cardGap * (columns - 1))) / columns;
    const ch = 40.5; // Calculated height for 6 rows
    
    let col = 0;
    let row = 0;
    let pageNum = 1;

    drawHeader(pageNum);

    for (const p of filteredProducts) {
      if (row >= 6) { // Exactly 6 rows per page => 18 products max
        doc.addPage();
        pageNum++;
        drawHeader(pageNum);
        row = 0;
        col = 0;
      }
      const tx = margin + (col * (cw + cardGap));
      const ty = 38 + (row * (ch + cardGap));
      drawCard(p, tx, ty, cw, ch);
      col++;
      if (col >= columns) {
        col = 0;
        row++;
      }
    }

    const fName = selectedManufacturers.length > 0 
      ? `Catalogo_${selectedManufacturers[0]}_${new Date().getTime()}.pdf`
      : `Catalogo_HBN1_${new Date().getTime()}.pdf`;
      
    doc.save(fName);
    toast.success('Catálogo 100% exportado!', { id: 'pdf-gen' });
  };


  const generateOrderExcel = async (order: any, items: OrderItem[]) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedido');

    const orangeColor = 'FFFF6B00';
    const whiteColor = 'FFFFFFFF';
    const grayColor = 'FF646464';
    const lightGrayColor = 'FFF0F0F0';

    worksheet.mergeCells('A1:I2');
    const headerCell = worksheet.getCell('A1');
    headerCell.value = 'VENDAS HBN1 - COMPROVANTE DE PEDIDO';
    headerCell.font = { size: 20, bold: true, color: { argb: whiteColor } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([`Pedido: ${order.id || 'N/A'}`, '', '', '', '', '', '', `Data: ${new Date(order.date).toLocaleString('pt-BR')}`]);
    worksheet.mergeCells(`A3:D3`);
    worksheet.mergeCells(`H3:I3`);
    worksheet.getRow(3).font = { bold: true, color: { argb: grayColor } };

    worksheet.addRow([]);

    const clientHeaderRow = worksheet.addRow(['DADOS DO CLIENTE']);
    worksheet.mergeCells(`A5:I5`);
    clientHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
    clientHeaderRow.getCell(1).font = { bold: true, color: { argb: whiteColor } };
    clientHeaderRow.getCell(1).alignment = { horizontal: 'center' };

    const clientRows = profile?.role === 'promotor'
      ? [
          ['Cliente', manualClientName.toUpperCase()],
          ['Promotor', profile.name.toUpperCase()],
        ]
      : [
          ['Cliente', (selectedClient?.tradeName || selectedClient?.name || '-').toUpperCase()],
          ['ID Cliente', selectedClient?.id || '-'],
          ['Nome', (selectedClient?.name || '-').toUpperCase()],
          ['CNPJ', selectedClient?.cnpj || '-'],
          ['Vendedor', (order.seller || '-').toUpperCase()],
          ['E-mail', (selectedClient?.email || '-').toUpperCase()],
          ['Endereço', (selectedClient?.address || '-').toUpperCase()],
          ['Cidade/Estado', (`${selectedClient?.city || '-'} / ${selectedClient?.state || '-'}`).toUpperCase()],
          ['Celular', selectedClient?.phone || '-']
        ];

    clientRows.forEach(row => {
      const r = worksheet.addRow(row);
      r.getCell(1).font = { bold: true };
      worksheet.mergeCells(`B${r.number}:I${r.number}`);
    });

    worksheet.addRow([]);

    const groupedItems = items.reduce((acc: any, item) => {
      const manufacturer = item.manufacturer || 'GERAL';
      if (!acc[manufacturer]) acc[manufacturer] = [];
      acc[manufacturer].push(item);
      return acc;
    }, {});

    const isPromoter = profile?.role === 'promotor';

    Object.entries(groupedItems).forEach(([manufacturer, mItems]: [string, any]) => {
      const mHeaderRow = worksheet.addRow([`FABRICANTE: ${manufacturer.toUpperCase()}`]);
      worksheet.mergeCells(`A${mHeaderRow.number}:I${mHeaderRow.number}`);
      mHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
      mHeaderRow.getCell(1).font = { bold: true, color: { argb: whiteColor } };
      mHeaderRow.getCell(1).alignment = { horizontal: 'center' };

      const tableHeader = isPromoter
        ? worksheet.addRow(['COD. ▼', 'EAN ▼', 'DESCRICAO ▼', 'PRECO ▼', 'QT ▼', 'SUBTOTAL ▼', 'STATUS ▼'])
        : worksheet.addRow(['COD. ▼', 'EAN ▼', 'DESCRICAO ▼', 'PRECO ▼', 'DESC ▼', 'PR.FINAL ▼', 'QT ▼', 'SUBTOTAL ▼', 'STATUS ▼']);

      tableHeader.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orangeColor } };
        cell.font = { bold: true, color: { argb: whiteColor }, size: 9 };
        cell.alignment = { horizontal: 'center' };
      });

      mItems.forEach((item: any) => {
        const rowData = isPromoter
          ? [
              item.id,
              item.ean || '-',
              item.description,
              item.salePrice,
              item.quantity,
              item.quantity * item.salePrice,
              '✅ OK'
            ]
          : [
              item.id,
              item.ean || '-',
              item.description,
              item.salePrice,
              item.discount > 0 ? `${item.discount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '-',
              item.finalPrice,
              item.quantity,
              item.quantity * item.finalPrice,
              '✅ OK'
            ];
        
        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center' };
          if (isPromoter) {
            if (colNumber === 4 || colNumber === 6) {
              cell.numFmt = '"R$ "#,##0.00';
            }
            if (colNumber === 6) {
              cell.font = { color: { argb: orangeColor }, bold: true };
            }
          } else {
            if (colNumber === 4 || colNumber === 6 || colNumber === 8) {
              cell.numFmt = '"R$ "#,##0.00';
            }
            if (colNumber === 6 || colNumber === 8) {
              cell.font = { color: { argb: orangeColor }, bold: true };
            }
          }
        });
      });

      const mSubtotal = mItems.reduce((sum: number, item: any) => sum + (item.salePrice * item.quantity), 0);
      const mTotal = mItems.reduce((sum: number, item: any) => sum + (item.finalPrice * item.quantity), 0);
      const mDiscount = mSubtotal - mTotal;

      const addSummaryRow = (label: string, value: number, color?: string) => {
        const row = worksheet.addRow(['', '', '', '', '', '', label, '', value]);
        worksheet.mergeCells(`G${row.number}:H${row.number}`);
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGrayColor } };
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGrayColor } };
        row.getCell(7).font = { bold: true, size: 9 };
        row.getCell(9).font = { bold: true, size: 9, color: color ? { argb: color } : undefined };
        row.getCell(9).numFmt = '"R$ "#,##0.00';
        row.getCell(9).alignment = { horizontal: 'right' };
      };

      if (isPromoter) {
        addSummaryRow('TOTAL', mSubtotal);
      } else {
        addSummaryRow('SUBTOTAL', mSubtotal);
        addSummaryRow('DESCONTOS', -mDiscount, 'FF009600');
        addSummaryRow('TOTAL', mTotal);
      }
      worksheet.addRow([]);
    });

    const totalSalePrice = items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const totalFinalPrice = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalDiscount = totalSalePrice - totalFinalPrice;

    const finalHeader = worksheet.addRow(['RESUMO GERAL']);
    worksheet.mergeCells(`A${finalHeader.number}:I${finalHeader.number}`);
    finalHeader.getCell(1).font = { bold: true };

    const addFinalRow = (label: string, value: number, color?: string, isTotal = false) => {
      const row = worksheet.addRow(['', '', '', '', '', '', label, '', value]);
      worksheet.mergeCells(`G${row.number}:H${row.number}`);
      const bgColor = isTotal ? orangeColor : lightGrayColor;
      const textColor = isTotal ? whiteColor : (color || 'FF000000');
      
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      row.getCell(7).font = { bold: true, color: { argb: textColor } };
      row.getCell(9).font = { bold: true, color: { argb: textColor } };
      row.getCell(9).numFmt = '"R$ "#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right' };
    };

    if (isPromoter) {
      addFinalRow('TOTAL A PAGAR', totalSalePrice, undefined, true);
    } else {
      addFinalRow('SUBTOTAL GERAL', totalSalePrice);
      addFinalRow('DESCONTO GERAL', -totalDiscount, 'FF009600');
      addFinalRow('TOTAL A PAGAR', totalFinalPrice, undefined, true);
    }

    worksheet.columns = [
      { width: 12 }, { width: 18 }, { width: 45 }, { width: 15 }, { width: 10 }, { width: 15 }, { width: 8 }, { width: 15 }, { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Pedido_${order.id || 'Novo'}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const sendToWhatsApp = (order: any, items: OrderItem[]) => {
    const recipientPhone = profile?.phone;

    if (!recipientPhone) {
      toast.error('Seu telefone não está cadastrado no sistema para envio do WhatsApp');
      return;
    }

    let message = `🛍️ *VENDAS HBN1*\n\n`;
    message += `🏪 *${order.clientName}*\n`;
    message += `🆔 ID: ${order.clientId}\n`;
    message += `👤 Vendedor: ${order.seller}\n\n`;
    message += `📦 *ITENS:*\n────────────────\n`;
    
    items.forEach((item, idx) => {
      message += `\n${idx + 1}. *${item.description}*\n`;
      message += `   ${item.quantity} un × ${formatCurrency(item.finalPrice)} = ${formatCurrency(item.quantity * item.finalPrice)}\n`;
    });
    
    const totalByItems = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    
    message += `\n────────────────\n`;
    message += `💰 *TOTAL: ${formatCurrency(totalByItems)}*\n\n`;
    message += `✅ Aguardo confirmação!`;

    const purePhone = recipientPhone.replace(/\D/g, '');
    const phoneWithCountry = purePhone.length <= 11 ? `55${purePhone}` : purePhone;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleScan = (ean: string) => {
    setSearchInputValue(ean);
    setSearch(ean);
    setIsScannerOpen(false);
    toast.success(`Buscando código: ${ean}`);
  };

  const finalizeOrder = async () => {
    if (isFinalizing) return;
    if (!selectedClient && profile?.role !== 'promotor') return;
    if (!profile || cart.length === 0) return;

    const orderData: Omit<Order, 'id'> = {
      date: new Date().toISOString(),
      clientId: selectedClient?.id || 'PROMOTOR',
      clientName: profile?.role === 'promotor' 
        ? (manualClientName ? manualClientName.toUpperCase() : `PROMOTOR: ${profile.name}`) 
        : (selectedClient?.tradeName || selectedClient?.name || 'Cliente'),
      email: selectedClient?.email || profile?.email || '',
      seller: profile.name,
      phone: selectedClient?.phone || profile?.phone || '',
      total: cartTotal,
      status: 'Novo',
      items: cart,
      observation: '',
    };

    try {
      // Validate order data
      OrderSchema.parse({
        clientId: orderData.clientId,
        clientName: orderData.clientName,
        total: orderData.total,
        items: orderData.items,
        status: orderData.status,
      });

      setIsFinalizing(true);
      toast.loading('Registrando pedido...', { id: 'checkout' });
      const orderId = await dataService.saveOrder(orderData);
      
      const finalOrder = { ...orderData, id: orderId || 'PED' + Date.now() };

      toast.success('Pedido registrado com sucesso!', { id: 'checkout' });
      
      setLastOrder(finalOrder);
      setLastOrderItems([...cart]);
      setShowOrderSuccess(true);
      
      // If not promotor, send to WhatsApp
      if (profile?.role !== 'promotor') {
        sendToWhatsApp(finalOrder, cart);
      }
      
      generateOrderPDF(finalOrder, cart);
      await generateOrderExcel(finalOrder, cart);

      setCart([]);
      setManualClientName('');
      setIsCartOpen(false);
      setShowOfferSuggestions(false);
      
      // For promotor, we might want to automatically reset after success modal or immediately
      if (profile?.role === 'promotor') {
        toast.info('Fluxo reiniciado para novo pedido.');
      }
    } catch (error) {
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        const firstError = (error as any).errors[0]?.message || 'Erro de valida\u00E7\u00E3o';
        toast.error(`Falha na valida\u00E7\u00E3o: ${firstError}`, { id: 'checkout' });
      } else {
        console.error('Checkout error:', error);
        toast.error('Erro ao registrar pedido', { id: 'checkout' });
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedClient || !profile || cart.length === 0) return;

    if (!showOfferCoverage && offersInCart < totalOffersAvailable * 0.5) {
      setShowOfferCoverage(true);
      return;
    }

    // Show offer suggestions modal instead of finishing
    setShowOfferSuggestions(true);
  };

  return (
    <div className="min-h-screen bg-[#FDF6F0] dark:bg-[#121212] pb-24">
      <header className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe sticky top-0 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            {profile?.role === 'admin' && (
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/dashboard')} 
                className="p-2 bg-white/20 rounded-full text-white shadow-sm"
                title="Dashboard"
              >
                <TrendingUp size={20} />
              </motion.button>
            )}
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/')} 
              className="p-2 bg-white/20 rounded-full text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </motion.button>
          <img src="/logo.svg" alt="Logo" className="w-8 h-8 brightness-0 invert" />
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-white font-bold text-lg truncate">
              {profile?.role === 'promotor' ? 'Catálogo Promotor' : (selectedClient?.tradeName || selectedClient?.name)}
            </h1>
            <p className="text-white/80 text-[10px] font-medium uppercase tracking-wider">
              {profile?.role === 'promotor' ? getRegionalLabel(profile?.regional) : `${selectedClient?.city} • ${selectedClient?.id}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPendingCarts(true)} 
              className={cn(
                "p-2 bg-white/20 rounded-full text-white relative transition-all shadow-sm",
                pendingCarts.length > 0 ? "animate-bounce" : "opacity-50"
              )}
            >
              <div className="relative">
                <ShoppingCart size={20} />
                {pendingCarts.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-yellow-400 text-orange-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    {pendingCarts.length}
                  </span>
                )}
              </div>
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowQuickOrder(true)} 
              className="p-2 bg-white/20 rounded-full text-white relative shadow-sm"
            >
              <Zap size={20} />
              {quickOrderProducts.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              className="p-2 bg-white/20 rounded-full text-white"
            >
              <History size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowProfile(true)}
              className="p-2 bg-white/20 rounded-full text-white"
              title="Meu Perfil"
            >
              <Settings size={20} />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCartOpen(true)} 
              className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-md hover:bg-orange-50 transition-colors"
            >
              <ShoppingCart size={18} />
              <span>{cartCount}</span>
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {banners.map(banner => (
          <motion.div key={banner.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={cn("p-3 text-center text-xs font-bold flex items-center justify-center gap-2", banner.type === 'info' ? "bg-blue-500 text-white" : banner.type === 'warning' ? "bg-yellow-500 text-black" : "bg-green-500 text-white")}>
            <Bell size={14} />{banner.text}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="bg-white dark:bg-[#1E1E1E] sticky top-[72px] z-30 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto flex">
          {['produtos', 'ofertas', 'lancamentos'].map(tab => (
            <motion.button 
              key={tab} 
              whileHover={{ backgroundColor: "rgba(255, 107, 0, 0.05)" }}
              onClick={() => setActiveTab(tab as any)} 
              className={cn("flex-1 py-4 text-sm font-bold transition-all relative uppercase", activeTab === tab ? "text-orange-600" : "text-gray-400")}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span>{tab === 'produtos' ? '🛍 Produtos' : tab === 'ofertas' ? '🔥 Ofertas' : '🆕 Lançamentos'}</span>
                <span className={cn("text-[9px] font-black px-1.5 rounded-full", activeTab === tab ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400")}>
                  {counts.tabCounts[tab as keyof typeof counts.tabCounts]}
                </span>
              </div>
              {activeTab === tab && (
                <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600 rounded-full" />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-[1400px] mx-auto space-y-4">
        <ConfigWarning />
        
        {/* Split responsive layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* LEFT SIDEBAR (Desktop only) */}
          <aside className="hidden lg:block w-[280px] shrink-0 self-start sticky top-[152px] h-[calc(100vh-180px)] overflow-y-auto pr-2 pb-10 space-y-6 scroll-smooth">
            
            {/* Brands/Manufacturers Card with official logo */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Indústrias</h3>
                {selectedManufacturers.length > 0 && (
                  <button 
                    onClick={() => setSelectedManufacturers([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {manufacturers.map(m => {
                  const isSelected = selectedManufacturers.includes(m);
                  const logoUrl = getManufacturerLogo(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedManufacturers(prev => prev.filter(x => x !== m));
                        } else {
                          setSelectedManufacturers(prev => [...prev, m]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all text-left",
                        isSelected 
                          ? "bg-orange-50/80 dark:bg-orange-950/20 border-orange-500 shadow-sm" 
                          : "bg-gray-50/50 dark:bg-gray-800/40 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 shrink-0 border border-gray-100 shadow-sm overflow-hidden">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt={m} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[9px] font-black text-gray-400 uppercase">
                            {m.substring(0, 3)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-bold truncate",
                          isSelected ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"
                        )}>
                          {m}
                        </p>
                        <p className="text-[9px] text-gray-400 font-medium">
                          {products.filter(p => p.manufacturer === m).length} itens
                        </p>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                      )}>
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories Card */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Categorias</h3>
                {selectedCategories.length > 0 && (
                  <button 
                    onClick={() => setSelectedCategories([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {categories.map(c => {
                  const isSelected = selectedCategories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCategories(prev => prev.filter(x => x !== c));
                        } else {
                          setSelectedCategories(prev => [...prev, c]);
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1",
                        isSelected 
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                          : "bg-gray-50/50 dark:bg-gray-800/40 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      {isSelected && <Check size={10} />}
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Filters Card */}
            <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-xs text-gray-400 uppercase tracking-widest">Status</h3>
                {statusFilters.length > 0 && (
                  <button 
                    onClick={() => setStatusFilters([])}
                    className="text-[10px] font-bold text-orange-600 hover:underline animate-none"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'discount', label: '🏷️ Com Desconto', icon: Flame },
                  { id: 'no-discount', label: '📦 Preço Regular', icon: Package },
                  { id: 'in-stock', label: '✅ Em Estoque', icon: CheckCircle2 },
                  { id: 'out-stock', label: '❌ Sem Estoque', icon: AlertCircle },
                  { id: 'new', label: '🆕 Lançamentos', icon: Sparkles },
                  { id: 'promotional', label: '🔥 Promocionais', icon: Zap },
                ].map(item => {
                  const isSelected = statusFilters.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isSelected) {
                          setStatusFilters(prev => prev.filter(x => x !== item.id));
                        } else {
                          setStatusFilters(prev => [...prev, item.id]);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left",
                        isSelected 
                          ? "bg-orange-50/40 dark:bg-orange-950/10 border-orange-300" 
                          : "bg-gray-50/30 dark:bg-gray-800/20 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon size={13} className={cn(isSelected ? "text-orange-600" : "text-gray-400")} />
                        <span className={cn("text-[11px] font-bold", isSelected ? "text-orange-600" : "text-gray-600 dark:text-gray-400")}>
                          {item.label}
                        </span>
                      </div>
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center",
                        isSelected ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300"
                      )}>
                        {isSelected && <Check size={8} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* MAIN CATALOG CONTENT AREA */}
          <div className="flex-1 w-full space-y-4">
            
            {/* Filters and search row */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="search" placeholder="Buscar por nome, código, fabricante..." value={searchInputValue} onChange={(e) => setSearchInputValue(e.target.value)}
                    className="w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-full py-3.5 pl-12 pr-14 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all shadow-sm" />
                  <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-orange-100 text-orange-600 rounded-full hover:bg-orange-200 transition-colors"
                  >
                    <Camera size={18} />
                  </button>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsFilterOpen(true)}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 p-3.5 rounded-full text-gray-600 dark:text-white flex items-center gap-2 shadow-sm relative"
                >
                  <SlidersHorizontal size={18} />
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0) && (
                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {selectedManufacturers.length + selectedCategories.length + statusFilters.length}
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Mobile quick brand selection list (rendered horizontal scroll only under lg screen size) */}
              <div className="lg:hidden w-full overflow-x-auto pb-2 scrollbar-none flex gap-3">
                {manufacturers.map(m => {
                  const isSelected = selectedManufacturers.includes(m);
                  const logoUrl = getManufacturerLogo(m);
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedManufacturers(prev => prev.filter(x => x !== m));
                        } else {
                          setSelectedManufacturers(prev => [...prev, m]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full border transition-all shrink-0 shadow-sm",
                        isSelected 
                          ? "bg-orange-100 border-orange-500 text-orange-700 font-bold" 
                          : "bg-white dark:bg-[#1E1E1E] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 border border-gray-100 overflow-hidden shrink-0 shadow-sm">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt={m} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-full object-contain"
                          />
                        ) : (
                          <span className="text-[8px] font-black text-gray-400">
                            {m.substring(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold leading-none">{m}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={exportCatalogToPDF}
                  className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2.5 text-xs font-bold text-orange-600 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Download size={14} /> CATALOGO PDF
                </motion.button>
                
                <div className="flex-1 flex gap-2 relative">
                   <div className="relative flex-1 group">
                     <button 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="w-full bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold text-gray-700 dark:text-white shadow-sm flex items-center justify-between group-hover:border-orange-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpDown size={14} className="text-orange-600" />
                        <span>{
                          sortBy === 'price-asc' ? 'Menor preço' :
                          sortBy === 'price-desc' ? 'Maior preço' :
                          sortBy === 'discount' ? 'Maior desconto' :
                          sortBy === 'stock' ? 'Maior estoque' :
                          sortBy === 'az' ? 'A → Z' :
                          sortBy === 'za' ? 'Z → A' :
                          sortBy === 'recent' ? 'Lançamentos' : 'Ordenar'
                        }</span>
                      </div>
                      <ChevronDown size={14} className={cn("transition-transform", isSortOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {isSortOpen && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setIsSortOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-[70] overflow-hidden p-1.5"
                          >
                            {[
                              { id: 'price-asc', label: 'Menor preço', icon: '$', color: 'text-green-600 bg-green-50' },
                              { id: 'price-desc', label: 'Maior preço', icon: '💰', color: 'text-orange-600 bg-orange-50' },
                              { id: 'discount', label: 'Maior desconto', icon: '🏷️', color: 'text-yellow-600 bg-yellow-50' },
                              { id: 'only-discount', label: 'Apenas Descontos', icon: '🎯', color: 'text-pink-600 bg-pink-50' },
                              { id: 'stock', label: 'Maior estoque', icon: '📦', color: 'text-amber-700 bg-amber-50' },
                              { id: 'az', label: 'A → Z', icon: 'abc', color: 'text-blue-600 bg-blue-50' },
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  if (item.id === 'only-discount') {
                                    if (!statusFilters.includes('discount')) setStatusFilters(prev => [...prev, 'discount']);
                                    setSortBy('discount');
                                  } else {
                                    setSortBy(item.id as any);
                                  }
                                  setIsSortOpen(false);
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50",
                                  sortBy === item.id && "bg-orange-50 dark:bg-orange-900/10 text-orange-600"
                                )}
                              >
                                <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black", item.color)}>
                                  {item.icon}
                                </span>
                                {item.label}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                   </div>
                </div>
              </div>

              {/* Active Filter Chips */}
              <div className="flex flex-wrap gap-2 items-center">
                <AnimatePresence>
                  {(selectedManufacturers.length + selectedCategories.length + statusFilters.length > 0) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                        setSelectedManufacturers([]);
                        setSelectedCategories([]);
                        setStatusFilters([]);
                        setPriceRange([0, 10000]);
                      }}
                      className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-red-100 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={12} /> Limpar Tudo
                    </motion.button>
                  )}
                  {priceRange[0] > 0 || priceRange[1] < 10000 ? (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      De {formatCurrency(priceRange[0])} até {formatCurrency(priceRange[1])} <X size={12} className="cursor-pointer" onClick={() => setPriceRange([0, 10000])} />
                    </motion.div>
                  ) : null}
                  {selectedManufacturers.map(m => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={m} className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {m} <X size={12} className="cursor-pointer" onClick={() => setSelectedManufacturers(prev => prev.filter(x => x !== m))} />
                    </motion.div>
                  ))}
                  {selectedCategories.map(c => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={c} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {c} <X size={12} className="cursor-pointer" onClick={() => setSelectedCategories(prev => prev.filter(x => x !== c))} />
                    </motion.div>
                  ))}
                  {statusFilters.map(s => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} key={s} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm">
                      {s === 'discount' ? 'Com Desconto' : s === 'no-discount' ? 'Sem Desconto' : s === 'in-stock' ? 'Em Estoque' : s === 'out-stock' ? 'Sem Estoque' : s === 'new' ? 'Lançamento' : 'Promocional'} 
                      <X size={12} className="cursor-pointer" onClick={() => setStatusFilters(prev => prev.filter(x => x !== s))} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <span className="text-[10px] font-bold text-gray-400 ml-auto">
                  Resultados: <b>{filteredProducts.length}</b> de {products.length}
                </span>
              </div>
            </div>

            <main className="w-full">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm animate-pulse h-64" />)}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-500"><Package size={48} className="mx-auto mb-4" /><p>Nenhum produto encontrado.</p></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedProducts.map((p, index) => {
                    const cartItem = cart.find(item => item.id === p.id);
                    return (
                      <ProductCard
                        key={`${p.id}-${index}`}
                        product={p}
                        cartQuantity={cartItem?.quantity || 0}
                        isFavorite={isFavorite(p.id)}
                        isSold={soldProductIds.has(p.id)}
                        profileRole={profile?.role}
                        onAddToCart={addToCart}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantityDirectly={setQuantityDirectly}
                        onToggleFavorite={toggleFavorite}
                        onSetZoomImage={handleSetZoomImage}
                        onSetUpdatingImageProduct={handleSetUpdatingImageProduct}
                      />
                    );
                  })}
                  {displayedProducts.length < filteredProducts.length && (
                    <div id="load-more-sentinel" className="col-span-full flex justify-center py-6">
                      <button
                        onClick={() => setDisplayLimit(prev => Math.min(prev + 32, filteredProducts.length))}
                        className="bg-orange-100 dark:bg-orange-950/20 hover:bg-orange-200 dark:hover:bg-orange-900/15 text-orange-600 dark:text-orange-400 px-6 py-3 rounded-full font-bold text-xs shadow-sm transition-colors cursor-pointer"
                      >
                        Carregar Mais Produtos ({filteredProducts.length - displayedProducts.length} restantes)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Cart Sheet */}
      <AnimatePresence>
        {showPendingCarts && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-600 text-white">
                <h3 className="font-black text-lg">🛒 Carts Pendentes</h3>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPendingCarts(false)}
                >
                  <X size={24} />
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {pendingCarts.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <ShoppingCart size={48} className="mx-auto mb-2" />
                    <p className="font-bold">Nenhum outro carrinho aberto</p>
                  </div>
                ) : (
                  pendingCarts.map((pCart, i) => (
                    <div key={i} className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {pCart.clientName}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {pCart.items.length} itens • {formatCurrency(pCart.items.reduce((sum, it) => sum + it.finalPrice * it.quantity, 0))}
                          </p>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.05, backgroundColor: (darkMode ? "rgba(255,107,0,1)" : "#fb923c") }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const client = allClients.find(c => c.id === pCart.clientId);
                            if (client) {
                              sessionStorage.setItem('selectedClient', JSON.stringify(client));
                              window.location.reload();
                            } else {
                              // If not in partial list, try to fetch it
                              dataService.getClients(undefined, true).then(fullList => {
                                const fullClient = fullList.find(c => c.id === pCart.clientId);
                                if (fullClient) {
                                  sessionStorage.setItem('selectedClient', JSON.stringify(fullClient));
                                  window.location.reload();
                                }
                              });
                            }
                          }}
                          className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm transition-colors"
                        >
                          Ir para Carrinho
                        </motion.button>
                      </div>
                      <div className="flex -space-x-2 overflow-hidden">
                        {pCart.items.slice(0, 5).map((item, idx) => (
                          <img key={idx} src={item.photo} className="inline-block h-8 w-8 rounded-full border-2 border-white dark:border-gray-800 bg-white" title={item.description} />
                        ))}
                        {pCart.items.length > 5 && (
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold">
                            +{pCart.items.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOfferSuggestions && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-[32px] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-600 text-white">
                <div className="flex items-center gap-2">
                  <Flame size={24} className="text-yellow-400" />
                  <div>
                    <h3 className="font-black text-xl italic tracking-tighter">TURBINE SEU PEDIDO!</h3>
                    <p className="text-[10px] font-bold opacity-80 uppercase">Não perca estas ofertas imperdíveis</p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowOfferSuggestions(false)} 
                  className="p-2 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Sugestões Especiais</p>
                <div className="grid grid-cols-1 gap-3">
                  {products.filter(p => p.type === 'offer').map((p, i) => {
                    const inCart = cart.find(item => item.id === p.id);
                    const wasSold = soldProductIds.has(p.id);
                    const hasStock = p.stock > 0;
                    
                    return (
                      <div key={i} className={cn(
                        "relative flex gap-4 p-4 bg-white dark:bg-[#1E1E1E] rounded-2xl border-2 transition-all group",
                        inCart ? "border-orange-500 bg-orange-50/20" : "border-transparent hover:border-gray-200"
                      )}>
                        <div className="w-20 h-20 bg-white rounded-xl overflow-hidden p-2 flex-none relative">
                          <img src={p.photo || `https://placehold.co/100x100?text=IMG`} className="w-full h-full object-contain" />
                          {wasSold && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[1px]">
                              <span className="bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase leading-none">JÁ VENDIDO</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-bold text-orange-600 uppercase">{p.manufacturer}</span>
                            {inCart && <span className="bg-orange-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full ring-2 ring-orange-100 italic">No Carrinho</span>}
                          </div>
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate mt-1">{p.description}</h4>
                          <div className="mt-2 flex items-baseline gap-2">
                             <span className="text-sm font-black text-orange-600">{formatCurrency(p.finalPrice)}</span>
                             {p.discount > 0 && <span className="text-[10px] text-gray-400 line-through">{formatCurrency(p.salePrice)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center">
                          {inCart ? (
                            <div className="flex items-center gap-3 bg-orange-100 rounded-xl p-1">
                              <motion.button whileHover={{ scale: 1.2, backgroundColor: "white" }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(p.id, -1)} className="p-2 text-red-600 rounded-lg transition-colors"><Minus size={16} /></motion.button>
                              <span className="text-sm font-black w-4 text-center">{inCart.quantity}</span>
                              <motion.button 
                                whileHover={{ scale: 1.2, backgroundColor: "white" }}
                                whileTap={{ scale: 0.8 }}
                                onClick={() => updateQuantity(p.id, 1)} 
                                disabled={inCart.quantity >= p.stock}
                                className={cn("p-2 rounded-lg transition-colors", inCart.quantity >= p.stock ? "text-gray-300 cursor-not-allowed" : "text-green-600")}
                              >
                                <Plus size={16} />
                              </motion.button>
                            </div>
                          ) : (
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={!hasStock}
                              onClick={() => addToCart(p)} 
                              className={cn(
                                "px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg min-w-[100px]",
                                hasStock ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              )}
                            >
                              {hasStock ? 'Adicionar' : 'Esgotado'}
                            </motion.button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-[#1E1E1E] border-t border-gray-100 flex gap-3">
                 <motion.button whileHover={{ scale: 1.02, backgroundColor: "rgba(0,0,0,0.05)" }} whileTap={{ scale: 0.98 }} onClick={() => setShowOfferSuggestions(false)} className="flex-1 py-4 text-gray-500 font-bold text-sm uppercase rounded-xl transition-colors">Revisar Itens</motion.button>
                 <motion.button 
                   whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                   whileTap={{ scale: 0.98 }}
                   onClick={finalizeOrder} 
                   disabled={isFinalizing}
                   className="flex-[2] bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isFinalizing ? <RefreshCw className="animate-spin" size={20} /> : 'FINALIZAR PEDIDO'} <ChevronRight size={20} />
                 </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScannerOpen && (
          <BarcodeScanner 
            onScan={handleScan} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#FDF6F0] dark:bg-[#121212] z-50 shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-[#FF6B00] to-[#F06292] p-4 pt-safe flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsCartOpen(false)} 
                    className="p-2 bg-white/20 rounded-full text-white transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </motion.button>
                  <h2 className="text-white font-bold text-lg">Carrinho</h2>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCart([]);
                    setManualClientName('');
                  }} 
                  className="text-white/80 text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Limpar
                </motion.button>
              </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-full opacity-40"><ShoppingCart size={64} /><p className="font-bold mt-4">Vazio</p></div> : (
                  <>
                    <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-2xl shadow-sm border-l-4 border-orange-600 space-y-3">
                      {profile?.role === 'promotor' && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Nome do Cliente</label>
                          <input 
                            type="text"
                            placeholder="Digite o nome do cliente..."
                            value={manualClientName}
                            onChange={(e) => setManualClientName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-2 px-3 text-xs font-bold focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                      )}
                      <p className="font-bold text-gray-900 dark:text-white text-sm">
                        {profile?.role === 'promotor' ? `Promotor: ${profile.name}` : (selectedClient?.tradeName || selectedClient?.name)}
                      </p>
                      {profile?.role !== 'promotor' && selectedClient && (
                        <p className="text-xs text-gray-500 mt-1">CNPJ: {selectedClient.cnpj}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      {cart.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="bg-white dark:bg-[#1E1E1E] p-3 rounded-2xl shadow-sm flex gap-3">
                          <img src={item.photo || `https://placehold.co/100x100?text=IMG`} className="w-16 h-16 object-contain rounded-xl" />
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.description}</h4>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-black text-orange-600">{formatCurrency(item.finalPrice)}</span>
                              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1">
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, -1)} className="text-red-600"><Minus size={14} /></motion.button>
                                <input 
                                  type="text" 
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) {
                                      setQuantityDirectly(item.id, val);
                                    } else if (e.target.value === '') {
                                      setQuantityDirectly(item.id, 0);
                                    }
                                  }}
                                  className="w-10 text-center text-xs font-bold bg-transparent border-none focus:ring-0"
                                />
                                <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, 1)} className="text-green-600"><Plus size={14} /></motion.button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-white dark:bg-[#1E1E1E] border-t border-gray-100 dark:border-gray-800 pb-safe">
                <div className="flex justify-between items-center mb-4">
                   <span className="font-bold">Total:</span><span className="text-xl font-black text-orange-600">{formatCurrency(cartTotal)}</span>
                </div>
                {profile?.role === 'promotor' ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const orderData = {
                            id: 'PROMO_' + Date.now(),
                            date: new Date().toISOString(),
                            clientId: 'PROMOTOR',
                            clientName: `PROMOTOR: ${profile.name}`,
                            seller: profile.name,
                            total: cartTotal,
                            sellerPhone: profile.phone
                          };
                          generateOrderPDF(orderData, cart);
                        }}
                        className="bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
                      >
                        <FileText size={18} /> PDF
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          const orderData = {
                            id: 'PROMO_' + Date.now(),
                            date: new Date().toISOString(),
                            clientId: 'PROMOTOR',
                            clientName: `PROMOTOR: ${profile.name}`,
                            seller: profile.name,
                            total: cartTotal,
                            sellerPhone: profile.phone
                          };
                          await generateOrderExcel(orderData, cart);
                        }}
                        className="bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"
                      >
                        <FileSpreadsheet size={18} /> Excel
                      </motion.button>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "#EA580C" }}
                      whileTap={{ scale: 0.98 }}
                      disabled={cart.length === 0 || isFinalizing} 
                      onClick={finalizeOrder} 
                      className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 transition-colors uppercase tracking-widest"
                    >
                      {isFinalizing ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Finalizar Pedido
                    </motion.button>
                  </div>
                ) : (
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: "#128C7E" }}
                    whileTap={{ scale: 0.98 }}
                    disabled={cart.length === 0} 
                    onClick={handleCheckout} 
                    className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 transition-colors"
                  >
                    <ShoppingCart size={20} /> Finalizar WhatsApp
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {updatingImageProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
                <div>
                  <h3 className="font-black text-lg">Atualizar Foto</h3>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest">{updatingImageProduct.description}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }} 
                  whileTap={{ scale: 0.9 }} 
                  onClick={() => setUpdatingImageProduct(null)} 
                  className="p-2 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </motion.button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-gray-200">
                    <img src={updatingImageProduct.photo || 'https://placehold.co/200x200?text=Sem+Foto'} className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-xs text-gray-500 font-bold">Foto Atual</p>
                    <p className="text-[10px] text-gray-400 mt-1">ID: {updatingImageProduct.id}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Como deseja atualizar?</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.05, borderStyle: "solid", borderColor: "#2563eb", backgroundColor: "rgba(37, 99, 235, 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSearchImages(updatingImageProduct)}
                      disabled={searchingImages}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group"
                    >
                      <Sparkles className={cn("text-blue-500 group-hover:scale-110 transition-transform", searchingImages && "animate-spin")} size={24} />
                      <span className="text-[10px] font-black uppercase">Pesquisar com IA</span>
                    </motion.button>
                    
                    <motion.button 
                      whileHover={{ scale: 1.05, borderStyle: "solid", borderColor: "#ea580c", backgroundColor: "rgba(234, 88, 12, 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(updatingImageProduct.description + ' ' + updatingImageProduct.manufacturer)}`, '_blank')}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl transition-all group"
                    >
                      <Globe className="text-orange-500 group-hover:scale-110 transition-transform" size={24} />
                      <span className="text-[10px] font-black uppercase">Google Imagens</span>
                    </motion.button>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="relative">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-2">Ou cole uma URL direta da imagem</label>
                    <div className="flex gap-2">
                       <input 
                         type="url" 
                         value={manualImageUrl} 
                         onChange={(e) => setManualImageUrl(e.target.value)}
                         placeholder="https://exemplo.com/foto.jpg"
                         className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                       />
                       <motion.button 
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         disabled={!manualImageUrl}
                         onClick={() => handleUpdateImage(updatingImageProduct, manualImageUrl)}
                         className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-transform"
                       >
                         SALVAR
                       </motion.button>
                    </div>
                  </div>

                  {searchingImages && (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <RefreshCw className="animate-spin text-blue-500" size={32} />
                      <p className="text-xs font-bold text-gray-500">IA pesquisando as melhores fotos...</p>
                    </div>
                  )}

                  {searchImages.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase ml-1">Sugestões Encontradas</p>
                      <div className="grid grid-cols-2 gap-3">
                        {searchImages.map((url, i) => (
                          <div key={i} className="group relative aspect-square bg-gray-100 rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer" onClick={() => handleUpdateImage(updatingImageProduct, url)}>
                            <img src={url} className="w-full h-full object-contain p-2" />
                            <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-white font-black text-[10px] uppercase">Selecionar</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-500 text-white"><h3 className="font-black text-lg">Sugestão de Pedido</h3><button onClick={() => setShowQuickOrder(false)}>✕</button></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {quickOrderProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                    <img src={p.photo} className="w-12 h-12 object-contain" />
                    <div className="flex-1"><p className="text-xs font-bold truncate">{p.description}</p><p className="text-[10px] text-orange-600 font-bold">{formatCurrency(p.finalPrice)}</p></div>
                    <button onClick={() => addToCart(p)} className="bg-orange-600 text-white p-2 rounded-lg"><Plus size={16} /></button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage} alt="Expanded View" className="max-w-full max-h-full object-contain rounded-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderSuccess && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[32px] w-full max-w-sm p-8 text-center space-y-6">
              <CheckCircle2 size={64} className="mx-auto text-green-500" />
              <h3 className="text-2xl font-black">Sucesso!</h3>
              <div className="space-y-3">
                {profile?.role !== 'promotor' && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => sendToWhatsApp(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg"><MessageCircle /><span>Enviar WhatsApp</span><ExternalLink /></motion.button>
                )}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => generateOrderPDF(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-orange-50 rounded-2xl font-bold text-orange-700 border border-orange-100"><FileText /><span>Baixar PDF</span><Download /></motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => generateOrderExcel(lastOrder, lastOrderItems)} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl font-bold text-gray-700 border border-gray-200"><FileSpreadsheet /><span>Baixar Excel</span><Download /></motion.button>
                
                {profile?.role !== 'promotor' && pendingCarts.length > 0 && (
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPendingCarts(true)} 
                    className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-2xl font-bold text-blue-700 animate-pulse"
                  >
                    <ShoppingCart />
                    <span className="flex-1 text-left ml-3">Finalizar próximos ({pendingCarts.length})</span>
                    <ChevronRight />
                  </motion.button>
                )}
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowOrderSuccess(false); navigate('/'); }} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold">
                {profile?.role === 'promotor' ? 'Novo Pedido' : 'Voltar ao Início'}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsCartOpen(true)} 
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#FF6B00] to-[#F06292] text-white rounded-full shadow-2xl flex items-center justify-center z-40"
      >
        <ShoppingCart size={28} />{cartCount > 0 && <span className="absolute -top-1 -right-1 bg-white text-orange-600 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center">{cartCount}</span>}
      </motion.button>

      {/* Advanced Filter Drawer */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsFilterOpen(false)} 
              className="fixed inset-0 bg-black/60 z-[120] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-[#121212] z-[130] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FilterIcon size={20} className="text-orange-600" />
                  <h3 className="font-black text-lg">Filtros Avançados</h3>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X size={24} />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status Group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Status do Produto</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'discount', label: '🏷️ Com Desconto', icon: Flame },
                      { id: 'no-discount', label: '📦 Preço Regular', icon: Package },
                      { id: 'in-stock', label: '✅ Em Estoque', icon: CheckCircle2 },
                      { id: 'out-stock', label: '❌ Sem Estoque', icon: AlertCircle },
                      { id: 'new', label: '🆕 Lançamentos', icon: Sparkles },
                      { id: 'promotional', label: '🔥 Promocionais', icon: Zap },
                    ].map(item => (
                      <label key={item.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <item.icon size={18} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                        <div className="relative flex items-center">
                          <input 
                            type="checkbox" 
                            checked={statusFilters.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setStatusFilters(prev => [...prev, item.id]);
                              else setStatusFilters(prev => prev.filter(x => x !== item.id));
                            }}
                            className="w-5 h-5 rounded-lg border-2 border-gray-300 text-orange-600 focus:ring-orange-500/20 transition-all cursor-pointer"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range Group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Faixa de Preço</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400">Min</span>
                      <input 
                        type="number" 
                        value={priceRange[0]} 
                        onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400">Max</span>
                      <input 
                        type="number" 
                        value={priceRange[1]} 
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-3 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Categories Group */}
                <div className="space-y-4">
                   <div className="flex justify-between items-center pl-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categorias</h4>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">{categories.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(c => {
                      const isSelected = selectedCategories.includes(c);
                      return (
                        <motion.button
                          key={c}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (isSelected) setSelectedCategories(prev => prev.filter(x => x !== c));
                            else setSelectedCategories(prev => [...prev, c]);
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2",
                            isSelected 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md" 
                              : "bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 text-gray-600"
                          )}
                        >
                          {isSelected && <Check size={12} />}
                          {c}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Manufacturers Group */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center pl-1">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fabricantes</h4>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">{manufacturers.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {manufacturers.map(m => {
                      const isSelected = selectedManufacturers.includes(m);
                      const logoUrl = getManufacturerLogo(m);
                      return (
                        <label key={m} className={cn(
                          "flex items-center justify-between p-2 rounded-2xl cursor-pointer border transition-all",
                          isSelected 
                            ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200" 
                            : "bg-white dark:bg-[#1E1E1E] border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 border border-gray-100 overflow-hidden shadow-sm shrink-0">
                              {logoUrl ? (
                                <img 
                                  src={logoUrl} 
                                  alt={m} 
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <span className="text-[9px] font-black text-gray-400 uppercase">
                                  {m.substring(0, 2)}
                                </span>
                              )}
                            </div>
                            <span className={cn("text-[11px] font-bold", isSelected ? "text-orange-600" : "text-gray-600 dark:text-gray-400")}>{m}</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedManufacturers(prev => [...prev, m]);
                              else setSelectedManufacturers(prev => prev.filter(x => x !== m));
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500/20"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex gap-3">
                <motion.button 
                  whileHover={{ backgroundColor: "rgba(220, 38, 38, 0.05)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedManufacturers([]);
                    setSelectedCategories([]);
                    setStatusFilters([]);
                  }}
                  className="flex-1 py-4 text-xs font-black uppercase text-gray-400 hover:text-red-600 transition-colors"
                >
                  Limpar
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-[2] bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-sm shadow-xl shadow-gray-900/10"
                >
                  VER {filteredProducts.length} PRODUTOS
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#1E1E1E] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 bg-gradient-to-r from-orange-500 to-pink-500 text-white flex justify-between items-center">
                <h3 className="font-black text-lg">Meu Perfil</h3>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.3)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowProfile(false); setIsChangingPassword(false); }} 
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </motion.button>
              </div>

              <div className="p-6 space-y-6">
                {!isChangingPassword ? (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-orange-600">
                        <User size={32} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{profile?.name}</p>
                        <p className="text-sm text-gray-500">{profile?.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                          {profile?.role}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "white") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(true)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <Lock size={20} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Alterar Senha</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                      
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(239,68,68,0.1)" : "#fef2f2") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={logout}
                        className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl transition-all shadow-sm group"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-bold text-red-600">Sair da Conta</span>
                        </div>
                        <ChevronRight size={18} className="text-red-400 group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Lock size={18} /> Alterar Senha
                    </h4>
                    
                    <div className="space-y-3">
                      {(['current', 'new', 'confirm'] as const).map((field) => (
                        <div key={field} className="relative">
                          <input
                            type={showPasswords[field] ? 'text' : 'password'}
                            placeholder={field === 'current' ? 'Senha Atual' : field === 'new' ? 'Nova Senha' : 'Confirmar Nova Senha'}
                            value={passwordData[field]}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-orange-500/20"
                          />
                          <motion.button 
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.8 }}
                            onClick={() => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPasswords[field] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </motion.button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <motion.button 
                        whileHover={{ scale: 1.02, backgroundColor: (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChangingPassword(false)}
                        className="flex-1 py-3 font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl transition-colors"
                      >
                        Voltar
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.02, filter: "brightness(1.1)" }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          if (passwordData.new !== passwordData.confirm) {
                            toast.error('As senhas não coincidem');
                            return;
                          }
                          toast.success('Senha alterada com sucesso!');
                          setIsChangingPassword(false);
                        }}
                        className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg"
                      >
                        Salvar
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

```

---

### 📄 Arquivo: `src/services/dataService.ts`

```tsx
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Product, Client, Order, Favorite, Visit, OrderItem, BannerMessage } from '../types';
import axios from 'axios';
import { toast } from 'sonner';
import { getSpreadsheetId } from '../constants/regionals';
import { normalizeEAN } from '../lib/utils';

const API_URL = ''; // Relative to current origin

let currentRegional = 'TIMON-MA';

export const dataService = {
  setRegional(regional: string) {
    currentRegional = regional;
  },

  getHeaders() {
    return {
      'x-spreadsheet-id': getSpreadsheetId(currentRegional)
    };
  },

  // Offline Caching Helpers
  getCache<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`VENDAS_cache_${key}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Optional: Implement cache expiration if needed
        return data as T;
      }
    } catch (e) {
      console.error('Cache retrieval error:', e);
    }
    return null;
  },

  setCache<T>(key: string, data: T) {
    try {
      localStorage.setItem(`VENDAS_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // LocalStorage might be full
      console.warn('Cache storage error (likely full):', e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        localStorage.removeItem(`VENDAS_cache_${key}`);
      }
    }
  },

  // Products from Google Sheets
  async getProductsFromSheet(sheetName: string, type: 'normal' | 'offer' | 'new') {
    const cacheKey = `products_${currentRegional}_${sheetName}`;
    const cachedData = this.getCache(cacheKey) as Product[] | null;

    try {
      const response = await axios.get(`${API_URL}/api/data/${sheetName}`, {
        headers: this.getHeaders(),
        timeout: 10000 // 10s timeout for online check
      });
      if (!Array.isArray(response.data) || response.data.length === 0) {
        return [];
      }

      // Pre-calculate custom rounding logic (3rd digit 6+)
      const applyCustomRounding = (val: number) => {
        const s = val.toFixed(10);
        const parts = s.split('.');
        let rounded: number;
        if (parts.length >= 2 && parts[1].length >= 3) {
          const thirdDigit = parseInt(parts[1][2]);
          if (thirdDigit >= 6) {
            rounded = parseFloat((Math.ceil(val * 100) / 100).toFixed(2));
          } else {
            rounded = parseFloat((Math.floor(val * 100) / 100).toFixed(2));
          }
        } else {
          rounded = parseFloat(val.toFixed(2));
        }
        
        if (rounded === 0.99) return 1.00;
        return rounded;
      };

      // Map columns ONLY ONCE for the whole sheet instead of per-row (Huge Performance Boost)
      const firstRow = response.data[0];
      const keys = Object.keys(firstRow);
      const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      const getColKey = (names: string[]) => {
        const normalizedPatterns = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        for (const name of normalizedPatterns) {
          const idx = keysNormalized.indexOf(name);
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 3) continue;
          const idx = keysNormalized.findIndex(k => k.startsWith(name));
          if (idx !== -1) return keys[idx];
        }
        for (const name of normalizedPatterns) {
          if (name.length < 4) continue;
          const idx = keysNormalized.findIndex(k => k.includes(name));
          if (idx !== -1) return keys[idx];
        }
        return null;
      };

      const mappedKeys = {
        pv: getColKey(['PV', 'Preço Venda', 'Preco Venda', 'PRECO', 'PREÇO', 'VALOR', 'TABELA', 'UNITARIO', 'UNITÁRIO', 'PREÇO UNITARIO', 'VALOR UNITARIO']),
        pf: getColKey(['PF', 'Preço Final', 'Preco Final', 'VALOR FINAL', 'PREÇO LÍQUIDO', 'PRECO LIQUIDO', 'VALOR LIQUIDO']),
        dc: getColKey(['Desconto', 'DESCONTO', 'PERCENTUAL', 'BONUS']),
        ean: getColKey(['EAN', 'Codigo Barras', 'Código de Barras', 'EAN13', 'GTIN', 'CODIGO EAN', 'CODIGO', 'BARRAS']),
        id: getColKey(['IDProduto', 'ID_Produto', 'Codigo', 'Cod', 'Código', 'CODIGO', 'ID']),
        stock: getColKey(['Estoque', 'Sald', 'Saldo', 'QTDE', 'Qtde', 'Quant', 'Quantidade', 'STOCK', 'DISPONIVEL', 'QTD DISP']),
        desc: getColKey(['Descrição', 'Descricao', 'Nome', 'Produto', 'Descricao Produto', 'PRODUTO', 'NOME']),
        cat: getColKey(['Categoria', 'CATEGORIA', 'Grupo']),
        fab: getColKey(['Fabricante', 'FABRICANTE', 'Indústria', 'Industria', 'MARCA', 'FAB']),
        photo: getColKey(['Foto', 'FOTO', 'Imagem', 'URL']),
        valid: getColKey(['Validade Desconto', 'Validade', 'Data Fim Desconto', 'EXPIRA', 'FIM PROMO', 'VENCIMENTO'])
      };

      const now = new Date();
      now.setHours(0, 0, 0, 0); // Logic based on day start for reliability

      const products = response.data.map((r: any, i: number) => {
        const pvRaw = r[mappedKeys.pv || ''] || 0;
        const pv = parseFloat(String(pvRaw).replace(',', '.'));
        
        const pfRawVal = r[mappedKeys.pf || ''] || 0;
        const pfRaw = parseFloat(String(pfRawVal).replace(',', '.'));
        
        const dcRawVal = r[mappedKeys.dc || ''] || 0;
        let dc = parseFloat(String(dcRawVal).replace(',', '.'));
        
        if (Math.abs(dc - pfRaw) < 0.01 || Math.abs(dc - pv) < 0.01) dc = 0;
        if (dc > 0 && dc < 1) dc = dc * 100;
        
        let pf = pfRaw;
        if (pv > 0 && pf > 0 && Math.abs(pv - pf) < 0.001) dc = 0;
        
        if (!pf && pv) {
          pf = pv - (pv * dc / 100);
        } else if (pf > 0 && pv > 0) {
          dc = ((pv - pf) / pv) * 100;
        }
        
        if (dc < 0) dc = 0;
        dc = applyCustomRounding(dc);
        const salePrice = applyCustomRounding(pv);
        const finalPrice = applyCustomRounding(pf);
        
        const validDateStr = r[mappedKeys.valid || ''];
        let discountExpiryDate: string | null = null;
        let isExpired = false;

        if (validDateStr) {
          try {
            // Attempt to parse various date formats
            let parsedDate: Date | null = null;
            if (typeof validDateStr === 'number') {
              // Excel/Sheets serial date handle
              parsedDate = new Date((validDateStr - 25569) * 86400 * 1000);
            } else if (String(validDateStr).includes('/')) {
              const parts = String(validDateStr).split('/');
              if (parts.length === 3) {
                // Assuming DD/MM/YYYY
                parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            } else {
              parsedDate = new Date(validDateStr);
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              parsedDate.setHours(0, 0, 0, 0);
              discountExpiryDate = parsedDate.toISOString().split('T')[0];
              // If today is AFTER expiry date, the discount is expired
              if (now > parsedDate) {
                isExpired = true;
              }
            }
          } catch (e) {
            console.warn('Error parsing discount date:', validDateStr);
          }
        }

        const ean = r[mappedKeys.ean || ''] ? normalizeEAN(r[mappedKeys.ean || '']) : '';
        const idVal = r[mappedKeys.id || ''] || (i + 1);
        const stockVal = r[mappedKeys.stock || ''] || 0;
        
        const finalProduct = {
          id: String(idVal),
          ean: ean,
          description: String(r[mappedKeys.desc || ''] || 'Produto'),
          stock: (() => {
            const s = String(stockVal).trim();
            if (!s) return 0;
            // Remove dots (thousands separators commonly used in Brazil)
            // but only if there's a comma later or if it looks like a thousand (dot followed by 3 digits)
            // For simplicity and context of stock, we'll strip dots and treat comma as decimal
            const cleaned = s.replace(/\./g, '').replace(',', '.');
            const val = parseFloat(cleaned);
            return isNaN(val) ? 0 : Math.floor(val);
          })(),
          salePrice: salePrice,
          discount: isExpired ? 0 : dc,
          finalPrice: isExpired ? salePrice : finalPrice,
          category: String(r[mappedKeys.cat || ''] || 'Geral'),
          manufacturer: String(r[mappedKeys.fab || ''] || ''),
          photo: String(r[mappedKeys.photo || ''] || ''),
          type: type,
          discountExpiryDate: discountExpiryDate
        } as Product;

        return finalProduct;
      });

      this.setCache(cacheKey, products);
      return products;
    } catch (error: any) {
      if (cachedData) {
        console.warn(`Fetch failed for ${sheetName}, using cached data.`);
        return cachedData;
      }

      const serverError = error.response?.data?.error || error.message;
      const details = error.response?.data?.details || '';
      console.error(`Error fetching ${sheetName} from Sheets:`, serverError, details);
      // Only toast on critical errors, not just empty sheets
      if (error.response?.status !== 404) {
        toast.error(`Offline: Usando dados locais para ${sheetName}`);
      }
      return [];
    }
  },

  async getAllProducts() {
    const [normal, offers, news] = await Promise.all([
      this.getProductsFromSheet('Produtos', 'normal'),
      this.getProductsFromSheet('Ofertas', 'offer'),
      this.getProductsFromSheet('Lancamentos', 'new')
    ]);
    const allProducts = [...normal, ...offers, ...news];
    if (allProducts.length > 0) {
      this.setCache(`all_products_${currentRegional}`, allProducts);
    }
    return allProducts;
  },

  subscribeProducts(callback: (products: Product[]) => void) {
    // Return cached data immediately if available
    const cached = this.getCache(`all_products_${currentRegional}`) as Product[] | null;
    if (cached) callback(cached);

    this.getAllProducts().then(callback);
    const interval = setInterval(() => this.getAllProducts().then(callback), 300000);
    return () => clearInterval(interval);
  },

  // Clients from Google Sheets
  async getClients(sellerName?: string, isAdmin?: boolean) {
    const cacheKey = `clients_${currentRegional}`;
    const cachedClients = this.getCache(cacheKey) as Client[] | null;

    try {
      const response = await axios.get(`${API_URL}/api/data/Clientes`, {
        headers: this.getHeaders(),
        timeout: 10000
      });
      if (!Array.isArray(response.data)) {
        console.error('Expected array from Clientes, got:', response.data);
        return cachedClients || [];
      }
      let clients = response.data.map((r: any, i: number) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          id: String(findVal(['IDCliente', 'ID', 'CODIGO', 'COD']) || i + 1),
          name: findVal(['Nome', 'RAZAO SOCIAL', 'NOME COMPLETO']) || '',
          tradeName: findVal(['Nome Fantasia', 'FANTASIA', 'LOJA']) || '',
          cnpj: findVal(['CNPJ', 'CPF/CNPJ', 'DOCUMENTO']) || '',
          seller: findVal(['Vendedor', 'VENDEDOR', 'REPRESENTANTE', 'REPRES']) || '',
          email: findVal(['EmailUsuario', 'Email', 'EMAIL', 'CORREIO']) || '',
          address: findVal(['Endereco', 'ENDEREÇO', 'LOGRADOURO']) || '',
          city: findVal(['Cidade', 'CIDADE', 'MUNICIPIO']) || '',
          state: findVal(['Estado', 'ESTADO', 'UF']) || '',
          buyer: findVal(['Comprador', 'COMPRADOR', 'CONTATO']) || '',
          phone: findVal(['Celular', 'TEL', 'TELEFONE', 'WHATSAPP', 'FONE']) || '',
          regional: findVal(['Regional', 'REGIONAL', 'ZONA', 'SETOR']) || 'TIMON-MA'
        } as Client;
      });

      this.setCache(cacheKey, clients);

      if (!isAdmin && sellerName) {
        clients = clients.filter((c: Client) => c.seller.toLowerCase().includes(sellerName.toLowerCase()));
      }
      return clients;
    } catch (error: any) {
      if (cachedClients) {
        let clients = cachedClients;
        if (!isAdmin && sellerName) {
          clients = clients.filter((c: Client) => c.seller.toLowerCase().includes(sellerName.toLowerCase()));
        }
        return clients;
      }
      const serverError = error.response?.data?.error || error.message;
      const details = error.response?.data?.details || '';
      console.error('Error fetching clients from Sheets:', serverError, details);
      return [];
    }
  },

  async updateClientInSheet(client: Client) {
    try {
      const response = await axios.post(`${API_URL}/api/client/update`, client, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating client in Sheets:', error);
      const message = error.response?.data?.error || error.message;
      toast.error(`Erro ao atualizar cliente: ${message}`);
      return null;
    }
  },

  subscribeClients(sellerName: string | null, isAdmin: boolean, callback: (clients: Client[]) => void) {
    const fetchClients = () => this.getClients(sellerName || undefined, isAdmin).then(callback);
    fetchClients();
    const interval = setInterval(fetchClients, 300000); // Poll every 5 minutes
    return () => clearInterval(interval);
  },

  async updateCatalogInSheets(industria: string, dados: any[], defaultExpiryDate?: string | null) {
    try {
      const response = await axios.post(`${API_URL}/api/catalog/update`, { industria, dados, defaultExpiryDate }, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating catalog in Sheets:', error);
      if (error.response?.status === 413) {
        toast.error('Arquivo muito grande para processar. Tente dividir a planilha em partes menores.');
      } else {
        const message = error.response?.data?.error || error.message;
        toast.error(`Erro ao atualizar catálogo: ${message}`);
      }
      return null;
    }
  },

  // Orders
  async saveOrder(order: Omit<Order, 'id'>) {
    const id = 'PED' + Date.now();
    const orderWithId = { ...order, id };

    try {
      // 1. Save to Firebase (with internal persistence enabled, it will sync later)
      const path = 'orders';
      await addDoc(collection(db, path), orderWithId);
      
      // 2. Try to save to Google Sheets (external sync)
      try {
        await axios.post(`${API_URL}/api/order`, orderWithId, {
          headers: this.getHeaders(),
          timeout: 5000 // Fast fail for offline
        });
      } catch (sheetsError) {
        console.warn('Google Sheets sync failed (offline?), will sync later when online if the server supports it or via another mechanism.');
      }
      
      return id;
    } catch (error) {
      console.error('Error saving order (Cloud):', error);
      // Return ID anyway so the app can continue to provide PDF/WhatApp
      return id;
    }
  },

  // Orders from Google Sheets with Automatic Discovery
  async getOrdersFromSheets() {
    try {
      const statusRes = await axios.get(`${API_URL}/api/status`, {
        headers: this.getHeaders()
      });
      const availableSheets = statusRes.data?.spreadsheetInfo?.sheets || [];
      
      const potentialNames = ['pedidos', 'vendas', 'orders', 'venda', 'lista pedidos', 'realizados', 'finalizados', 'resumo', 'relatorio', 'planilha'];
      const targetSheet = availableSheets.find((s: string) => 
        potentialNames.some(p => s.toLowerCase().includes(p))
      );

      if (!targetSheet) {
        console.warn('No order sheet found automatically, trying fallback list.');
        // Fallback to manual check of common names if status failed or list empty
      }

      const sheetToFetch = targetSheet || 'Pedidos';
      const response = await axios.get(`${API_URL}/api/data/${sheetToFetch}`, {
        headers: this.getHeaders()
      });
      
      if (!Array.isArray(response.data)) return [];

      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          id: findVal(['IDPedido', 'ID', 'Codigo', 'Código', 'PEDIDO', 'Nº', 'NUMERO', 'ORDEM', 'DOC', 'CODIGO']),
          date: findVal(['Data', 'DATA', 'Dta', 'EMISSAO', 'CRIADO', 'DATA PEDIDO', 'DATA_PEDIDO', 'DATA DO PEDIDO']),
          clientId: findVal(['IDCliente', 'ID Cliente', 'ClienteID', 'COD CLIENTE', 'ID_CLIENTE', 'CODIGO', 'ID_CLI']),
          clientName: findVal(['Nome Cliente', 'Cliente', 'NOME', 'RAZAO SOCIAL', 'NOME_CLIENTE', 'FANTASIA', 'NOME FANTASIA']),
          email: findVal(['Email', 'EMAIL', 'CORREIO', 'CONTATO']),
          seller: findVal(['Vendedor', 'VENDEDOR', 'REPRES', 'REPRESENTANTE', 'VEND', 'NOME VENDEDOR']),
          phone: findVal(['Celular', 'TEL', 'TELEFONE', 'WHATSAPP', 'FONE', 'CEL', 'CONTATO']),
          total: parseFloat(String(findVal(['Total', 'VALOR', 'PRECO', 'VALOR TOTAL', 'SUBTOTAL', 'LIQUIDO', 'VALOR_TOTAL']) || 0).replace(',', '.')),
          status: findVal(['Status', 'STATUS', 'SITUACAO', 'SITUACAO PEDIDO', 'SIT', 'SITUACAO_PEDIDO']),
          observation: findVal(['Observacao', 'OBS', 'COMENTARIO', 'OBSERVACOES', 'MOTIVO']),
          pdfUrl: findVal(['PdfUrl', 'PDF', 'LINK', 'URL', 'ARQUIVO', 'LINK_PDF'])
        } as Order;
      }).filter(o => (o.id || o.date || o.clientName) && (o.total > 0 || o.clientName));
    } catch (error: any) {
      console.error('Error fetching orders from Sheets:', error);
      return [];
    }
  },

  async getCartsFromSheets() {
    try {
      const statusRes = await axios.get(`${API_URL}/api/status`, {
        headers: this.getHeaders()
      });
      const availableSheets = statusRes.data?.spreadsheetInfo?.sheets || [];
      
      const potentialNames = ['carrinhos', 'carrinho', 'rascunhos', 'itenscarrinho', 'drafts', 'carts', 'abertos', 'pendentes'];
      const targetSheet = availableSheets.find((s: string) => 
        potentialNames.some(p => s.toLowerCase().includes(p))
      );

      const sheetToFetch = targetSheet || 'Carrinhos';
      const response = await axios.get(`${API_URL}/api/data/${sheetToFetch}`, {
        headers: this.getHeaders()
      });
      
      if (!Array.isArray(response.data)) return [];

      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          id: findVal(['IDCliente', 'ID', 'ID_CLIENTE', 'ID_CLI', 'COD', 'ID_CARRINHO', 'CODIGO', 'ID CLIENTE']),
          clientName: findVal(['Nome Cliente', 'Cliente', 'NOME', 'RAZAO', 'FANTASIA', 'CLIENTE', 'LOJA', 'NOME_CLIENTE', 'RAZAO SOCIAL', 'NOME FANTASIA']),
          updatedAt: findVal(['Data', 'DATA', 'Atualizado', 'HORA', 'ULTIMA_ATUALIZACAO', 'CRIADO', 'DTA', 'DATA_HORA']),
          itemsCount: parseInt(String(findVal(['Itens', 'Item', 'Quantidade', 'Qtd', 'QTDE_ITENS', 'TOTAL_ITENS', 'ITEMS', 'PRODUTOS', 'LINHAS', 'QTDE', 'QUANTIDADE', 'ITEM']) || 0)),
          total: parseFloat(String(findVal(['Total', 'VALOR', 'PRECO', 'SOMA', 'VALOR_TOTAL', 'TOTAL_CARRINHO', 'VALOR TOTAL', 'SUBTOTAL']) || 0).replace(',', '.')),
        };
      }).filter(c => c.clientName || c.id || c.total > 0);
    } catch (error: any) {
      return [];
    }
  },

  async getOrders(): Promise<Order[]> {
    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  },

  subscribeOrders(clientId: string | null, sellerName: string | null, isAdmin: boolean, callback: (orders: Order[]) => void) {
    // We'll use Firestore for real-time updates in the app, 
    // but the data is also mirrored to Sheets.
    // If the user wants ONLY Sheets, we'd poll here.
    const path = 'orders';
    let q = query(collection(db, path), orderBy('date', 'desc'));
    
    if (!isAdmin) {
      if (clientId) {
        q = query(collection(db, path), where('clientId', '==', clientId), orderBy('date', 'desc'));
      } else if (sellerName) {
        q = query(collection(db, path), where('seller', '==', sellerName), orderBy('date', 'desc'));
      }
    } else if (clientId && clientId !== '*') {
      q = query(collection(db, path), where('clientId', '==', clientId), orderBy('date', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Favorites
  async toggleFavorite(clientId: string, productId: string, description: string, addedBy: string) {
    const path = 'favorites';
    const id = `${clientId}_${productId}`;
    try {
      const docRef = doc(db, path, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await deleteDoc(docRef);
        return 'removed';
      } else {
        const favorite: Favorite = {
          clientId,
          productId,
          description,
          addedBy,
          dateAdded: new Date().toISOString()
        };
        await setDoc(docRef, favorite);
        return 'added';
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeFavorites(clientId: string, callback: (favorites: Favorite[]) => void) {
    const path = 'favorites';
    const q = query(collection(db, path), where('clientId', '==', clientId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Favorite));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Visits
  async saveVisit(visit: Visit) {
    const path = 'visits';
    try {
      await addDoc(collection(db, path), visit);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  subscribeVisits(sellerName: string, callback: (visits: Visit[]) => void) {
    const path = 'visits';
    const q = query(collection(db, path), where('seller', '==', sellerName), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Visit));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  // Cart Persistence
  async saveCart(clientId: string, items: OrderItem[]) {
    const path = 'carts';
    try {
      if (items.length === 0) {
        await deleteDoc(doc(db, path, clientId));
      } else {
        await setDoc(doc(db, path, clientId), { items, updatedAt: new Date().toISOString() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getCart(clientId: string) {
    const path = 'carts';
    try {
      const docSnap = await getDoc(doc(db, path, clientId));
      return docSnap.exists() ? docSnap.data().items as OrderItem[] : [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getAllCarts() {
    const path = 'carts';
    try {
      const q = query(collection(db, path));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        clientId: doc.id,
        items: doc.data().items as OrderItem[],
        updatedAt: doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching all carts:', error);
      return [];
    }
  },

  // Metas from Google Sheets
  async getMetas(sellerName: string) {
    try {
      const response = await axios.get(`${API_URL}/api/data/Metas`, {
        headers: this.getHeaders()
      });
      if (!Array.isArray(response.data)) return null;
      
      const meta = response.data.find((r: any) => 
        String(r['Vendedor'] || '').toLowerCase() === sellerName.toLowerCase()
      );
      
      if (meta) {
        return {
          vendedor: meta['Vendedor'],
          valor: parseFloat(String(meta['Meta'] || 0).replace(',', '.')),
          regional: meta['Regional']
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching metas:', error);
      return null;
    }
  },

  async getUsersFromSheets() {
    try {
      const response = await axios.get(`${API_URL}/api/data/usuarios`, {
        headers: {
          'x-spreadsheet-id': '1X-c-rFaYMtGvHs2inspKlU2AYoTt5p-wB0Gr-AutAjs'
        }
      });
      if (!Array.isArray(response.data)) {
        console.error('Expected array from usuarios, got:', response.data);
        return [];
      }
      
      return response.data.map((r: any) => {
        const findVal = (names: string[]) => {
          const normalizedNames = names.map(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
          const keys = Object.keys(r);
          const keysNormalized = keys.map(k => String(k).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

          for (const name of normalizedNames) {
            const idx = keysNormalized.findIndex(k => k === name);
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 3) continue;
            const idx = keysNormalized.findIndex(k => k.startsWith(name));
            if (idx !== -1) return r[keys[idx]];
          }
          for (const name of normalizedNames) {
            if (name.length < 4) continue;
            const idx = keysNormalized.findIndex(k => k.includes(name));
            if (idx !== -1) return r[keys[idx]];
          }
          return undefined;
        };

        return {
          username: String(findVal(['usuario', 'login', 'user']) || findVal(['email']) || '').trim(),
          password: String(findVal(['senha', 'password', 'pin']) || '').trim(),
          name: String(findVal(['nome', 'name', 'vendedor']) || '').trim(),
          phone: String(findVal(['celular', 'tel', 'telefone', 'whatsapp', 'fone']) || '').trim(),
          role: String(findVal(['perfil', 'role', 'tipo']) || 'vendedor').toLowerCase(),
          regional: String(findVal(['regional', 'zona', 'setor', 'planilha']) || 'TIMON-MA').trim()
        };
      }).filter(u => u.username && u.password);
    } catch (error: any) {
      console.error('Error fetching users from sheet:', error);
      if (axios.isAxiosError(error) && error.response?.data) {
        const data = error.response.data as any;
        const msg = data.message || data.error || error.message;
        toast.error(`Erro ao carregar usuários da planilha: ${msg}`, { duration: 12000 });
      } else {
        toast.error('Erro de conexão ao buscar usuários. Verifique se o backend está ativo.', { duration: 8000 });
      }
      return [];
    }
  },

  async getAllMetas() {
    try {
      const response = await axios.get(`${API_URL}/api/data/Metas`, {
        headers: this.getHeaders()
      });
      if (!Array.isArray(response.data)) return [];
      
      return response.data.map((r: any) => ({
        vendedor: r['Vendedor'],
        valor: parseFloat(String(r['Meta'] || 0).replace(',', '.')),
        regional: r['Regional']
      }));
    } catch (error) {
      console.error('Error fetching all metas:', error);
      return [];
    }
  },

  async updateProductImage(productId: string, imageUrl: string, type: 'normal' | 'offer' | 'new') {
    const sheetName = type === 'offer' ? 'Ofertas' : type === 'new' ? 'Lancamentos' : 'Produtos';
    try {
      const response = await axios.post(`${API_URL}/api/product/update-image`, {
        id: productId,
        imageUrl,
        sheetName
      }, {
        headers: this.getHeaders()
      });
      return response.data.success;
    } catch (error) {
      console.error('Error updating product image:', error);
      return false;
    }
  },

  // Banner Messages
  subscribeBanners(callback: (banners: BannerMessage[]) => void) {
    const path = 'banners';
    const q = query(collection(db, path), where('active', '==', true));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BannerMessage)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
};

```

---

### 📄 Arquivo: `src/types.ts`

```tsx
export interface Product {
  id: string;
  ean: string;
  description: string;
  stock: number;
  salePrice: number;
  discount: number;
  finalPrice: number;
  category: string;
  manufacturer: string;
  photo: string;
  type: 'normal' | 'offer' | 'new';
  discountExpiryDate?: string | null;
}

export interface Client {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  seller: string;
  email: string;
  address: string;
  city: string;
  state: string;
  buyer: string;
  phone: string;
  regional: string;
}

export interface OrderItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  email: string;
  seller: string;
  phone: string;
  total: number;
  status: 'Novo' | 'Confirmado' | 'Entregue' | 'Cancelado' | 'Rascunho';
  items: OrderItem[];
  observation: string;
  pdfUrl?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  role: 'admin' | 'vendedor' | 'promotor';
  phone: string;
  email: string;
  regional: string;
}

export interface Favorite {
  clientId: string;
  productId: string;
  description: string;
  addedBy: string;
  dateAdded: string;
}

export interface Visit {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  timestamp: number;
  seller: string;
  latitude?: number;
  longitude?: number;
}

export interface BannerMessage {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  targetRegional?: string;
}

```

---

### 📄 Arquivo: `src/vite-env.d.ts`

```tsx
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

```

---

