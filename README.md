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

```bash
curl -X POST https://sample-api-qa.vercel.app/api/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=test-m2m-client" \
  -d "client_secret=test-m2m-secret"
```

**Response 200:**

```json
{
  "access_token": "<token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

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
| `looks_like_jwt` | Gửi nhầm JWT (Privy/Auth0) |
| `decode_failed` | Không decode được base64url JSON |
| `wrong_sub` / `wrong_grant_type` | Token không phải của `test-m2m-client` |
| `expired` | Token hết hạn |

### Cách 2 — Xem log trên Vercel

Mỗi request được ghi log JSON (token được mask). Chạy:

```bash
cd docs/qa/Sample_API
vercel logs sample-api-qa --follow
```

Sau đó gọi lại tool/chatbot, xem log field `outcome`, `tokenPreview`, `debugMessage`.


| Field | Value |
|-------|-------|
| `client_id` | `test-m2m-client` |
| `client_secret` | `test-m2m-secret` |
| `expires_in` | `3600` (giây) |

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
