# Sample API — OAuth2 M2M Testing

Repo public API dùng để test **OAuth2 Machine-to-Machine** (Client Credentials flow) trên Vercel.

Base URL production: **https://sample-api-qa.vercel.app**

## Flow M2M (Client Credentials)

```text
1. Client gọi POST /api/oauth/token  → nhận access_token
2. Client gọi GET  /api/getheadertoken với Authorization: Bearer <access_token>
3. Resource API trả về thông tin token để verify flow
```

## Endpoints

### `POST /api/oauth/token`

OAuth2 token endpoint — **Client Credentials grant**.

**Request** (`application/x-www-form-urlencoded` hoặc `application/json`):

Chỉ cần `grant_type`, `client_id`, `client_secret` — **không cần** `audience` hay `scope`.

```bash
curl -X POST https://sample-api-qa.vercel.app/api/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "test-m2m-client",
    "client_secret": "test-m2m-secret"
  }'
```

**Response 200** (format giống Auth0, không có `scope`):

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...<JWT ~796 chars>",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

`access_token` là **JWT RS256** (~796 ký tự, 2 dấu `.`), payload mẫu:

```json
{
  "iss": "https://sample-api-qa.vercel.app/",
  "sub": "test-m2m-client@clients",
  "aud": "https://sample-api-qa.vercel.app/api/v2/",
  "gty": "client-credentials",
  "azp": "test-m2m-client",
  "scope": "read:users",
  "sid": "<uuid>",
  "iat": 1782231074,
  "exp": 1782317474
}
```

> `scope` chỉ nằm **trong JWT payload**, không có field `scope` ở JSON response.

**Errors (OAuth2 standard):**

| Status | error | Khi nào |
|--------|-------|---------|
| 400 | `unsupported_grant_type` | grant_type ≠ client_credentials |
| 400 | `invalid_request` | thiếu client_id / client_secret |
| 401 | `invalid_client` | sai credentials |

### `GET /api/getheadertoken`

Protected resource — verify client đã gửi Bearer token đúng.

```bash
curl -H "Authorization: Bearer <access_token>" \
  https://sample-api-qa.vercel.app/api/getheadertoken
```

**Response 200:**

```json
{
  "userId": "<access_token>LamPi",
  "name": "Sample User",
  "email": "sample.user@example.com",
  "role": "tester"
}
```

**Response 401** — thiếu hoặc sai format header.

## Debug request lỗi (không cần BE tool code)

### Cách 1 — Bật debug trong response

Gửi thêm header `X-QA-Debug: 1` khi gọi `getheadertoken`. API sẽ trả thêm field `debug` giải thích lỗi:

```bash
curl -s -H "Authorization: Bearer <token>" \
  -H "X-QA-Debug: 1" \
  https://sample-api-qa.vercel.app/api/getheadertoken
```

Ví dụ response lỗi:

```json
{
  "error": "invalid_token",
  "error_description": "Access token is invalid, expired, or not issued for test-m2m-client",
  "debug": {
    "reason": "looks_like_jwt",
    "message": "Token looks like JWT (3 dot-separated parts), not sample M2M token",
    "tokenPreview": "eyJhbGci...W8 [len=120]",
    "tokenLength": 120
  }
}
```

Các `reason` có thể gặp:

| reason | Ý nghĩa |
|--------|---------|
| `missing_authorization` | Không có header Authorization |
| `invalid_bearer_format` | Không bắt đầu bằng `Bearer ` |
| `empty_token_after_bearer` | Sau `Bearer ` không có token |
| `double_bearer_prefix` | Token bị `Bearer Bearer ...` |
| `unexpected_token_length` | Token không ~796 chars (allowed 750-850) |
| `invalid_signature` | JWT không do sample-api cấp (vd: Auth0 token) |
| `wrong_sub` | Client trong token không phải test-m2m-client |
| `expired` | Token hết hạn |

### Cách 2 — Xem log trên Vercel

Mỗi request được ghi log JSON (token được mask).

**Lưu ý:** `vercel logs sample-api-qa` sẽ lỗi vì CLI hiểu đó là deployment URL, không phải project name.

```bash
cd docs/qa/Sample_API

# Live stream (khuyên dùng)
vercel logs https://sample-api-qa.vercel.app --follow

# Xem log gần đây (không stream)
vercel logs https://sample-api-qa.vercel.app --no-follow --expand

# Hoặc từ thư mục project đã link .vercel
vercel logs --follow
```

Sau đó gọi lại tool/chatbot, xem log field `outcome`, `tokenPreview`, `debugMessage`.

Hoặc xem trên web: [Vercel Dashboard → sample-api-qa → Logs](https://vercel.com/pi0099s-projects/sample-api-qa/logs)


| Field | Value |
|-------|-------|
| `client_id` | `test-m2m-client` |
| `client_secret` | `test-m2m-secret` |
| `expires_in` | `86400` (24h) |

Override credentials is not supported — only `test-m2m-client` / `test-m2m-secret` are accepted.

## Full test script

```bash
BASE=https://sample-api-qa.vercel.app

# Step 1: Get token
TOKEN=$(curl -s -X POST "$BASE/api/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=test-m2m-client" \
  -d "client_secret=test-m2m-secret" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Token: $TOKEN"

# Step 2: Call protected API
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/getheadertoken" | python3 -m json.tool
```

## Local development

```bash
npm install
npm run dev
# http://localhost:3001 (nếu port 3000 bị chiếm)
```

## Deploy

```bash
vercel deploy --prod
```

### `GET/POST /api/orderinfo`

Return seeded random order info for QA based on `userId` and/or `email`.

At least one of `userId` or `email` is required. **Cách gọi giống nhau** — đều là query param (GET) hoặc JSON field (POST).

`userId=alice` và `email=alice@example.com` trả về **cùng orders**.

**GET (query param — khuyên dùng):**

```bash
curl "https://sample-api-qa.vercel.app/api/orderinfo?userId=alice"

curl "https://sample-api-qa.vercel.app/api/orderinfo?email=alice@example.com"

curl "https://sample-api-qa.vercel.app/api/orderinfo?userId=alice&email=alice@example.com"
```

**POST (JSON body — cùng field name):**

```bash
curl -X POST "https://sample-api-qa.vercel.app/api/orderinfo" \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice"}'

curl -X POST "https://sample-api-qa.vercel.app/api/orderinfo" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}'
```

**Response 200:**

```json
{
  "userId": "user-123",
  "email": "user.123@example.com",
  "orderCount": 3,
  "orders": [
    {
      "orderId": "ORD-482913-1",
      "status": "shipped",
      "total": 189.97,
      "currency": "USD",
      "items": [
        {
          "sku": "SKU-1004",
          "name": "27-inch Monitor",
          "quantity": 1,
          "unitPrice": 249
        }
      ],
      "createdAt": "2026-03-12T08:15:00.000Z"
    }
  ]
}
```

## MCP tool: `get_order_info`

Tool trả về order info giống `/api/orderinfo`. Có **2 cách** chạy MCP:

| Cách | Khi nào dùng |
|------|----------------|
| **Remote (Vercel)** | Gọi từ máy khác, ngoài mạng — khuyên dùng |
| **Local (stdio)** | Dev trên máy có source code |

### Remote MCP trên Vercel (gọi từ máy khác)

Endpoint MCP (Streamable HTTP):

```
https://sample-api-qa.vercel.app/api/mcp
```

**Cursor / Claude Desktop** — thêm vào `~/.cursor/mcp.json` (hoặc Claude config):

```json
{
  "mcpServers": {
    "sample-api-orderinfo": {
      "url": "https://sample-api-qa.vercel.app/api/mcp"
    }
  }
}
```

Restart Cursor → Settings → MCP → `sample-api-orderinfo` phải **connected**.

**Nếu client chỉ hỗ trợ stdio** — dùng bridge `mcp-remote`:

```json
{
  "mcpServers": {
    "sample-api-orderinfo": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://sample-api-qa.vercel.app/api/mcp"
      ]
    }
  }
}
```

**Test bằng MCP Inspector (local hoặc remote):**

```bash
cd docs/qa/Sample_API
npm run dev
npx @modelcontextprotocol/inspector
```

- Transport: **Streamable HTTP**
- URL: `http://localhost:3000/api/mcp` (local) hoặc `https://sample-api-qa.vercel.app/api/mcp` (prod)
- Connect → List Tools → gọi `get_order_info` với `{"userId":"alice"}`

### Local MCP (stdio, dev only)

```bash
cd docs/qa/Sample_API
npm install
npm run mcp:orderinfo
```

Cursor config (chỉ máy có source code):

```json
{
  "mcpServers": {
    "sample-api-orderinfo-local": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/Sample_API/mcp-server/index.ts"
      ]
    }
  }
}
```

Example file: `mcp-server/cursor.mcp.json`

### Tool input

Both fields work the same way — provide **one** of them:

```json
{ "userId": "alice" }
```

```json
{ "email": "alice@example.com" }
```

`userId=alice` and `email=alice@example.com` return the same orders.

Returns the same JSON shape as `/api/orderinfo`.

