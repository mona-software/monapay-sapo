# Security Policy

Không gửi lỗ hổng có thể khai thác qua issue công khai. Hãy gửi mô tả, phiên bản bị ảnh hưởng và cách tái hiện tới `security@themona.global`. Không gửi credential, dữ liệu giao dịch thật hoặc thông tin khách hàng.

Please do not disclose exploitable vulnerabilities in a public issue. Send the affected version, impact, and reproduction steps to `security@themona.global`. Do not include live credentials, transaction data, or customer information.

## Security baseline

- Verify Sapo and MONA Pay webhook signatures on the unmodified request bytes.
- Keep the MONA Pay replay window at five minutes or less.
- Never log or commit API/webhook secrets.
- Expose the container only through an HTTPS reverse proxy.
