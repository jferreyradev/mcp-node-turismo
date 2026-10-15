# Servidor MCP Oficial de Turismo Tucumán (Node.js)

Servidor oficial que implementa el estándar abierto **Model Context Protocol (MCP)** en **Node.js** para conectar modelos de lenguaje y agentes de IA con la API REST de Turismo de la provincia de Tucumán.

Soporta dos modalidades de funcionamiento:
1. **Local (STDIO)**: Para clientes de escritorio en tu máquina (Claude Desktop, Cursor, Gemini/Antigravity, Windsurf).
2. **Remoto en Servidor (Streamable HTTP / SSE)**: Para desplegar en un VPS, contenedor Docker, Railway, Render o la nube, permitiendo que agentes web (n8n, Flowise, LangChain, OpenAI Custom GPTs) se conecten por internet.

---

## 🚀 Características Principales

- **SDK Oficial**: Construido con `@modelcontextprotocol/sdk` y `zod` siguiendo la especificación MCP 2024-11-05+.
- **Soporte Dual de Transporte**:
  - `STDIO` para integración local transparente con clientes de IA en el sistema operativo.
  - `HTTP / SSE` para servidores remotos y contenedores Docker en internet.
- **Motor de Optimización Semántica (`McpOptimizer`)**:
  - **Auto-resolución de nombres en memoria**: Acepta nombres humanos como `"Aguilares"`, `"Tafí del Valle"`, o `"capital"` y los traduce en 0 ms a sus códigos MD5 de 32 caracteres.
  - **Tolerancia a faltas (*Fuzzy Matching*)**: Corrige errores de tipeo y tildes mediante distancia de Levenshtein ($\le 2$).
  - **Reducción de Tokens (>95%)**: Elimina campos nulos, fechas vacías (`0000-00-00`), claves técnicas redundantes, redondea coordenadas GPS a 4 decimales (~11m de precisión) y omite URLs pesadas de imágenes por defecto.
  - **Presupuesto Inteligente de Contexto**: Paginación con límite por defecto de 5 registros (`DEFAULT_AI_LIMIT = 5`).
- **Soporte Completo de Recursos**: Consulta específica para eventos, circuitos, lugares y genérica para los 28 recursos dinámicos (hoteles, gastronomía, prestadores, etc.).
- **Dual Path Fallback**: Compatible tanto con prefijos `/v1/...` como `/api/v1/...`.

---

## 🛠️ Catálogo de Herramientas (Tools)

| Herramienta | Descripción | Parámetros Principales |
| :--- | :--- | :--- |
| `turismo_health` | Verifica el estado y runtime de la API (Healthcheck). | `base_url` *(opcional)* |
| `turismo_login` | Autentica usuario y retorna token Bearer JWT. | `email`, `password`, `base_url` |
| `turismo_get_circuitos` | Lista todos los circuitos turísticos oficiales. | `q` *(filtro de texto)*, `campos`, `base_url` |
| `turismo_get_eventos` | Lista eventos turísticos con filtros o consulta detalle por código. | `codigo`, `localidad`, `desde`, `hasta`, `categoria`, `busqueda`, `limite`, `offset`, `campos`, `incluir_imagenes` |
| `turismo_get_lugares` | Lista lugares turísticos con filtros o consulta detalle por código. | `codigo`, `circuito`, `localidad`, `busqueda`, `limite`, `offset`, `campos`, `incluir_imagenes` |
| `turismo_get_recurso` | Consulta cualquiera de los 28 recursos dinámicos con sinónimos (ej: "restaurantes" $\rightarrow$ "gastronomia", "alojamiento" $\rightarrow$ "hoteles"). | `recurso` *(requerido)*, `codigo`, `filtros`, `campos`, `incluir_imagenes` |
| `turismo_get_perfil` | Consulta el endpoint de perfil protegido con Bearer JWT. | `token` *(requerido)* |

---

## 📦 Recursos (Resources) y Plantillas (Prompts)

### Recursos MCP
- `turismo://localidades`: Catálogo completo de las 58 localidades con sus hashes correspondientes.
- `turismo://circuitos`: Catálogo oficial de circuitos turísticos.

### Prompts MCP
- `planificar_itinerario`: Genera recomendaciones de itinerarios completos consultando lugares y locales gastronómicos oficiales.
- `buscar_actividades`: Busca ferias, eventos culturales o actividades para una fecha o localidad.

---

## 💻 1. Uso Local (En tu computadora)

En tu máquina local, los clientes de IA se comunican por **STDIO** (entrada/salida estándar).

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Probar la suite de pruebas unitarias
```bash
npm test
```

### Paso 3: Probar interactivamente con MCP Inspector
```bash
npx @modelcontextprotocol/inspector node src/index.js
```
Se abrirá una interfaz web donde puedes inspeccionar y llamar a cada herramienta en tiempo real.

---

### Configuración en Clientes Locales

#### A. Claude Desktop
En `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) o `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "turismo-tucuman": {
      "command": "node",
      "args": [
        "/Users/jferreyradev/projects/turismo/mcp-node-turismo/src/index.js"
      ],
      "env": {
        "TURISMO_API_URL": "http://api.tucumanturismo.gob.ar"
      }
    }
  }
}
```

#### B. Cursor / Windsurf
En `.cursor/mcp.json` o en los ajustes del editor (*Settings > Features > MCP*):

```json
{
  "mcpServers": {
    "turismo": {
      "command": "node",
      "args": [
        "/Users/jferreyradev/projects/turismo/mcp-node-turismo/src/index.js"
      ]
    }
  }
}
```

#### C. Gemini / Antigravity
En `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "turismo-api-node": {
      "command": "node",
      "args": [
        "/Users/jferreyradev/projects/turismo/mcp-node-turismo/src/index.js"
      ],
      "env": {
        "TURISMO_API_URL": "http://api.tucumanturismo.gob.ar"
      }
    }
  }
}
```

---

## 🌐 2. Uso en un Servidor Remoto (VPS, Cloud o Docker)

En un servidor remoto accesible por internet o en tu red local, el servidor escucha peticiones HTTP con **SSE (Server-Sent Events)**.

### Opción A: Ejecutar con Node.js / PM2 en un VPS

1. **Iniciar en modo HTTP en el puerto deseado:**
   ```bash
   npm run start:http
   # O especificando el puerto:
   node src/index.js --http 3000
   ```

2. **Mantenerlo en segundo plano con PM2 (recomendado en producción):**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name "mcp-turismo" -- --http 3000
   pm2 save
   pm2 startup
   ```

3. **Verificar el estado del servicio:**
   ```bash
   curl http://localhost:3000/health
   ```
   *Respuesta esperada:*
   ```json
   {
     "status": "online",
     "service": "Turismo Tucumán MCP Server (Node.js)",
     "version": "1.0.0",
     "transport": "streamable-sse",
     "endpoints": {
       "sse": "/sse",
       "messages": "/message"
     }
   }
   ```

---

### Opción B: Despliegue con Docker y Docker Compose

El repositorio incluye un `Dockerfile` optimizado y un `docker-compose.yml`:

1. **Levantar el contenedor en segundo plano:**
   ```bash
   docker compose up -d --build
   ```

2. **Ver logs del contenedor:**
   ```bash
   docker compose logs -f
   ```

3. **Detener el servicio:**
   ```bash
   docker compose down
   ```

---

### Conectar Clientes al Servidor Remoto

Tu servidor ya se encuentra disponible públicamente en internet con HTTPS:
👉 **URL del Servidor:** `https://mcp-node-turismo.onrender.com/sse`

* **En n8n / Flowise / Dify (Bots de WhatsApp / Web)**:
  * Tipo de transporte: `Server-Sent Events (SSE)`
  * URL del servidor: `https://mcp-node-turismo.onrender.com/sse`

* **En Cursor / Windsurf**:
  ```json
  {
    "mcpServers": {
      "turismo-tucuman": {
        "url": "https://mcp-node-turismo.onrender.com/sse"
      }
    }
  }
  ```

* **En Claude Desktop (usando mcp-remote)**:
  ```json
  {
    "mcpServers": {
      "turismo-tucuman": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://mcp-node-turismo.onrender.com/sse"]
      }
    }
  }
  ```

---

## 🔒 Producción con Nginx y SSL (HTTPS)

Si expones el servidor en internet, es recomendable colocar Nginx como Reverse Proxy con SSL (Certbot):

```nginx
server {
    server_name mcp.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Ajustes necesarios para SSE (Server-Sent Events)
        proxy_buffering off;
        proxy_read_timeout 24h;
        chunked_transfer_encoding off;
    }
}
```

---

## 📄 Licencia

ISC
