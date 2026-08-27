# FB Fallback Gateway Test (ws3-fca)

Project Node.js th? nghi?m co ch? g?i & nh?n tin nh?n Facebook (cá nhân / Fanpage) qua thu vi?n ws3-fca.

## 1. Cài d?t dependencies
Ch?y l?nh sau t?i thu m?c này:
```bash
cd scripts/fb-fallback-gateway-test
npm install
```

## 2. Chu?n b? file appstate.json
1. Ðang nh?p nick Facebook trên trình duy?t Chrome (nick có quy?n Admin/Editor Fanpage n?u mu?n test g?i b?ng Page).
2. Dùng Extension (nhu C3C FbState ho?c Cookie-Editor) xu?t toàn b? cookies ra d?nh d?ng JSON.
3. T?o file `appstate.json` ngay trong thu m?c `scripts/fb-fallback-gateway-test/` và dán n?i dung cookies v?a copy vào.

*(Có th? xem file m?u `appstate.example.json` d? bi?t c?u trúc).*

## 3. Kh?i ch?y server
```bash
npm start
```
Khi ch?y thành công, terminal s? báo:
`? Ðã k?t n?i Facebook thành công!`

## 4. Test g?i tin nh?n qua HTTP POST

### G?i du?i tu cách Cá nhân:
POST http://localhost:4000/api/send-message
Body JSON:
{
  "recipientId": "1000xxxxxxxxx",
  "message": "Xin chao tu ws3-fca test gateway!"
}

### G?i du?i tu cách Fanpage (Dành cho MaxChat):
POST http://localhost:4000/api/send-message
Body JSON:
{
  "pageId": "100234567890123",
  "recipientId": "1000xxxxxxxxx",
  "message": "Xin chao, day la tin nhan fallback tu Fanpage!"
}
