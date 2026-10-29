# Kurultai AI gateway

The robot must call this gateway over HTTPS. Never put `OPENAI_API_KEY` in the APK.

## Local smoke test

```bash
MOCK_OPENAI=true PORT=8787 npm start
curl http://127.0.0.1:8787/health
curl -X POST http://127.0.0.1:8787/assistant \
  -H 'Content-Type: application/json' \
  -d '{"message":"Подготовь три тезиса о регулировании AI","language":"ru"}'
```

## Production

1. Deploy this folder to a Node.js 20+ host or build the included Dockerfile.
2. Set `OPENAI_API_KEY` as a server secret. The default model is `gpt-6-astra`; override it with `OPENAI_MODEL` if needed.
3. Put the service behind HTTPS and expose `/health` and `/assistant`.
4. On the robot, open Settings in the app and enter `https://your-domain.kz/assistant`, then tap **Проверить** and **Сохранить**.

For production access control, enforce a device identity at the reverse proxy (mTLS, VPN, or an injected device token). Do not rely on a secret embedded in a distributable APK.
