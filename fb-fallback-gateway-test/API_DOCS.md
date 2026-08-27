# ?? Tài li?u API - FB Fallback Gateway Service (ws3-fca)

D?ch v? Node.js trung gian h? tr? g?i/nh?n tin nh?n, l?y danh sách h?i tho?i và l?ch s? chat c?a Facebook Fanpage & Tài kho?n cá nhân (Bypass gi?i h?n 24h c?a Graph API).

---

## ?? Base URL
```
http://localhost:4000
```

---

## 1. Ki?m tra tr?ng thái k?t n?i (Health Check)
Dùng d? ki?m tra xem Gateway dã dang nh?p Facebook và s?n sàng ho?t d?ng hay chua.

* **Method:** `GET`
* **Path:** `/health`
* **Query Params:** Không

### Response:
```json
{
  "status": "ready",            // "ready" | "waiting_for_appstate"
  "hasAppState": true
}
```

---

## 2. L?y danh sách h?i tho?i (Thread List / Inbox)
L?y danh sách các cu?c trò chuy?n g?n nh?t c?a Fanpage ho?c nick cá nhân.

* **Method:** `GET`
* **Path:** `/api/threads`
* **Query Parameters:**

| Param | Ki?u | B?t bu?c | M?c d?nh | Mô t? |
| :--- | :--- | :--- | :--- | :--- |
| `pageId` | `string` | Không | `null` | **ID c?a Fanpage**. N?u d? tr?ng s? l?y inbox c?a nick cá nhân. |
| `limit` | `number` | Không | `20` | S? lu?ng cu?c trò chuy?n mu?n l?y (t?i da ~50). |
| `tags` | `string` | Không | `INBOX` | B? l?c h?i tho?i: `INBOX`, `PENDING` (tin nh?n ch?), `ARCHIVED` (dã luu tr?). |
| `timestamp` | `number` | Không | `null` | M?c th?i gian d? phân trang (l?y các h?i tho?i cu hon). |

### Example Request:
```bash
# L?y 20 h?i tho?i g?n nh?t c?a Fanpage
curl -X GET "http://localhost:4000/api/threads?pageId=100234567890123&limit=20"
```

### Response:
```json
{
  "success": true,
  "count": 2,
  "threads": [
    {
      "threadID": "10008392183921",
      "name": "Nguy?n Van A",
      "unreadCount": 1,
      "snippet": "Shop oi cái này còn hàng không?",
      "timestamp": "1724734892000",
      "isGroup": false,
      "participantIDs": ["10008392183921", "100234567890123"]
    },
    {
      "threadID": "10009483920192",
      "name": "Tr?n Th? B",
      "unreadCount": 0,
      "snippet": "C?m on shop nhé!",
      "timestamp": "1724731000000",
      "isGroup": false,
      "participantIDs": ["10009483920192", "100234567890123"]
    }
  ]
}
```

---

## 3. L?y l?ch s? tin nh?n c?a 1 h?i tho?i (Thread History)
L?y chi ti?t các tin nh?n trong m?t cu?c trò chuy?n c? th?.

* **Method:** `GET`
* **Path:** `/api/threads/:threadId/messages`
* **Query Parameters:**

| Param | Ki?u | B?t bu?c | M?c d?nh | Mô t? |
| :--- | :--- | :--- | :--- | :--- |
| `pageId` | `string` | Không | `null` | **ID c?a Fanpage** s? h?u h?i tho?i này. |
| `limit` | `number` | Không | `20` | S? lu?ng tin nh?n mu?n l?y. |
| `timestamp` | `number` | Không | `null` | M?c th?i gian d? cu?n lên xem tin nh?n cu hon. |

### Example Request:
```bash
curl -X GET "http://localhost:4000/api/threads/10008392183921/messages?pageId=100234567890123&limit=20"
```

### Response:
```json
{
  "success": true,
  "threadId": "10008392183921",
  "messages": [
    {
      "messageID": "mid.$cAAA...",
      "body": "Shop oi cái này còn hàng không?",
      "senderID": "10008392183921",
      "timestamp": "1724734892000",
      "attachments": []
    },
    {
      "messageID": "mid.$cBBB...",
      "body": "D? shop chào b?n, s?n ph?m này bên mình v?n còn s?n hàng ?!",
      "senderID": "100234567890123",
      "timestamp": "1724734950000",
      "attachments": []
    }
  ]
}
```

---

## 4. G?i tin nh?n (Send Message / Fallback)
G?i tin nh?n van b?n t? Fanpage (ho?c cá nhân) t?i khách hàng. **Không b? ch?n b?i gi?i h?n 24 gi? hay 7 ngày**.

* **Method:** `POST`
* **Path:** `/api/send-message`
* **Headers:** `Content-Type: application/json`
* **Body Parameters:**

| Field | Ki?u | B?t bu?c | Mô t? |
| :--- | :--- | :--- | :--- |
| `recipientId` | `string` | **Có** | ID c?a khách hàng ho?c ID c?a nhóm/cu?c trò chuy?n (`threadID`). |
| `message` | `string` | **Có** | N?i dung tin nh?n c?n g?i. |
| `pageId` | `string` | Không | **ID Fanpage** mu?n d?ng tên g?i. N?u không truy?n s? g?i b?ng nick cá nhân. |

### Example Request:
```bash
curl -X POST http://localhost:4000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "pageId": "100234567890123",
    "recipientId": "10008392183921",
    "message": "Chào b?n, don hàng c?a b?n dã du?c dóng gói và g?i di r?i nhé!"
  }'
```

### Response:
```json
{
  "success": true,
  "recipientId": "10008392183921",
  "sentAsPage": true,
  "messageInfo": {
    "threadID": "10008392183921",
    "messageID": "mid.$cCCC...",
    "timestamp": 1724735000000
  }
}
```

---

## 5. B?ng mã l?i thu?ng g?p (Error Codes)

| HTTP Status | Nguyên nhân | Hu?ng x? lý |
| :--- | :--- | :--- |
| `503 Service Unavailable` | Gateway chua k?t n?i FB ho?c chua có file `appstate.json`. | Ki?m tra file `appstate.json` và kh?i d?ng l?i gateway. |
| `400 Bad Request` | Thi?u tru?ng b?t bu?c (`recipientId`, `message`). | Ki?m tra l?i body JSON g?i lên. |
| `500 Internal Server Error` | Cookie h?t h?n, nick b? checkpoint ho?c Facebook ch?n t?m th?i. | Export l?i `appstate.json` m?i ho?c ki?m tra quy?n Admin c?a nick d?i v?i Page. |
